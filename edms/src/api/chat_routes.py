from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict
from fastapi.responses import StreamingResponse
import time

from src.auth.dependencies import get_current_user
from src.api.index_manager import (
    get_index_metadata,
    ensure_org_search_indexes,
)
from src.retriever import DEFAULT_TOP_K, retrieve_chunks, sanitize_top_k
from src.runtime_config import CHAT_HISTORY_MAX_MESSAGES, QUERY_MAX_CHARS
from src.telemetry import log_event, stage_timer
from src.traffic_control import enforce_rate_limit, request_capacity_guard
from src.generator import generate_answer, stream_answer
from src.chunker import create_chunks
from src.parser import parse_org_folder
from src.retrieval.bm25_index import BM25Index

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=QUERY_MAX_CHARS)
    history: List[Dict] = []
    top_k: int = DEFAULT_TOP_K


def _low_signal_response_text() -> str:
    return (
        "Hi! I can help explain the documents, notes, tickets, "
        "postmortems, ADRs, RFCs, and diagrams stored in this workspace.\n\n"
        "What would you like to explore?"
    )


def _validated_message(message: str) -> str:
    cleaned = (message or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    if len(cleaned) > QUERY_MAX_CHARS:
        raise HTTPException(status_code=400, detail="Query is too long")
    return cleaned


def _validated_history(history: List[Dict]) -> List[Dict]:
    if len(history) > CHAT_HISTORY_MAX_MESSAGES:
        return history[-CHAT_HISTORY_MAX_MESSAGES:]
    return history


def _fallback_file_retrieval(
    *,
    query: str,
    org_slug: str,
    org_id: int,
    top_k: int,
) -> List[Dict]:
    docs = parse_org_folder(org_slug=org_slug, org_id=org_id)
    chunks = create_chunks(docs)
    if not chunks:
        return []

    bm25_index = BM25Index(chunks)
    results = bm25_index.search(query, top_k=sanitize_top_k(top_k))
    if results:
        log_event(
            30,
            "chat_file_fallback_used",
            event="chat",
            org_slug=org_slug,
            retrieved_chunks=len(results),
        )
    return results


def _should_use_file_fallback_first(meta: Dict) -> bool:
    return meta.get("status") != "ready"


@router.post("")
def chat(
    data: ChatRequest,
    user=Depends(get_current_user),
):
    message = _validated_message(data.message)
    history = _validated_history(data.history)
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "chat")
    org_slug = user["org_slug"]
    meta = get_index_metadata(org_slug)
    retrieved = None
    query_length = len(message)
    with request_capacity_guard():
        if _should_use_file_fallback_first(meta):
            with stage_timer("chat_file_retrieval", route="/chat", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
                retrieved = _fallback_file_retrieval(
                    query=message,
                    org_slug=org_slug,
                    org_id=user["org_id"],
                    top_k=data.top_k,
                )

        if retrieved is None:
            try:
                with stage_timer("chat_retrieval", route="/chat", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
                    store, bm25_index, meta = ensure_org_search_indexes(
                        org_slug,
                        user["org_id"],
                    )
                    retrieved = retrieve_chunks(
                        message,
                        store,
                        bm25_index=bm25_index,
                        top_k=sanitize_top_k(data.top_k),
                        org_slug=org_slug,
                        index_version=meta.get("index_version"),
                    )
            except Exception as exc:
                log_event(
                    40,
                    "chat_retrieval_failed",
                    route="/chat",
                    user_id=user["id"],
                    org_id=user["org_id"],
                    org_slug=org_slug,
                    query_length=query_length,
                    index_status=meta.get("status"),
                    pipeline_status=meta.get("pipeline_status"),
                    error_type=exc.__class__.__name__,
                )
                retrieved = _fallback_file_retrieval(
                    query=message,
                    org_slug=org_slug,
                    org_id=user["org_id"],
                    top_k=data.top_k,
                )
                if retrieved:
                    meta = get_index_metadata(org_slug)
                else:
                    latest_meta = get_index_metadata(org_slug)
                    status = latest_meta.get("status", meta.get("status", "unavailable"))
                    pipeline_status = latest_meta.get("pipeline_status", meta.get("pipeline_status", "idle"))
                    return {
                        "answer": (
                            "I could not find indexed content for this workspace yet. "
                            f"Current status: {status}. Pipeline: {pipeline_status}. Upload data or try again after indexing finishes."
                        ),
                        "evidence": [],
                    }

    if _should_use_file_fallback_first(meta) and retrieved:
        meta = {
            **meta,
            "index_version": f"file-fallback:{org_slug}",
        }

    # 🛑 LOW-SIGNAL GUARDRAIL
    if not retrieved:
        return {
            "answer": _low_signal_response_text(),
            "evidence": [],
        }

    with stage_timer("chat_generation", route="/chat", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
        result = generate_answer(
            query=message,
            chunks=retrieved,
            history=history,
            org_slug=org_slug,
            index_version=meta.get("index_version"),
        )
    log_event(20, "chat_completed", event="chat", route="/chat", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug, query_length=query_length, retrieved_chunks=len(retrieved), top_k=sanitize_top_k(data.top_k), index_status=meta.get("status"), pipeline_status=meta.get("pipeline_status"))
    return result


@router.post("/stream")
def chat_stream(
    data: ChatRequest,
    user=Depends(get_current_user),
):
    message = _validated_message(data.message)
    history = _validated_history(data.history)
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "chat")
    org_slug = user["org_slug"]
    meta = get_index_metadata(org_slug)
    retrieved = None
    query_length = len(message)
    try:
        with request_capacity_guard():
            if _should_use_file_fallback_first(meta):
                with stage_timer("chat_stream_file_retrieval", route="/chat/stream", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
                    retrieved = _fallback_file_retrieval(
                        query=message,
                        org_slug=org_slug,
                        org_id=user["org_id"],
                        top_k=data.top_k,
                    )

            if retrieved is None:
                with stage_timer("chat_stream_retrieval", route="/chat/stream", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
                    store, bm25_index, meta = ensure_org_search_indexes(
                        org_slug,
                        user["org_id"],
                    )
                    retrieved = retrieve_chunks(
                        message,
                        store,
                        bm25_index=bm25_index,
                        top_k=sanitize_top_k(data.top_k),
                        org_slug=org_slug,
                        index_version=meta.get("index_version"),
                    )
    except Exception as exc:
        log_event(
            40,
            "chat_stream_retrieval_failed",
            route="/chat/stream",
            user_id=user["id"],
            org_id=user["org_id"],
            org_slug=org_slug,
            query_length=query_length,
            index_status=meta.get("status"),
            pipeline_status=meta.get("pipeline_status"),
            error_type=exc.__class__.__name__,
        )
        meta = get_index_metadata(org_slug)
        retrieved = _fallback_file_retrieval(
            query=message,
            org_slug=org_slug,
            org_id=user["org_id"],
            top_k=data.top_k,
        )

    if _should_use_file_fallback_first(meta) and retrieved:
        meta = {
            **meta,
            "index_version": f"file-fallback:{org_slug}",
        }

    def event_generator():
        if retrieved is None:
            status = meta.get("status", "unavailable")
            pipeline_status = meta.get("pipeline_status", "idle")
            yield (
                "I could not find indexed content for this workspace yet. "
                f"Current status: {status}. Pipeline: {pipeline_status}. Upload data or try again after indexing finishes."
            )
            return

        if not retrieved:
            yield _low_signal_response_text()
            return

        for token in stream_answer(
            query=message,
            chunks=retrieved,
            history=history,
            org_slug=org_slug,
            index_version=meta.get("index_version"),
        ):
            yield token
            time.sleep(0.01)

        log_event(20, "chat_stream_completed", event="chat", route="/chat/stream", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug, query_length=query_length, retrieved_chunks=len(retrieved), index_status=meta.get("status"), pipeline_status=meta.get("pipeline_status"))

    return StreamingResponse(
        event_generator(),
        media_type="text/plain",
    )

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Dict, List

from src.api.index_manager import get_index_metadata
from src.auth.dependencies import get_current_user
from src.generator import generate_answer, stream_answer
from src.retriever import DEFAULT_TOP_K, sanitize_top_k
from src.runtime_config import CHAT_HISTORY_MAX_MESSAGES, QUERY_MAX_CHARS
from src.services.query_flow import (
    annotate_file_fallback_index_version,
    get_cached_workspace_insights,
    fallback_file_retrieval,
    resolve_query_chunks,
)
from src.telemetry import log_event, stage_timer
from src.traffic_control import enforce_rate_limit, request_capacity_guard

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=QUERY_MAX_CHARS)
    history: List[Dict] = Field(default_factory=list)
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
        try:
            with stage_timer("chat_retrieval", route="/chat", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
                resolution = resolve_query_chunks(
                    query=message,
                    org_slug=org_slug,
                    org_id=user["org_id"],
                    top_k=data.top_k,
                )
                retrieved = resolution.retrieved
                meta = annotate_file_fallback_index_version(
                    resolution.meta,
                    org_slug,
                    resolution.used_file_fallback,
                )
        except Exception as exc:
            meta = meta or {}
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
            retrieved = fallback_file_retrieval(
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
    intelligence = get_cached_workspace_insights(
        org_slug=org_slug,
        org_id=user["org_id"],
        index_version=meta.get("index_version"),
        seed_chunks=retrieved,
        query=message,
    )
    log_event(20, "chat_completed", event="chat", route="/chat", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug, query_length=query_length, retrieved_chunks=len(retrieved), top_k=sanitize_top_k(data.top_k), index_status=meta.get("status"), pipeline_status=meta.get("pipeline_status"))
    return {
        **result,
        "related_evidence": intelligence["related_evidence"],
        "service_summary": intelligence["service_summary"],
        "timeline": intelligence["timeline"],
        "workspace_summary": intelligence["workspace_summary"],
    }


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
            with stage_timer("chat_stream_retrieval", route="/chat/stream", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
                resolution = resolve_query_chunks(
                    query=message,
                    org_slug=org_slug,
                    org_id=user["org_id"],
                    top_k=data.top_k,
                )
                retrieved = resolution.retrieved
                meta = annotate_file_fallback_index_version(
                    resolution.meta,
                    org_slug,
                    resolution.used_file_fallback,
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
        retrieved = fallback_file_retrieval(
            query=message,
            org_slug=org_slug,
            org_id=user["org_id"],
            top_k=data.top_k,
        )
        if retrieved:
            meta = get_index_metadata(org_slug)

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

        log_event(20, "chat_stream_completed", event="chat", route="/chat/stream", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug, query_length=query_length, retrieved_chunks=len(retrieved), index_status=meta.get("status"), pipeline_status=meta.get("pipeline_status"))

    return StreamingResponse(
        event_generator(),
        media_type="text/plain",
    )

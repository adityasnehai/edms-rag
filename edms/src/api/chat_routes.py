from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict
from fastapi.responses import StreamingResponse
import time

from src.auth.dependencies import get_current_user
from src.api.index_manager import (
    get_bm25_index,
    get_index_metadata,
    get_vector_store,
)
from src.retriever import DEFAULT_TOP_K, retrieve_chunks, sanitize_top_k
from src.runtime_config import CHAT_HISTORY_MAX_MESSAGES, QUERY_MAX_CHARS
from src.telemetry import log_event, stage_timer
from src.traffic_control import enforce_rate_limit, request_capacity_guard
from src.generator import generate_answer, stream_answer

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str = Field(..., max_length=QUERY_MAX_CHARS)
    history: List[Dict] = []
    top_k: int = DEFAULT_TOP_K


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
    with request_capacity_guard():
        try:
            with stage_timer("chat_retrieval", route="/chat", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
                store = get_vector_store(org_slug)
                try:
                    bm25_index = get_bm25_index(org_slug)
                except Exception:
                    bm25_index = None
                retrieved = retrieve_chunks(
                    message,
                    store,
                    bm25_index=bm25_index,
                    top_k=sanitize_top_k(data.top_k),
                    org_slug=org_slug,
                    index_version=meta.get("index_version"),
                )
        except Exception:
            status = meta.get("status", "unavailable")
            pipeline_status = meta.get("pipeline_status", "idle")
            return {
                "answer": (
                    "The knowledge index is currently unavailable. "
                    f"Current status: {status}. Pipeline: {pipeline_status}. Please try again shortly."
                ),
                "evidence": [],
            }

    # 🛑 LOW-SIGNAL GUARDRAIL
    if not retrieved:
        return {
            "answer": (
                "Hi! I can help explain the documents, notes, tickets, "
                "postmortems, ADRs, RFCs, and diagrams stored in this workspace.\n\n"
                "What would you like to explore?"
            ),
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
    log_event(20, "chat_completed", route="/chat", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug, retrieved_chunks=len(retrieved), top_k=sanitize_top_k(data.top_k))
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
    try:
        with request_capacity_guard():
            with stage_timer("chat_stream_retrieval", route="/chat/stream", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
                store = get_vector_store(org_slug)
                try:
                    bm25_index = get_bm25_index(org_slug)
                except Exception:
                    bm25_index = None
                retrieved = retrieve_chunks(
                    message,
                    store,
                    bm25_index=bm25_index,
                    top_k=sanitize_top_k(data.top_k),
                    org_slug=org_slug,
                    index_version=meta.get("index_version"),
                )
    except Exception:
        retrieved = None

    def event_generator():
        if retrieved is None:
            status = meta.get("status", "unavailable")
            pipeline_status = meta.get("pipeline_status", "idle")
            yield (
                "The knowledge index is currently unavailable. "
                f"Current status: {status}. Pipeline: {pipeline_status}. Please try again shortly."
            )
            return

        if not retrieved:
            yield (
                "I need a more specific question about the documents, notes, "
                "tickets, postmortems, ADRs, RFCs, or diagrams in this workspace."
            )
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

    return StreamingResponse(
        event_generator(),
        media_type="text/plain",
    )

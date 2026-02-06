from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Dict
from fastapi.responses import StreamingResponse
import time

from src.auth.dependencies import get_current_user
from src.api.index_manager import get_vector_store
from src.retriever import retrieve_chunks
from src.generator import generate_answer, stream_answer

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    history: List[Dict] = []


@router.post("")
def chat(
    data: ChatRequest,
    user=Depends(get_current_user),
):
    store = get_vector_store()
    retrieved = retrieve_chunks(data.message, store, top_k=5)

    # 🛑 LOW-SIGNAL GUARDRAIL
    if not retrieved:
        return {
            "answer": (
                "Hi! I can help explain system decisions, incidents, "
                "architecture diagrams, or design trade-offs.\n\n"
                "What would you like to explore?"
            ),
            "evidence": [],
        }

    return generate_answer(
        query=data.message,
        chunks=retrieved,
        history=data.history,
    )


@router.post("/stream")
def chat_stream(
    data: ChatRequest,
    user=Depends(get_current_user),
):
    store = get_vector_store()
    retrieved = retrieve_chunks(data.message, store, top_k=5)

    def event_generator():
        if not retrieved:
            yield (
                "I need a more specific question related to architecture, "
                "incidents, or system diagrams."
            )
            return

        for token in stream_answer(
            query=data.message,
            chunks=retrieved,
            history=data.history,
        ):
            yield token
            time.sleep(0.01)

    return StreamingResponse(
        event_generator(),
        media_type="text/plain",
    )

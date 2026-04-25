from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from src.auth.dependencies import get_current_user
from src.state_store import (
    clear_recent_searches,
    delete_chat_thread,
    list_chat_threads,
    list_recent_searches,
    save_recent_search,
    upsert_chat_thread,
)
from src.traffic_control import enforce_rate_limit

router = APIRouter(prefix="/state", tags=["state"])


class ChatThreadPayload(BaseModel):
    id: str
    title: str
    messages: List[Dict] = Field(default_factory=list)
    createdAt: str | None = None
    updatedAt: str | None = None


class RecentSearchPayload(BaseModel):
    query: str
    result: Dict | None = None


@router.get("/chat/threads")
def get_chat_threads(user=Depends(get_current_user)):
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "read")
    return {"threads": list_chat_threads(user["id"], user["org_id"])}


@router.put("/chat/threads/{thread_id}")
def save_chat_thread(thread_id: str, payload: ChatThreadPayload, user=Depends(get_current_user)):
    if payload.id != thread_id:
        raise HTTPException(status_code=400, detail="Thread id mismatch")
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "read")
    return upsert_chat_thread(user["id"], user["org_id"], payload.model_dump())


@router.delete("/chat/threads/{thread_id}")
def remove_chat_thread(thread_id: str, user=Depends(get_current_user)):
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "read")
    delete_chat_thread(user["id"], user["org_id"], thread_id)
    return {"status": "ok"}


@router.get("/recent-searches")
def get_recent_searches(user=Depends(get_current_user)):
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "read")
    return {"items": list_recent_searches(user["id"], user["org_id"], limit=5)}


@router.post("/recent-searches")
def add_recent_search(payload: RecentSearchPayload, user=Depends(get_current_user)):
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "read")
    save_recent_search(user["id"], user["org_id"], payload.query.strip(), payload.result, limit=5)
    return {"status": "ok"}


@router.delete("/recent-searches")
def delete_recent_searches(user=Depends(get_current_user)):
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "read")
    clear_recent_searches(user["id"], user["org_id"])
    return {"status": "ok"}

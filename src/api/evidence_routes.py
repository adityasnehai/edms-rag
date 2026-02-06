from fastapi import APIRouter, Depends, Query
from typing import List, Dict, Optional

from src.auth.dependencies import get_current_user
from src.api.index_manager import get_vector_store

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get("", response_model=Dict)
def list_evidence(
    data_type: Optional[str] = Query(None),
    section_type: Optional[str] = Query(None),
    doc_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    """
    Evidence browser with filtering + pagination.
    """

    store = get_vector_store()
    filtered = []

    # ---- Apply filters ----
    for c in store.chunks:
        if data_type and c.get("data_type") != data_type:
            continue
        if section_type and c.get("section_type") != section_type:
            continue
        if doc_id and c.get("doc_id") != doc_id:
            continue

        filtered.append({
            "doc_id": c.get("doc_id"),
            "data_type": c.get("data_type"),
            "section_type": c.get("section_type"),
            "text": c.get("text"),
        })

    total = len(filtered)

    # ---- Pagination slice ----
    paginated = filtered[offset : offset + limit]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": paginated,
    }

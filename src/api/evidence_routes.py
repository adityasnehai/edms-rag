import os
from fastapi import APIRouter, Depends, Query
from typing import Dict, Optional, List

from src.auth.dependencies import get_current_user
from src.api.index_manager import get_vector_store
from src.parser import ORG_DATA_PATH

router = APIRouter(prefix="/evidence", tags=["evidence"])

IMAGE_EXTS = (".png", ".jpg", ".jpeg")


def _resolve_image_path(doc_id: Optional[str]) -> Optional[str]:
    if not doc_id:
        return None

    images_dir = os.path.join(ORG_DATA_PATH, "images")

    candidates: List[str]
    if doc_id.lower().endswith(IMAGE_EXTS):
        candidates = [doc_id]
    else:
        candidates = [f"{doc_id}{ext}" for ext in IMAGE_EXTS]

    for fname in candidates:
        fpath = os.path.join(images_dir, fname)
        if os.path.exists(fpath):
            return f"/static/images/{fname}"

    return None


def _list_image_items(
    data_type: Optional[str],
    section_type: Optional[str],
    doc_id: Optional[str],
) -> List[Dict]:
    if data_type and data_type != "images":
        return []

    if section_type and section_type != "vision_summary":
        return []

    images_dir = os.path.join(ORG_DATA_PATH, "images")
    if not os.path.isdir(images_dir):
        return []

    items: List[Dict] = []
    for fname in sorted(os.listdir(images_dir)):
        if not fname.lower().endswith(IMAGE_EXTS):
            continue

        if doc_id and doc_id != fname and doc_id != os.path.splitext(fname)[0]:
            continue

        items.append({
            "doc_id": fname,
            "data_type": "images",
            "section_type": "vision_summary",
            "text": "",
            "is_image": True,
            "image_path": f"/static/images/{fname}",
        })

    return items


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
    filtered: List[Dict] = []

    # ---- Apply filters ----
    for c in store.chunks:
        if data_type and c.get("data_type") != data_type:
            continue
        if section_type and c.get("section_type") != section_type:
            continue
        if doc_id and c.get("doc_id") != doc_id:
            continue

        item = {
            "doc_id": c.get("doc_id"),
            "data_type": c.get("data_type"),
            "section_type": c.get("section_type"),
            "text": c.get("text"),
        }

        if item["data_type"] == "images":
            image_path = _resolve_image_path(item.get("doc_id"))
            if image_path:
                item["is_image"] = True
                item["image_path"] = image_path

        filtered.append(item)

    # Add images even if they are not in the vector store (demo data)
    image_items = _list_image_items(data_type, section_type, doc_id)
    if image_items:
        existing = {i.get("image_path") for i in filtered if i.get("image_path")}
        for img in image_items:
            if img.get("image_path") in existing:
                continue
            filtered.append(img)

    # ---- Pagination slice ----
    total = len(filtered)
    paginated = filtered[offset : offset + limit]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": paginated,
    }

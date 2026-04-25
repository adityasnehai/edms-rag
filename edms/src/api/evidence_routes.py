import os
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from src.api.index_manager import get_vector_store
from src.auth.dependencies import get_current_user
from src.storage import exists, iter_files, read_bytes
from src.tenancy import get_org_data_path
from src.traffic_control import enforce_rate_limit

router = APIRouter(prefix="/evidence", tags=["evidence"])

IMAGE_EXTS = (".png", ".jpg", ".jpeg")


def _resolve_image_file(org_slug: str, doc_id: Optional[str]) -> Optional[str]:
    if not doc_id:
        return None

    clean_doc_id = Path((doc_id or "").strip()).name
    if not clean_doc_id or clean_doc_id in {".", ".."}:
        return None

    images_dir = os.path.join(get_org_data_path(org_slug), "images")
    candidates: List[str]
    if clean_doc_id.lower().endswith(IMAGE_EXTS):
        candidates = [clean_doc_id]
    else:
        candidates = [f"{clean_doc_id}{ext}" for ext in IMAGE_EXTS]

    for fname in candidates:
        if exists(org_slug, f"images/{fname}"):
            return f"images/{fname}"

    return None


def _list_image_items(
    org_slug: str,
    data_type: Optional[str],
    section_type: Optional[str],
    doc_id: Optional[str],
) -> List[Dict]:
    if data_type and data_type != "images":
        return []

    if section_type and section_type != "vision_summary":
        return []

    images_dir = os.path.join(get_org_data_path(org_slug), "images")
    items: List[Dict] = []
    for rel_path, _ in iter_files(org_slug, suffixes=IMAGE_EXTS):
        if not rel_path.startswith("images/"):
            continue
        fname = rel_path.split("/")[-1]

        if doc_id and doc_id != fname and doc_id != os.path.splitext(fname)[0]:
            continue

        items.append({
            "doc_id": fname,
            "data_type": "images",
            "section_type": "vision_summary",
            "text": "",
            "is_image": True,
            "image_path": f"/evidence/image/{fname}",
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
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "evidence")
    org_slug = user["org_slug"]
    limit = max(1, min(limit, 100))

    try:
        chunks = get_vector_store(org_slug).chunks
    except Exception:
        chunks = []

    filtered: List[Dict] = []

    for chunk in chunks:
        if data_type and chunk.get("data_type") != data_type:
            continue
        if section_type and chunk.get("section_type") != section_type:
            continue
        if doc_id and chunk.get("doc_id") != doc_id:
            continue

        item = {
            "doc_id": chunk.get("doc_id"),
            "data_type": chunk.get("data_type"),
            "section_type": chunk.get("section_type"),
            "text": chunk.get("text"),
        }

        if item["data_type"] == "images":
            image_path = _resolve_image_file(org_slug, item.get("doc_id"))
            if image_path:
                item["is_image"] = True
                image_name = os.path.basename(image_path)
                item["image_path"] = f"/evidence/image/{image_name}"

        filtered.append(item)

    image_items = _list_image_items(org_slug, data_type, section_type, doc_id)
    if image_items:
        existing = {item.get("image_path") for item in filtered if item.get("image_path")}
        for image_item in image_items:
            if image_item.get("image_path") in existing:
                continue
            filtered.append(image_item)

    total = len(filtered)
    paginated = filtered[offset : offset + limit]

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": paginated,
    }


@router.get("/image/{doc_id}")
def get_evidence_image(
    doc_id: str,
    user=Depends(get_current_user),
):
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "evidence")
    file_path = _resolve_image_file(user["org_slug"], doc_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="Image not found")

    ext = os.path.splitext(file_path)[1].lower()
    media_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
    }.get(ext, "application/octet-stream")

    return Response(content=read_bytes(user["org_slug"], file_path), media_type=media_type)

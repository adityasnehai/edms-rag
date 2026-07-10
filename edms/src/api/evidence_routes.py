import os
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from src.api.index_manager import ensure_org_search_indexes
from src.auth.dependencies import get_current_user
from src.chunker import create_chunks
from src.data_types import DATA_TYPE_ALIASES, canonicalize_data_type
from src.parser import parse_org_folder
from src.services.workspace_context import infer_service_context
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


def _source_metadata(org_slug: str, data_type: Optional[str], doc_id: Optional[str]) -> Dict:
    if not data_type or not doc_id:
        return {"updated_at": None, "size_bytes": None}

    canonical_type = canonicalize_data_type(data_type)
    if canonical_type == "images":
        rel_path = _resolve_image_file(org_slug, doc_id)
    else:
        source_name = Path(doc_id).name
        if not source_name.lower().endswith(".md"):
            source_name = f"{source_name}.md"
        rel_path = None
        for folder in DATA_TYPE_ALIASES.get(canonical_type or "", (canonical_type or "",)):
            candidate = f"{folder}/{source_name}"
            if exists(org_slug, candidate):
                rel_path = candidate
                break

    if not rel_path or not exists(org_slug, rel_path):
        return {"updated_at": None, "size_bytes": None}

    full_path = os.path.join(get_org_data_path(org_slug), rel_path)
    stat = os.stat(full_path) if os.path.exists(full_path) else None
    size_bytes = stat.st_size if stat else len(read_bytes(org_slug, rel_path))
    return {
        "updated_at": stat.st_mtime if stat else None,
        "size_bytes": size_bytes,
    }


def _list_image_items(
    org_slug: str,
    data_type: Optional[str],
    section_type: Optional[str],
    doc_id: Optional[str],
) -> List[Dict]:
    normalized_type = canonicalize_data_type(data_type) if data_type else None
    if normalized_type and normalized_type != "images":
        return []

    if section_type and section_type != "vision_summary":
        return []

    images_dir = os.path.join(get_org_data_path(org_slug), "images")
    items: List[Dict] = []
    for rel_path, payload in iter_files(org_slug, suffixes=IMAGE_EXTS):
        if not rel_path.startswith("images/"):
            continue
        fname = rel_path.split("/")[-1]

        if doc_id and doc_id != fname and doc_id != os.path.splitext(fname)[0]:
            continue

        full_path = os.path.join(get_org_data_path(org_slug), rel_path)
        stat = os.stat(full_path) if os.path.exists(full_path) else None
        image_context = infer_service_context(
            data_type="images",
            title=os.path.splitext(fname)[0].replace("_", " ").replace("-", " ").strip(),
            source_file=rel_path,
            text="",
            section_type="vision_summary",
        )
        items.append({
            "doc_id": fname,
            "data_type": "images",
            "section_type": "vision_summary",
            "text": "",
            "service": image_context["service"],
            "service_confidence": image_context["service_confidence"],
            "source_file": rel_path,
            "source_updated_at": stat.st_mtime if stat else None,
            "source_size_bytes": len(payload),
            "is_image": True,
            "image_path": f"/evidence/image/{fname}",
            "updated_at": stat.st_mtime if stat else None,
            "size_bytes": len(payload),
        })

    return items


def _file_fallback_chunks(org_slug: str, org_id: int) -> List[Dict]:
    docs = parse_org_folder(org_slug=org_slug, org_id=org_id)
    return create_chunks(docs) if docs else []


@router.get("", response_model=Dict)
def list_evidence(
    data_type: Optional[str] = Query(None),
    section_type: Optional[str] = Query(None),
    doc_id: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "evidence")
    org_slug = user["org_slug"]
    limit = max(1, min(limit, 100))
    data_type = canonicalize_data_type(data_type) if data_type else None
    query_text = (q or "").strip().lower()

    try:
        store, _, _ = ensure_org_search_indexes(org_slug, user["org_id"])
        chunks = store.chunks
    except Exception:
        chunks = _file_fallback_chunks(org_slug, user["org_id"])

    filtered: List[Dict] = []

    for chunk in chunks:
        chunk_type = canonicalize_data_type(chunk.get("data_type")) or chunk.get("data_type")
        if data_type and chunk_type != data_type:
            continue
        if section_type and chunk.get("section_type") != section_type:
            continue
        if doc_id and chunk.get("doc_id") != doc_id:
            continue
        if query_text:
            searchable = " ".join(
                str(value or "")
                for value in (
                    chunk.get("doc_id"),
                    chunk_type,
                    chunk.get("section_type"),
                    chunk.get("text"),
                )
            ).lower()
            if query_text not in searchable:
                continue

        source_meta = _source_metadata(
            org_slug,
            chunk.get("data_type"),
            chunk.get("doc_id"),
        )
        item = {
            "doc_id": chunk.get("doc_id"),
            "data_type": chunk_type,
            "section_type": chunk.get("section_type"),
            "text": chunk.get("text"),
            "service": chunk.get("service") or chunk.get("metadata", {}).get("service"),
            "service_confidence": chunk.get("service_confidence") or chunk.get("metadata", {}).get("service_confidence", 0.0),
            "source_file": chunk.get("metadata", {}).get("source_file"),
            "source_updated_at": chunk.get("source_updated_at") or chunk.get("metadata", {}).get("source_updated_at"),
            "updated_at": source_meta["updated_at"],
            "size_bytes": source_meta["size_bytes"],
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
            if query_text:
                searchable = " ".join(
                    str(value or "")
                    for value in (
                        image_item.get("doc_id"),
                        image_item.get("data_type"),
                        image_item.get("section_type"),
                    )
                ).lower()
                if query_text not in searchable:
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

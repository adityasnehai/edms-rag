import os
import base64
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile

from src.api.index_manager import get_index_metadata
from src.auth.dependencies import require_admin
from src.auth.models import get_organization_by_id, rotate_invite_code
from src.data_types import DATA_TYPE_ALIASES, canonicalize_data_type
from src.ingestion.job_store import (
    get_ingestion_job,
    latest_completed_uploads_by_data_type,
    list_ingestion_jobs,
)
from src.ingestion.pipeline import enqueue_ingestion_job
from src.runtime_config import (
    INGESTION_MAX_FILE_SIZE_BYTES,
    ORG_MAX_FILES,
    ORG_MAX_STORAGE_BYTES,
    UPLOAD_MAX_FILES_PER_REQUEST,
)
from src.storage import delete_file, exists, iter_files, org_storage_stats, read_bytes, write_bytes
from src.tenancy import ensure_org_directories, get_org_data_path
from src.telemetry import log_event, stage_timer
from src.traffic_control import enforce_rate_limit, request_capacity_guard

router = APIRouter(prefix="/admin", tags=["admin"])

ALLOWED_TEXT_TYPES = {
    "adrs",
    "rfcs",
    "meeting_notes",
    "postmortems",
    "tickets",
}

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg"}
ALLOWED_TEXT_CONTENT_TYPES = {"text/markdown", "text/plain", "application/octet-stream"}
ALLOWED_IMAGE_CONTENT_TYPES = {"image/png", "image/jpeg"}
MANAGED_DATA_TYPES = ALLOWED_TEXT_TYPES | {"images"}


def _get_admin_org(admin: dict) -> dict:
    organization = get_organization_by_id(admin["org_id"])
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    ensure_org_directories(organization["slug"])
    return organization


def _looks_like_upload(value) -> bool:
    return hasattr(value, "filename") and hasattr(value, "file")


def _sanitize_filename(filename: str) -> str:
    clean_name = Path((filename or "").strip()).name
    if not clean_name or clean_name in {".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid filename")
    return clean_name


def _read_upload_bytes(upload: UploadFile) -> bytes:
    payload = upload.file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="Empty files are not allowed")
    if len(payload) > INGESTION_MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Each file must be smaller than "
                f"{INGESTION_MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB"
            ),
        )
    return payload


def _validate_data_type(data_type: str) -> str:
    canonical = canonicalize_data_type(data_type)
    if canonical not in MANAGED_DATA_TYPES:
        raise HTTPException(status_code=400, detail="Invalid data type")
    return canonical


def _relative_file_path(data_type: str, filename: str) -> str:
    canonical = _validate_data_type(data_type)
    return f"{DATA_TYPE_ALIASES[canonical][0]}/{_sanitize_filename(filename)}"


def _resolve_existing_relative_path(org_slug: str, data_type: str, filename: str) -> str | None:
    canonical = _validate_data_type(data_type)
    clean_filename = _sanitize_filename(filename)
    for folder in DATA_TYPE_ALIASES.get(canonical, (canonical,)):
        rel_path = f"{folder}/{clean_filename}"
        if exists(org_slug, rel_path):
            return rel_path
    return None


def _validate_payload_for_type(data_type: str, upload: UploadFile) -> tuple[str, bytes]:
    filename = _sanitize_filename(upload.filename or "")
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    content_type = (upload.content_type or "").lower()
    payload = _read_upload_bytes(upload)

    if data_type == "images":
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Only PNG and JPEG images are allowed")
        if content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
            raise HTTPException(status_code=400, detail="Invalid image content type")
        return filename, payload

    if ext != "md":
        raise HTTPException(status_code=400, detail="Only .md files allowed")
    if content_type not in ALLOWED_TEXT_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid markdown content type")
    if b"\x00" in payload:
        raise HTTPException(status_code=400, detail="Binary files are not allowed for markdown uploads")
    return filename, payload


def _file_record(org_slug: str, rel_path: str, payload: bytes) -> dict | None:
    parts = rel_path.split("/")
    if len(parts) < 2:
        return None
    data_type = canonicalize_data_type(parts[0]) or parts[0]
    filename = parts[-1]
    if data_type not in MANAGED_DATA_TYPES:
        return None
    if data_type == "images" and not filename.lower().endswith((".png", ".jpg", ".jpeg")):
        return None
    if data_type != "images" and not filename.lower().endswith(".md"):
        return None

    full_path = os.path.join(get_org_data_path(org_slug), rel_path)
    stat = os.stat(full_path) if os.path.exists(full_path) else None
    return {
        "id": rel_path,
        "data_type": data_type,
        "filename": filename,
        "path": rel_path,
        "size_bytes": len(payload),
        "updated_at": stat.st_mtime if stat else None,
    }


@router.get("/organization")
def get_admin_organization(admin=Depends(require_admin)):
    organization = _get_admin_org(admin)
    return {
        "organization": {
            "id": organization["id"],
            "name": organization["name"],
            "slug": organization["slug"],
        },
        "invite_code": organization["invite_code"],
    }


@router.post("/organization/invite-code/rotate")
def rotate_organization_invite_code(admin=Depends(require_admin)):
    organization = rotate_invite_code(admin["org_id"])
    return {
        "organization": {
            "id": organization["id"],
            "name": organization["name"],
            "slug": organization["slug"],
        },
        "invite_code": organization["invite_code"],
    }


@router.get("/ingestion/jobs")
def list_admin_ingestion_jobs(limit: int = 10, admin=Depends(require_admin)):
    organization = _get_admin_org(admin)
    return {
        "items": list_ingestion_jobs(organization["id"], limit=max(1, min(limit, 25))),
    }


@router.get("/ingestion/jobs/{job_id}")
def get_admin_ingestion_job(job_id: str, admin=Depends(require_admin)):
    organization = _get_admin_org(admin)
    job = get_ingestion_job(job_id, organization["id"])
    if not job:
        raise HTTPException(status_code=404, detail="Ingestion job not found")
    return job


@router.get("/ingestion/data-types")
def get_admin_data_type_summary(admin=Depends(require_admin)):
    organization = _get_admin_org(admin)
    return {
        "items": latest_completed_uploads_by_data_type(organization["id"]),
    }


@router.get("/data/files")
def list_admin_data_files(
    data_type: str | None = Query(None),
    q: str | None = Query(None),
    admin=Depends(require_admin),
):
    organization = _get_admin_org(admin)
    selected_type = _validate_data_type(data_type) if data_type else None
    query_text = (q or "").strip().lower()
    items = []

    for rel_path, payload in iter_files(
        organization["slug"],
        suffixes=(".md", ".png", ".jpg", ".jpeg"),
    ):
        record = _file_record(organization["slug"], rel_path, payload)
        if not record:
            continue
        if selected_type and record["data_type"] != selected_type:
            continue
        searchable = f"{record['filename']} {record['data_type']}".lower()
        if query_text and query_text not in searchable:
            continue
        items.append(record)

    items.sort(key=lambda item: (item["data_type"], item["filename"].lower()))
    return {"items": items}


@router.get("/data/files/preview")
def preview_admin_data_file(
    data_type: str = Query(...),
    filename: str = Query(...),
    admin=Depends(require_admin),
):
    organization = _get_admin_org(admin)
    data_type = _validate_data_type(data_type)
    filename = _sanitize_filename(filename)
    rel_path = _resolve_existing_relative_path(organization["slug"], data_type, filename)
    if not rel_path:
        raise HTTPException(status_code=404, detail="File not found")

    payload = read_bytes(organization["slug"], rel_path)
    record = _file_record(organization["slug"], rel_path, payload)
    if not record:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    if data_type == "images":
        ext = filename.rsplit(".", 1)[-1].lower()
        mime_type = "image/png" if ext == "png" else "image/jpeg"
        return {
            "file": record,
            "preview_type": "image",
            "mime_type": mime_type,
            "content": base64.b64encode(payload).decode("ascii"),
        }

    return {
        "file": record,
        "preview_type": "text",
        "mime_type": "text/markdown",
        "content": payload.decode("utf-8", errors="replace"),
    }


@router.post("/data/files/replace")
async def replace_admin_data_file(
    data_type: str = Form(...),
    filename: str = Form(...),
    file: UploadFile = File(...),
    admin=Depends(require_admin),
):
    organization = _get_admin_org(admin)
    enforce_rate_limit(f"org:{organization['id']}:user:{admin['id']}", "upload")
    data_type = _validate_data_type(data_type)
    current_filename = _sanitize_filename(filename)
    replacement_filename, payload = _validate_payload_for_type(data_type, file)

    if replacement_filename.lower() != current_filename.lower():
        raise HTTPException(status_code=400, detail="Replacement file must use the same filename")

    rel_path = _resolve_existing_relative_path(organization["slug"], data_type, current_filename)
    if not rel_path:
        raise HTTPException(status_code=404, detail="File not found")

    usage = org_storage_stats(organization["slug"])
    current_size = len(read_bytes(organization["slug"], rel_path))
    projected_size = usage["total_bytes"] - current_size + len(payload)
    if projected_size > ORG_MAX_STORAGE_BYTES:
        raise HTTPException(status_code=400, detail="Organization storage quota exceeded")

    write_bytes(organization["slug"], rel_path, payload)
    if data_type == "images":
        delete_file(organization["slug"], f"{rel_path}.txt")

    job = enqueue_ingestion_job(
        org_id=organization["id"],
        org_slug=organization["slug"],
        trigger_source="replace",
        data_type=data_type,
        uploaded_files=[current_filename],
    )
    log_event(20, "data_file_replace_queued", route="/admin/data/files/replace", user_id=admin["id"], org_id=organization["id"], org_slug=organization["slug"], job_id=job["id"])
    return {"status": "queued", "file": current_filename, "data_type": data_type, "job": job}


@router.delete("/data/files")
def delete_admin_data_file(
    data_type: str = Query(...),
    filename: str = Query(...),
    admin=Depends(require_admin),
):
    organization = _get_admin_org(admin)
    enforce_rate_limit(f"org:{organization['id']}:user:{admin['id']}", "upload")
    data_type = _validate_data_type(data_type)
    filename = _sanitize_filename(filename)
    rel_path = _resolve_existing_relative_path(organization["slug"], data_type, filename)
    if not rel_path:
        raise HTTPException(status_code=404, detail="File not found")

    delete_file(organization["slug"], rel_path)
    if data_type == "images":
        delete_file(organization["slug"], f"{rel_path}.txt")

    job = enqueue_ingestion_job(
        org_id=organization["id"],
        org_slug=organization["slug"],
        trigger_source="delete",
        data_type=data_type,
        uploaded_files=[filename],
    )
    log_event(20, "data_file_delete_queued", route="/admin/data/files", user_id=admin["id"], org_id=organization["id"], org_slug=organization["slug"], job_id=job["id"])
    return {"status": "queued", "file": filename, "data_type": data_type, "job": job}


@router.post("/upload")
async def upload_document(
    request: Request,
    data_type: str = Form(...),
    admin=Depends(require_admin),
):
    organization = _get_admin_org(admin)
    enforce_rate_limit(f"org:{organization['id']}:user:{admin['id']}", "upload")
    data_type = _validate_data_type(data_type)
    org_path = get_org_data_path(organization["slug"])
    form = await request.form()
    uploads: List[UploadFile] = [
        item for item in form.getlist("files") if _looks_like_upload(item)
    ]

    legacy_upload = form.get("file")
    if _looks_like_upload(legacy_upload):
        uploads.append(legacy_upload)

    if not uploads:
        raise HTTPException(status_code=400, detail="No files uploaded")
    if len(uploads) > UPLOAD_MAX_FILES_PER_REQUEST:
        raise HTTPException(status_code=400, detail=f"Too many files. Max {UPLOAD_MAX_FILES_PER_REQUEST} per upload")

    usage = org_storage_stats(organization["slug"])
    if usage["file_count"] + len(uploads) > ORG_MAX_FILES:
        raise HTTPException(status_code=400, detail="Organization file quota exceeded")

    seen_names = set()

    with request_capacity_guard(), stage_timer("admin_upload_validation", route="/admin/upload", user_id=admin["id"], org_id=organization["id"], org_slug=organization["slug"]):
        if data_type == "images":
            saved_files: List[str] = []
            for image_file in uploads:
                filename = _sanitize_filename(image_file.filename or "")
                if filename.lower() in seen_names:
                    raise HTTPException(status_code=400, detail="Duplicate filenames in the same upload are not allowed")
                seen_names.add(filename.lower())
                ext = filename.split(".")[-1].lower() if "." in filename else ""
                if ext not in ALLOWED_IMAGE_EXTENSIONS:
                    raise HTTPException(
                        status_code=400,
                        detail="Only PNG and JPEG images are allowed",
                    )
                if (image_file.content_type or "").lower() not in ALLOWED_IMAGE_CONTENT_TYPES:
                    raise HTTPException(status_code=400, detail="Invalid image content type")
                image_bytes = _read_upload_bytes(image_file)
                usage["total_bytes"] += len(image_bytes)
                if usage["total_bytes"] > ORG_MAX_STORAGE_BYTES:
                    raise HTTPException(status_code=400, detail="Organization storage quota exceeded")

                write_bytes(organization["slug"], f"images/{filename}", image_bytes)
                saved_files.append(filename)

            job = enqueue_ingestion_job(
                org_id=organization["id"],
                org_slug=organization["slug"],
                trigger_source="upload",
                data_type=data_type,
                uploaded_files=saved_files,
            )
            meta = get_index_metadata(organization["slug"])
            log_event(20, "upload_queued", route="/admin/upload", user_id=admin["id"], org_id=organization["id"], org_slug=organization["slug"], job_id=job["id"])

            return {
                "status": "queued",
                "type": "image",
                "file": saved_files[0] if len(saved_files) == 1 else None,
                "organization": organization["name"],
                "uploaded_count": len(saved_files),
                "files": saved_files,
                "job": job,
                "index_status": meta["status"],
                "pipeline_status": meta.get("pipeline_status"),
                "last_rebuild": meta["last_rebuild"],
                "total_chunks": meta["total_chunks"],
                "embedding_model": meta["embedding_model"],
            }

        if data_type not in ALLOWED_TEXT_TYPES:
            raise HTTPException(status_code=400, detail="Invalid data type")

        save_dir = os.path.join(org_path, data_type)
        os.makedirs(save_dir, exist_ok=True)

        saved_files: List[str] = []
        for upload in uploads:
            filename = _sanitize_filename(upload.filename or "")
            if filename.lower() in seen_names:
                raise HTTPException(status_code=400, detail="Duplicate filenames in the same upload are not allowed")
            seen_names.add(filename.lower())
            ext = filename.split(".")[-1].lower() if "." in filename else ""
            if ext != "md":
                raise HTTPException(status_code=400, detail="Only .md files allowed")
            if (upload.content_type or "").lower() not in ALLOWED_TEXT_CONTENT_TYPES:
                raise HTTPException(status_code=400, detail="Invalid markdown content type")
            payload = _read_upload_bytes(upload)
            if b"\x00" in payload:
                raise HTTPException(status_code=400, detail="Binary files are not allowed for markdown uploads")
            usage["total_bytes"] += len(payload)
            if usage["total_bytes"] > ORG_MAX_STORAGE_BYTES:
                raise HTTPException(status_code=400, detail="Organization storage quota exceeded")

            write_bytes(organization["slug"], f"{data_type}/{filename}", payload)
            saved_files.append(filename)

        job = enqueue_ingestion_job(
            org_id=organization["id"],
            org_slug=organization["slug"],
            trigger_source="upload",
            data_type=data_type,
            uploaded_files=saved_files,
        )
        meta = get_index_metadata(organization["slug"])
        log_event(20, "upload_queued", route="/admin/upload", user_id=admin["id"], org_id=organization["id"], org_slug=organization["slug"], job_id=job["id"])

        return {
            "status": "queued",
            "file": saved_files[0] if len(saved_files) == 1 else None,
            "files": saved_files,
            "uploaded_count": len(saved_files),
            "data_type": data_type,
            "organization": organization["name"],
            "job": job,
            "index_status": meta["status"],
            "pipeline_status": meta.get("pipeline_status"),
            "last_rebuild": meta["last_rebuild"],
            "total_chunks": meta["total_chunks"],
            "embedding_model": meta["embedding_model"],
        }

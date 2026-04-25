import os
from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, Form, HTTPException, Request, UploadFile

from src.api.index_manager import get_index_metadata
from src.auth.dependencies import require_admin
from src.auth.models import get_organization_by_id, rotate_invite_code
from src.ingestion.job_store import get_ingestion_job, list_ingestion_jobs
from src.ingestion.pipeline import enqueue_ingestion_job
from src.runtime_config import (
    INGESTION_MAX_FILE_SIZE_BYTES,
    ORG_MAX_FILES,
    ORG_MAX_STORAGE_BYTES,
    UPLOAD_MAX_FILES_PER_REQUEST,
)
from src.storage import org_storage_stats, write_bytes
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


@router.post("/upload")
async def upload_document(
    request: Request,
    data_type: str = Form(...),
    admin=Depends(require_admin),
):
    organization = _get_admin_org(admin)
    enforce_rate_limit(f"org:{organization['id']}:user:{admin['id']}", "upload")
    data_type = (data_type or "").strip().lower()
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
            if len(uploads) != 1:
                raise HTTPException(
                    status_code=400,
                    detail="Upload one image at a time for image data",
                )

            image_file = uploads[0]
            filename = _sanitize_filename(image_file.filename or "")
            ext = filename.split(".")[-1].lower() if "." in filename else ""
            if ext not in ALLOWED_IMAGE_EXTENSIONS:
                raise HTTPException(
                    status_code=400,
                    detail="Only PNG and JPEG images are allowed",
                )
            if (image_file.content_type or "").lower() not in ALLOWED_IMAGE_CONTENT_TYPES:
                raise HTTPException(status_code=400, detail="Invalid image content type")
            image_bytes = _read_upload_bytes(image_file)
            if usage["total_bytes"] + len(image_bytes) > ORG_MAX_STORAGE_BYTES:
                raise HTTPException(status_code=400, detail="Organization storage quota exceeded")

            write_bytes(organization["slug"], f"images/{filename}", image_bytes)

            job = enqueue_ingestion_job(
                org_id=organization["id"],
                org_slug=organization["slug"],
                trigger_source="upload",
                data_type=data_type,
                uploaded_files=[filename],
            )
            meta = get_index_metadata(organization["slug"])
            log_event(20, "upload_queued", route="/admin/upload", user_id=admin["id"], org_id=organization["id"], org_slug=organization["slug"], job_id=job["id"])

            return {
                "status": "queued",
                "type": "image",
                "file": filename,
                "organization": organization["name"],
                "uploaded_count": 1,
                "files": [filename],
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

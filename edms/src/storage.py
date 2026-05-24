import io
import os
from pathlib import Path
from typing import Iterable

from src.runtime_config import (
    OBJECT_STORAGE_BACKEND,
    PRODUCTION_MODE,
    S3_ACCESS_KEY_ID,
    S3_BUCKET,
    S3_ENDPOINT_URL,
    S3_PREFIX,
    S3_REGION,
    S3_SECRET_ACCESS_KEY,
)
from src.tenancy import CONTENT_FOLDERS, get_org_data_path


TEXT_EXTENSIONS = (".md", ".txt")
IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg")


def _s3_enabled() -> bool:
    return OBJECT_STORAGE_BACKEND == "s3" and bool(S3_BUCKET)


def _object_key(org_slug: str, relative_path: str) -> str:
    rel = relative_path.strip("/").replace("\\", "/")
    prefix = f"{S3_PREFIX}/" if S3_PREFIX else ""
    return f"{prefix}orgs/{org_slug}/{rel}"


def _get_s3_client():
    if not _s3_enabled():
        return None
    try:
        import boto3
    except ImportError as exc:
        raise RuntimeError("boto3 is required for S3 object storage") from exc

    return boto3.client(
        "s3",
        region_name=S3_REGION or None,
        endpoint_url=S3_ENDPOINT_URL or None,
        aws_access_key_id=S3_ACCESS_KEY_ID or None,
        aws_secret_access_key=S3_SECRET_ACCESS_KEY or None,
    )


def ensure_org_storage(org_slug: str) -> str:
    org_path = get_org_data_path(org_slug)
    os.makedirs(org_path, exist_ok=True)
    for folder in CONTENT_FOLDERS:
        os.makedirs(os.path.join(org_path, folder), exist_ok=True)
    os.makedirs(os.path.join(org_path, ".system"), exist_ok=True)
    return org_path


def write_bytes(org_slug: str, relative_path: str, payload: bytes) -> str:
    base_path = ensure_org_storage(org_slug)
    full_path = os.path.join(base_path, relative_path)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, "wb") as handle:
        handle.write(payload)

    if _s3_enabled():
        client = _get_s3_client()
        client.put_object(Bucket=S3_BUCKET, Key=_object_key(org_slug, relative_path), Body=payload)

    return full_path


def write_text(org_slug: str, relative_path: str, text: str) -> str:
    return write_bytes(org_slug, relative_path, text.encode("utf-8"))


def read_bytes(org_slug: str, relative_path: str) -> bytes:
    full_path = os.path.join(get_org_data_path(org_slug), relative_path)
    if os.path.exists(full_path):
        with open(full_path, "rb") as handle:
            return handle.read()

    if _s3_enabled():
        client = _get_s3_client()
        response = client.get_object(Bucket=S3_BUCKET, Key=_object_key(org_slug, relative_path))
        data = response["Body"].read()
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        with open(full_path, "wb") as handle:
            handle.write(data)
        return data

    raise FileNotFoundError(relative_path)


def read_text(org_slug: str, relative_path: str) -> str:
    return read_bytes(org_slug, relative_path).decode("utf-8", errors="ignore")


def delete_file(org_slug: str, relative_path: str) -> None:
    full_path = os.path.join(get_org_data_path(org_slug), relative_path)
    if os.path.exists(full_path):
        os.remove(full_path)

    if _s3_enabled():
        client = _get_s3_client()
        client.delete_object(Bucket=S3_BUCKET, Key=_object_key(org_slug, relative_path))


def exists(org_slug: str, relative_path: str) -> bool:
    full_path = os.path.join(get_org_data_path(org_slug), relative_path)
    if os.path.exists(full_path):
        return True
    if not _s3_enabled():
        return False
    client = _get_s3_client()
    try:
        client.head_object(Bucket=S3_BUCKET, Key=_object_key(org_slug, relative_path))
        return True
    except Exception:
        return False


def iter_files(org_slug: str, suffixes: tuple[str, ...] | None = None) -> Iterable[tuple[str, bytes]]:
    base_path = ensure_org_storage(org_slug)
    yielded = set()

    for root, _, files in os.walk(base_path):
        for filename in files:
            rel_path = os.path.relpath(os.path.join(root, filename), base_path)
            if suffixes and not rel_path.lower().endswith(tuple(ext.lower() for ext in suffixes)):
                continue
            yielded.add(rel_path.replace("\\", "/"))
            with open(os.path.join(root, filename), "rb") as handle:
                yield rel_path.replace("\\", "/"), handle.read()

    if not _s3_enabled():
        return

    client = _get_s3_client()
    prefix = _object_key(org_slug, "")
    continuation_token = None
    while True:
        kwargs = {"Bucket": S3_BUCKET, "Prefix": prefix}
        if continuation_token:
            kwargs["ContinuationToken"] = continuation_token
        response = client.list_objects_v2(**kwargs)
        for item in response.get("Contents", []):
            key = item["Key"]
            rel_path = key[len(prefix) :].lstrip("/")
            if not rel_path or rel_path in yielded:
                continue
            if suffixes and not rel_path.lower().endswith(tuple(ext.lower() for ext in suffixes)):
                continue
            body = client.get_object(Bucket=S3_BUCKET, Key=key)["Body"].read()
            local_path = os.path.join(base_path, rel_path)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as handle:
                handle.write(body)
            yield rel_path, body
        if not response.get("IsTruncated"):
            break
        continuation_token = response.get("NextContinuationToken")


def iter_file_metadata(org_slug: str, suffixes: tuple[str, ...] | None = None) -> Iterable[tuple[str, int]]:
    """Yield (rel_path, size_bytes) without reading file contents."""
    base_path = ensure_org_storage(org_slug)
    yielded = set()

    for root, _, files in os.walk(base_path):
        for filename in files:
            rel_path = os.path.relpath(os.path.join(root, filename), base_path).replace("\\", "/")
            if suffixes and not rel_path.lower().endswith(tuple(ext.lower() for ext in suffixes)):
                continue
            yielded.add(rel_path)
            size = os.path.getsize(os.path.join(root, filename))
            yield rel_path, size

    if not _s3_enabled():
        return

    client = _get_s3_client()
    prefix = _object_key(org_slug, "")
    continuation_token = None
    while True:
        kwargs = {"Bucket": S3_BUCKET, "Prefix": prefix}
        if continuation_token:
            kwargs["ContinuationToken"] = continuation_token
        response = client.list_objects_v2(**kwargs)
        for item in response.get("Contents", []):
            key = item["Key"]
            rel_path = key[len(prefix):].lstrip("/")
            if not rel_path or rel_path in yielded:
                continue
            if suffixes and not rel_path.lower().endswith(tuple(ext.lower() for ext in suffixes)):
                continue
            yield rel_path, item["Size"]
        if not response.get("IsTruncated"):
            break
        continuation_token = response.get("NextContinuationToken")


def org_storage_stats(org_slug: str) -> dict:
    total_files = 0
    total_bytes = 0
    for _, payload in iter_files(org_slug):
        total_files += 1
        total_bytes += len(payload)
    return {"file_count": total_files, "total_bytes": total_bytes}


def validate_production_storage() -> None:
    if PRODUCTION_MODE and OBJECT_STORAGE_BACKEND != "s3":
        raise RuntimeError("Production requires OBJECT_STORAGE_BACKEND=s3")
    if PRODUCTION_MODE and OBJECT_STORAGE_BACKEND == "s3" and not S3_BUCKET:
        raise RuntimeError("Production requires S3_BUCKET")

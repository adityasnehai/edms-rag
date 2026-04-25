import json
import os
from datetime import datetime
from typing import Dict, Iterable, Tuple

from src.cache_store import stable_hash
from src.storage import iter_files, read_bytes, write_text, delete_file, exists, ensure_org_storage
from src.tenancy import get_org_data_path

INDEXABLE_EXTENSIONS = (".md", ".txt")
SYSTEM_DIR_NAME = ".system"
MANIFEST_FILE_NAME = "ingestion_manifest.json"


def _system_dir(org_slug: str) -> str:
    path = os.path.join(get_org_data_path(org_slug), SYSTEM_DIR_NAME)
    os.makedirs(path, exist_ok=True)
    return path


def _manifest_path(org_slug: str) -> str:
    return os.path.join(_system_dir(org_slug), MANIFEST_FILE_NAME)


def build_source_manifest(org_slug: str) -> Dict:
    files: Dict[str, Dict] = {}
    base_dir = ensure_org_storage(org_slug)
    for rel_path, payload in iter_files(org_slug, suffixes=INDEXABLE_EXTENSIONS):
        if rel_path.startswith(f"{SYSTEM_DIR_NAME}/"):
            continue
        stat_path = os.path.join(base_dir, rel_path)
        stat = os.stat(stat_path)
        files[rel_path] = {
            "hash": stable_hash(payload.decode("utf-8", errors="ignore")),
            "size": stat.st_size,
            "mtime": stat.st_mtime,
        }

    return {
        "org_slug": org_slug,
        "generated_at": datetime.utcnow().isoformat(),
        "files": files,
    }


def load_source_manifest(org_slug: str) -> Dict:
    rel_path = f"{SYSTEM_DIR_NAME}/{MANIFEST_FILE_NAME}"
    if not exists(org_slug, rel_path):
        return {"org_slug": org_slug, "generated_at": None, "files": {}}

    try:
        payload = json.loads(read_bytes(org_slug, rel_path).decode("utf-8"))
        files = payload.get("files")
        return {
            "org_slug": org_slug,
            "generated_at": payload.get("generated_at"),
            "files": files if isinstance(files, dict) else {},
        }
    except Exception:
        return {"org_slug": org_slug, "generated_at": None, "files": {}}


def save_source_manifest(org_slug: str, manifest: Dict) -> None:
    write_text(
        org_slug,
        f"{SYSTEM_DIR_NAME}/{MANIFEST_FILE_NAME}",
        json.dumps(manifest, ensure_ascii=True, indent=2),
    )


def clear_source_manifest(org_slug: str) -> None:
    delete_file(org_slug, f"{SYSTEM_DIR_NAME}/{MANIFEST_FILE_NAME}")


def diff_source_manifests(previous: Dict, current: Dict) -> Dict:
    previous_files = previous.get("files") or {}
    current_files = current.get("files") or {}

    previous_keys = set(previous_files.keys())
    current_keys = set(current_files.keys())

    added = sorted(current_keys - previous_keys)
    removed = sorted(previous_keys - current_keys)
    changed = sorted(
        rel_path
        for rel_path in (current_keys & previous_keys)
        if current_files.get(rel_path, {}).get("hash") != previous_files.get(rel_path, {}).get("hash")
    )
    unchanged = sorted(current_keys - set(added) - set(changed))

    return {
        "added": added,
        "changed": changed,
        "removed": removed,
        "unchanged": unchanged,
        "touched": sorted(set(added) | set(changed)),
    }

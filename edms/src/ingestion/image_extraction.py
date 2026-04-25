import json
import os
from datetime import datetime
from typing import Dict

from src.multimodal.image_processor import extract_text_from_image
from src.cache_store import stable_hash
from src.storage import delete_file, exists, iter_files, read_bytes, write_text
from src.tenancy import get_org_data_path

IMAGE_EXTENSIONS = (".png", ".jpg", ".jpeg")
SYSTEM_DIR_NAME = ".system"
IMAGE_MANIFEST_FILE_NAME = "image_extraction_manifest.json"


def _system_dir(org_slug: str) -> str:
    path = os.path.join(get_org_data_path(org_slug), SYSTEM_DIR_NAME)
    os.makedirs(path, exist_ok=True)
    return path


def _manifest_path(org_slug: str) -> str:
    return os.path.join(_system_dir(org_slug), IMAGE_MANIFEST_FILE_NAME)


def _load_manifest(org_slug: str) -> Dict:
    rel_path = f"{SYSTEM_DIR_NAME}/{IMAGE_MANIFEST_FILE_NAME}"
    if not exists(org_slug, rel_path):
        return {"images": {}}

    try:
        payload = json.loads(read_bytes(org_slug, rel_path).decode("utf-8"))
        images = payload.get("images")
        return {"images": images if isinstance(images, dict) else {}}
    except Exception:
        return {"images": {}}


def _save_manifest(org_slug: str, manifest: Dict) -> None:
    write_text(
        org_slug,
        f"{SYSTEM_DIR_NAME}/{IMAGE_MANIFEST_FILE_NAME}",
        json.dumps(manifest, ensure_ascii=True, indent=2),
    )


def process_org_images(org_slug: str) -> Dict:
    images_dir = os.path.join(get_org_data_path(org_slug), "images")
    stats = {
        "seen": 0,
        "extracted": 0,
        "reused": 0,
        "failed": 0,
        "errors": [],
    }

    if not os.path.isdir(images_dir):
        return stats

    manifest = _load_manifest(org_slug)
    image_entries = manifest["images"]
    existing_images = set()
    for rel_path, payload in iter_files(org_slug, suffixes=IMAGE_EXTENSIONS):
        if not rel_path.startswith("images/"):
            continue
        filename = rel_path.split("/")[-1]
        existing_images.add(filename)

        stats["seen"] += 1
        image_path = os.path.join(images_dir, filename)
        text_rel_path = f"images/{filename}.txt"
        image_hash = stable_hash(payload)
        previous = image_entries.get(filename) or {}

        if previous.get("hash") == image_hash and exists(org_slug, text_rel_path):
            stats["reused"] += 1
            continue

        try:
            text = extract_text_from_image(image_path).strip()
            if not text:
                raise RuntimeError("No meaningful content extracted from image")
            write_text(org_slug, text_rel_path, text)
            image_entries[filename] = {
                "hash": image_hash,
                "text_file": os.path.basename(text_rel_path),
                "updated_at": datetime.utcnow().isoformat(),
            }
            stats["extracted"] += 1
        except Exception as exc:
            delete_file(org_slug, text_rel_path)
            image_entries.pop(filename, None)
            stats["failed"] += 1
            stats["errors"].append({
                "file": filename,
                "error": str(exc),
            })
    for filename in list(image_entries.keys()):
        if filename in existing_images:
            continue
        image_entries.pop(filename, None)
        delete_file(org_slug, f"images/{filename}.txt")

    _save_manifest(org_slug, manifest)
    return stats

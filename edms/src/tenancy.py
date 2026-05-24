import os
import re

DATA_ROOT = "data"
ORGS_ROOT = os.path.join(DATA_ROOT, "orgs")
CONTENT_FOLDERS = (
    "adrs",
    "rfcs",
    "meeting_notes",
    "postmortems",
    "tickets",
    "images",
)


def slugify_org_name(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (name or "").strip().lower()).strip("-")
    return slug or "organization"


def get_org_data_path(org_slug: str) -> str:
    return os.path.join(ORGS_ROOT, org_slug)


def ensure_org_directories(org_slug: str) -> str:
    org_path = get_org_data_path(org_slug)
    os.makedirs(org_path, exist_ok=True)
    for folder in CONTENT_FOLDERS:
        os.makedirs(os.path.join(org_path, folder), exist_ok=True)
    return org_path


def list_org_slugs() -> list[str]:
    if not os.path.isdir(ORGS_ROOT):
        return []

    return sorted(
        entry
        for entry in os.listdir(ORGS_ROOT)
        if os.path.isdir(os.path.join(ORGS_ROOT, entry))
    )

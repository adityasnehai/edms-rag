import os
import re
import shutil

DATA_ROOT = "data"
ORGS_ROOT = os.path.join(DATA_ROOT, "orgs")
LEGACY_ORG_SLUG = "acmetech"
LEGACY_ORG_NAME = "AcmeTech"
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


def migrate_legacy_org_data(org_slug: str = LEGACY_ORG_SLUG) -> str:
    os.makedirs(ORGS_ROOT, exist_ok=True)

    legacy_path = os.path.join(DATA_ROOT, LEGACY_ORG_SLUG)
    org_path = get_org_data_path(org_slug)

    if os.path.isdir(legacy_path) and not os.path.isdir(org_path):
        shutil.move(legacy_path, org_path)

    return ensure_org_directories(org_slug)


def list_org_slugs() -> list[str]:
    if not os.path.isdir(ORGS_ROOT):
        return []

    return sorted(
        entry
        for entry in os.listdir(ORGS_ROOT)
        if os.path.isdir(os.path.join(ORGS_ROOT, entry))
    )

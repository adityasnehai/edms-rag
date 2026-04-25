from fastapi import APIRouter, Depends

from src.api.index_manager import get_index_metadata
from src.auth.dependencies import get_current_user
from src.storage import iter_files
from src.traffic_control import enforce_rate_limit

router = APIRouter(prefix="/stats", tags=["stats"])

COUNTABLE_TYPES = {
    "adrs",
    "rfcs",
    "meeting_notes",
    "postmortems",
    "tickets",
    "images",
}


def count_documents(org_slug: str):
    counts = {k: 0 for k in COUNTABLE_TYPES}
    for rel_path, _ in iter_files(org_slug, suffixes=(".md", ".txt", ".png", ".jpg", ".jpeg")):
        folder = rel_path.split("/")[0]
        if folder not in counts:
            continue
        if folder == "images" and not rel_path.lower().endswith((".png", ".jpg", ".jpeg")):
            continue
        counts[folder] += 1

    return counts


@router.get("")
def stats(user=Depends(get_current_user)):
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "stats")
    org_slug = user["org_slug"]
    meta = get_index_metadata(org_slug)
    counts = count_documents(org_slug)

    return {
        "organization": user["org_name"],
        "adrs": counts["adrs"],
        "rfcs": counts["rfcs"],
        "postmortems": counts["postmortems"],
        "tickets": counts["tickets"],
        "images": counts["images"],
        "meeting_notes": counts["meeting_notes"],
        "index_status": meta["status"],
        "pipeline_status": meta.get("pipeline_status", "idle"),
        "last_job_id": meta.get("last_job_id"),
        "changed_files": meta.get("changed_files", 0),
        "removed_files": meta.get("removed_files", 0),
        "new_embeddings": meta.get("new_embeddings", 0),
        "cached_embeddings": meta.get("cached_embeddings", 0),
        "total_chunks": meta["total_chunks"],
        "last_rebuild": meta["last_rebuild"],
        "embedding_model": meta["embedding_model"],
    }

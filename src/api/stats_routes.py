import os
from fastapi import APIRouter, Depends
from src.auth.dependencies import get_current_user
from src.api.index_manager import get_index_metadata
from src.parser import ORG_DATA_PATH

router = APIRouter(prefix="/stats", tags=["stats"])

COUNTABLE_TYPES = {
    "adrs",
    "rfcs",
    "meeting_notes",
    "postmortems",
    "tickets",
    "images",
}


def count_documents(base_path: str = ORG_DATA_PATH):
    counts = {k: 0 for k in COUNTABLE_TYPES}
    image_exts = (".png", ".jpg", ".jpeg")

    for root, _, files in os.walk(base_path):
        if not files:
            continue

        rel = os.path.relpath(root, base_path)
        folder = rel.split(os.sep)[0]
        if folder not in counts:
            continue

        for fname in files:
            if folder == "images":
                if fname.endswith(image_exts):
                    counts[folder] += 1
            elif fname.endswith((".md", ".txt")):
                counts[folder] += 1

    return counts


@router.get("")
def stats(user=Depends(get_current_user)):
    meta = get_index_metadata()
    counts = count_documents()

    return {
        "adrs": counts["adrs"],
        "rfcs": counts["rfcs"],
        "incidents": counts["meeting_notes"],
        "postmortems": counts["postmortems"],
        "tickets": counts["tickets"],
        "images": counts["images"],
        "meeting_notes": counts["meeting_notes"],
        "index_status": meta["status"],
        "total_chunks": meta["total_chunks"],
        "last_rebuild": meta["last_rebuild"],
        "embedding_model": meta["embedding_model"],
    }

import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from src.api.index_manager import rebuild_vector_store

from src.auth.dependencies import require_admin
from src.parser import parse_org_folder
from src.chunker import create_chunks
from src.embedder import embed_chunks
from src.vector_store import VectorStore

router = APIRouter(prefix="/admin", tags=["admin"])

ORG_DATA_PATH = "data/acmetech"
ALLOWED_TYPES = {"adrs", "rfcs", "meeting_notes", "postmortems", "tickets"}


@router.post("/upload")
def upload_document(
    data_type: str = Form(...),
    file: UploadFile = File(...),
    admin=Depends(require_admin),
):
    if data_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Invalid data type")

    if not file.filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="Only .md files allowed")

    # Save file
    save_dir = os.path.join(ORG_DATA_PATH, data_type)
    os.makedirs(save_dir, exist_ok=True)

    file_path = os.path.join(save_dir, file.filename)
    with open(file_path, "wb") as f:
        f.write(file.file.read())

    rebuild_vector_store()

    return {
        "status": "uploaded",
        "file": file.filename,
        "data_type": data_type,
    }

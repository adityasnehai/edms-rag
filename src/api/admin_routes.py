import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends

from src.auth.dependencies import require_admin
from src.api.index_manager import rebuild_vector_store
from src.multimodal.image_processor import extract_text_from_image

router = APIRouter(prefix="/admin", tags=["admin"])

ORG_DATA_PATH = "data/acmetech"

ALLOWED_TEXT_TYPES = {
    "adrs",
    "rfcs",
    "meeting_notes",
    "postmortems",
    "tickets",
}

ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg"}


@router.post("/upload")
def upload_document(
    data_type: str = Form(...),
    file: UploadFile = File(...),
    admin=Depends(require_admin),
):
    filename = file.filename
    ext = filename.split(".")[-1].lower()

    # ============================
    # IMAGE UPLOAD (MULTIMODAL)
    # ============================
    if ext in ALLOWED_IMAGE_EXTENSIONS:
        save_dir = os.path.join(ORG_DATA_PATH, "images")
        os.makedirs(save_dir, exist_ok=True)

        image_path = os.path.join(save_dir, filename)
        with open(image_path, "wb") as f:
            f.write(file.file.read())

        # Vision-LLM reasoning
        text = extract_text_from_image(image_path)
        if not text.strip():
            raise HTTPException(
                status_code=400,
                detail="No meaningful content extracted from image"
            )

        # Save vision output as pseudo-document
        text_path = image_path + ".txt"
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(text)

        rebuild_vector_store()

        return {
            "status": "uploaded",
            "type": "image",
            "file": filename,
        }

    # ============================
    # TEXT DOCUMENT UPLOAD
    # ============================
    if data_type not in ALLOWED_TEXT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid data type")

    if ext != "md":
        raise HTTPException(status_code=400, detail="Only .md files allowed")

    save_dir = os.path.join(ORG_DATA_PATH, data_type)
    os.makedirs(save_dir, exist_ok=True)

    file_path = os.path.join(save_dir, filename)
    with open(file_path, "wb") as f:
        f.write(file.file.read())

    rebuild_vector_store()

    return {
        "status": "uploaded",
        "file": filename,
        "data_type": data_type,
    }

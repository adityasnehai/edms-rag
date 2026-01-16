from fastapi import FastAPI, Query, Depends
from typing import Dict

from src.api.auth_routes import router as auth_router
from src.api.admin_routes import router as admin_router
from src.auth.dependencies import get_current_user
from src.api.index_manager import rebuild_vector_store, get_vector_store

from src.retriever import retrieve_chunks
from src.generator import generate_answer


app = FastAPI(
    title="EDMS API",
    description="Enterprise Decision Memory System",
    version="0.1.0",
)

# Register routers
app.include_router(auth_router)
app.include_router(admin_router)


# ---------
# Startup: build vector index ONCE
# ---------
@app.on_event("startup")
def startup_event():
    rebuild_vector_store()


# ---------
# Health check
# ---------
@app.get("/")
def health():
    return {"status": "EDMS API is running"}


# ---------
# Search endpoint (protected)
# ---------
@app.get("/search")
def search(
    q: str = Query(..., description="Search question"),
    user=Depends(get_current_user),
) -> Dict:
    store = get_vector_store()
    retrieved = retrieve_chunks(q, store, top_k=5)
    result = generate_answer(q, retrieved)

    return {
        "query": q,
        "answer": result["answer"],
        "evidence": [
            {
                "doc_id": c["doc_id"],
                "data_type": c["data_type"],
                "section_type": c["section_type"],
                "text": c["text"],
            }
            for c in result["evidence"]
        ],
    }

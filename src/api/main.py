from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.requests import Request
from fastapi.staticfiles import StaticFiles
from typing import Dict
import os
from fastapi.staticfiles import StaticFiles
# -------------------------
# CREATE APP FIRST
# -------------------------
app = FastAPI(
    title="EDMS API",
    description="Enterprise Decision Memory System",
    version="0.1.0",
)

# -------------------------
# CORS
# -------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://ornate-bubblegum-418696.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# -------------------------
# GLOBAL ERROR HANDLER
# -------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print("UNHANDLED ERROR:", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# -------------------------
# STATIC FILES (IMAGES)
# -------------------------
IMAGE_DIR = "data/acmetech/images"

if os.path.exists(IMAGE_DIR):
    app.mount(
        "/static/images",
        StaticFiles(directory=IMAGE_DIR),
        name="images",
    )
# -------------------------
# IMPORT ROUTERS (AFTER APP)
# -------------------------
from src.api.auth_routes import router as auth_router
from src.api.admin_routes import router as admin_router
from src.api.chat_routes import router as chat_router
from src.api.evidence_routes import router as evidence_router
from src.api.stats_routes import router as stats_router
# from src.api.eval_routes import router as eval_router

from src.auth.dependencies import get_current_user
from src.api.index_manager import rebuild_vector_store, get_vector_store
from src.retriever import retrieve_chunks
from src.generator import generate_answer

# -------------------------
# REGISTER ROUTERS (ORDER MATTERS)
# -------------------------
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(stats_router)
# app.include_router(eval_router)   # 👈 BEFORE chat/search
app.include_router(evidence_router)
app.include_router(chat_router)

# -------------------------
# STARTUP
# -------------------------
@app.on_event("startup")
def startup_event():
    rebuild_vector_store()

# -------------------------
# HEALTH
# -------------------------
@app.get("/")
def health():
    return {"status": "EDMS API is running"}

# -------------------------
# SEARCH
# -------------------------
@app.get("/search")
def search(
    q: str = Query(...),
    user=Depends(get_current_user),
) -> Dict:

    store = get_vector_store()
    retrieved = retrieve_chunks(q, store, top_k=5)

    if not retrieved:
        return {
            "query": q,
            "answer": (
                "I can help with architecture decisions, incidents, "
                "design trade-offs, or system diagrams.\n\n"
                "Try asking something more specific."
            ),
            "evidence": [],
        }

    result = generate_answer(q, retrieved)

    return {
        "query": q,
        "answer": result["answer"],
        "evidence": result["evidence"],
    }

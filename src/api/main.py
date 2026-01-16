from fastapi import FastAPI, Query
from typing import Dict

# Import your existing RAG pipeline pieces
from src.parser import parse_org_folder
from src.chunker import create_chunks
from src.embedder import embed_chunks
from src.vector_store import VectorStore
from src.retriever import retrieve_chunks
from src.generator import generate_answer



app = FastAPI(
    title="EDMS API",
    description="Enterprise Decision Memory System",
    version="0.1.0",
)


# ---------
# Startup: load & index data ONCE
# ---------
@app.on_event("startup")
def startup_event():
    global vector_store

    # 1. Load documents
    docs = parse_org_folder("data/acmetech")

    # 2. Create chunks
    chunks = create_chunks(docs)

    # 3. Embed chunks
    embedded_chunks = embed_chunks(chunks)

    # 4. Build vector store
    dim = len(embedded_chunks[0]["embedding"])
    store = VectorStore(embedding_dim=dim)
    store.add(embedded_chunks)

    vector_store = store


# ---------
# Health check
# ---------
@app.get("/")
def health():
    return {"status": "EDMS API is running"}


# ---------
# Search endpoint (core)
# ---------
@app.get("/search")
def search(q: str = Query(..., description="Search question")) -> Dict:
    retrieved = retrieve_chunks(q, vector_store, top_k=5)
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

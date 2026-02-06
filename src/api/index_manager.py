from datetime import datetime
from typing import Optional, Dict

from src.parser import parse_org_folder
from src.chunker import create_chunks
from src.embedder import embed_chunks
from src.vector_store import VectorStore
from src.retrieval.bm25_index import BM25Index

ORG_DATA_PATH = "data/acmetech"

# Global references
vector_store: Optional[VectorStore] = None
bm25_index: Optional[BM25Index] = None

index_metadata: Dict = {
    "status": "not_initialized",
    "last_rebuild": None,
    "total_chunks": 0,
    "embedding_model": None,
}


def rebuild_vector_store():
    global vector_store, bm25_index, index_metadata

    docs = parse_org_folder(ORG_DATA_PATH)

    if not docs:
        vector_store = None
        bm25_index = None
        index_metadata.update({
            "status": "empty",
            "last_rebuild": datetime.utcnow().isoformat(),
            "total_chunks": 0,
        })
        return

    chunks = create_chunks(docs)
    embedded_chunks = embed_chunks(chunks)

    if not embedded_chunks:
        vector_store = None
        bm25_index = None
        index_metadata.update({
            "status": "empty",
            "last_rebuild": datetime.utcnow().isoformat(),
            "total_chunks": 0,
        })
        return

    # 🔹 FAISS (semantic)
    dim = len(embedded_chunks[0]["embedding"])
    store = VectorStore(embedding_dim=dim)
    store.add(embedded_chunks)
    vector_store = store

    # 🔹 BM25 (lexical)
    bm25_index = BM25Index(embedded_chunks)

    index_metadata.update({
        "status": "ready",
        "last_rebuild": datetime.utcnow().isoformat(),
        "total_chunks": len(embedded_chunks),
        "embedding_model": embedded_chunks[0].get("embedding_model", "unknown"),
    })


def get_vector_store() -> VectorStore:
    if vector_store is None:
        raise RuntimeError("Vector store not initialized")
    return vector_store


def get_bm25_index() -> BM25Index:
    if bm25_index is None:
        raise RuntimeError("BM25 index not initialized")
    return bm25_index


def get_index_metadata() -> Dict:
    return index_metadata

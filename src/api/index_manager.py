from src.parser import parse_org_folder
from src.chunker import create_chunks
from src.embedder import embed_chunks
from src.vector_store import VectorStore

ORG_DATA_PATH = "data/acmetech"

# Global reference (same object used everywhere)
vector_store = None


def rebuild_vector_store():
    global vector_store

    docs = parse_org_folder(ORG_DATA_PATH)
    chunks = create_chunks(docs)
    embedded_chunks = embed_chunks(chunks)

    dim = len(embedded_chunks[0]["embedding"])
    store = VectorStore(embedding_dim=dim)
    store.add(embedded_chunks)

    vector_store = store


def get_vector_store():
    if vector_store is None:
        raise RuntimeError("Vector store not initialized")
    return vector_store
import os
import numpy as np
from typing import List, Dict
from openai import OpenAI

from src.vector_store import VectorStore
from src.api.index_manager import get_bm25_index


EMBEDDING_MODEL = "text-embedding-3-small"

# -------------------------
# Guardrail configuration
# -------------------------
LOW_SIGNAL_QUERIES = {
    "hi", "hello", "hey", "thanks", "thank you",
    "ok", "okay", "cool", "yes", "no",
}


def is_low_signal_query(query: str) -> bool:
    q = query.strip().lower()
    if not q:
        return True
    if q in LOW_SIGNAL_QUERIES:
        return True
    if len(q.split()) <= 2 and not q.endswith("?"):
        return True
    return False


def embed_query(query: str) -> np.ndarray:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=query,
    )
    emb = np.array(response.data[0].embedding, dtype="float32")
    return emb.reshape(1, -1)


def retrieve_chunks(
    query: str,
    store: VectorStore,
    top_k: int = 5,
) -> List[Dict]:
    """
    🔥 Hybrid Retrieval: BM25 + Embeddings
    """

    if is_low_signal_query(query):
        return []

    # ------------------
    # Semantic retrieval
    # ------------------
    semantic_results = store.search(
        embed_query(query),
        top_k=top_k
    )

    # ------------------
    # Lexical retrieval
    # ------------------
    try:
        bm25 = get_bm25_index()
        lexical_results = bm25.search(query, top_k=top_k)
    except Exception:
        lexical_results = []

    # ------------------
    # Fusion (dedup)
    # ------------------
    seen = set()
    fused = []

    for c in semantic_results + lexical_results:
        key = (c["doc_id"], c["section_type"])
        if key not in seen:
            fused.append(c)
            seen.add(key)

        if len(fused) >= top_k:
            break

    return fused

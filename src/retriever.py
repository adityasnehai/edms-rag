import os
import numpy as np
from typing import List, Dict
from openai import OpenAI

from src.vector_store import VectorStore


EMBEDDING_MODEL = "text-embedding-3-small"


def embed_query(query: str) -> np.ndarray:
    """
    Embed a user query using OpenAI embeddings.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    client = OpenAI(api_key=api_key)

    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=query
    )

    embedding = np.array(response.data[0].embedding, dtype="float32")
    return embedding.reshape(1, -1)


def retrieve_chunks(
    query: str,
    store: VectorStore,
    top_k: int = 5
) -> List[Dict]:
    """
    Retrieve top-k relevant chunks for a query.
    """
    query_embedding = embed_query(query)
    results = store.search(query_embedding, top_k=top_k)
    return results


# ------------------------
# Manual test
# ------------------------
# if __name__ == "__main__":
#     from parser import parse_adr_folder
#     from chunker import create_chunks
#     from embedder import embed_chunks

    adr_folder = "data/adrs"

    parsed = parse_adr_folder(adr_folder)
    chunks = create_chunks(parsed)
    embedded_chunks = embed_chunks(chunks)

    dim = len(embedded_chunks[0]["embedding"])
    store = VectorStore(embedding_dim=dim)
    store.add(embedded_chunks)

    query = "Why was Kafka chosen?"
    results = retrieve_chunks(query, store, top_k=3)

    print(f"\nQuery: {query}\n")
    for r in results:
        print("=" * 60)
        print(f"Decision ID : {r['decision_id']}")
        print(f"Section     : {r['section_type']}")
        print("Text:")
        print(r["text"][:300], "...")

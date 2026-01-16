import os
from typing import List, Dict
import numpy as np
from openai import OpenAI

EMBEDDING_MODEL = "text-embedding-3-small"
BATCH_SIZE = 64  # safe batch size


def _clean_text(text: str) -> str | None:
    """
    Ensure text is valid for OpenAI embeddings.
    """
    if not isinstance(text, str):
        return None

    cleaned = text.strip()
    if len(cleaned) < 5:
        return None

    return cleaned


def embed_chunks(chunks: List[Dict]) -> List[Dict]:
    """
    Generate embeddings for each chunk using OpenAI.
    Adds an 'embedding' field to every chunk.
    """

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    client = OpenAI(api_key=api_key)

    # --- Clean & filter ---
    valid_chunks = []
    texts = []

    for chunk in chunks:
        cleaned = _clean_text(chunk.get("text"))
        if cleaned:
            texts.append(cleaned)
            valid_chunks.append(chunk)

    if not texts:
        raise RuntimeError("No valid text chunks to embed")

    # --- Batch embedding ---
    embeddings = []

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]

        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=batch
        )

        embeddings.extend(
            np.array(item.embedding, dtype="float32")
            for item in response.data
        )

    # --- Attach embeddings ---
    for chunk, emb in zip(valid_chunks, embeddings):
        chunk["embedding"] = emb

    return valid_chunks


# ------------------------
# Manual test
# ------------------------
if __name__ == "__main__":
    from src.parser import parse_org_folder
    from src.chunker import create_chunks

    docs = parse_org_folder("data/acmetech")
    chunks = create_chunks(docs)

    embedded = embed_chunks(chunks)

    print(f"Embedded chunks: {len(embedded)}")
    print(f"Embedding dim  : {len(embedded[0]['embedding'])}")

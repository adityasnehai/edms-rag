import faiss
import numpy as np
from typing import List, Dict


class VectorStore:
    """
    Simple FAISS-based vector store for semantic search.
    """

    def __init__(self, embedding_dim: int):
        # Inner product + normalized vectors = cosine similarity
        self.index = faiss.IndexFlatIP(embedding_dim)
        self.chunks: List[Dict] = []

    def add(self, chunks: List[Dict]):
        """
        Add embedded chunks to the vector store.
        """
        if not chunks:
            return

        vectors = np.vstack([c["embedding"] for c in chunks]).astype("float32")

        # Normalize for cosine similarity
        faiss.normalize_L2(vectors)

        self.index.add(vectors)
        self.chunks.extend(chunks)

    def search(self, query_embedding: np.ndarray, top_k: int = 5) -> List[Dict]:
        """
        Search for most similar chunks.
        """
        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)

        query_embedding = query_embedding.astype("float32")
        faiss.normalize_L2(query_embedding)

        scores, indices = self.index.search(query_embedding, top_k)

        results = []
        for idx in indices[0]:
            if idx == -1:
                continue
            results.append(self.chunks[idx])

        return results


# ------------------------
# Manual test
# ------------------------
if __name__ == "__main__":
    from src.parser import parse_org_folder
    from src.chunker import create_chunks
    from src.embedder import embed_chunks

    adr_folder = "data/adrs"

    parsed = parse_adr_folder(adr_folder)
    chunks = create_chunks(parsed)
    embedded_chunks = embed_chunks(chunks)

    dim = len(embedded_chunks[0]["embedding"])
    store = VectorStore(embedding_dim=dim)
    store.add(embedded_chunks)

    print(f"Vector store size: {len(store.chunks)}")

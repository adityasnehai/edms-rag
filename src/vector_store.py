import faiss
import numpy as np
from typing import List, Dict


class VectorStore:
    """
    FAISS-based vector store with observability helpers.
    """

    def __init__(self, embedding_dim: int):
        self.index = faiss.IndexFlatIP(embedding_dim)
        self.chunks: List[Dict] = []

    def add(self, chunks: List[Dict]):
        if not chunks:
            return

        vectors = np.vstack([c["embedding"] for c in chunks]).astype("float32")
        faiss.normalize_L2(vectors)

        self.index.add(vectors)
        self.chunks.extend(chunks)

    def search(self, query_embedding: np.ndarray, top_k: int = 5) -> List[Dict]:
        if self.index.ntotal == 0:
            return []

        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)

        query_embedding = query_embedding.astype("float32")
        faiss.normalize_L2(query_embedding)

        _, indices = self.index.search(query_embedding, top_k)

        return [
            self.chunks[idx]
            for idx in indices[0]
            if idx != -1
        ]

    def size(self) -> int:
        return len(self.chunks)

    def is_ready(self) -> bool:
        return self.index.ntotal > 0

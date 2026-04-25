import faiss
import numpy as np
from typing import List, Dict

from src.runtime_config import (
    FAISS_HNSW_EF_CONSTRUCTION,
    FAISS_HNSW_EF_SEARCH,
    FAISS_HNSW_M,
    FAISS_INDEX_TYPE,
    FAISS_IVF_NLIST,
    FAISS_IVF_NPROBE,
)


class VectorStore:
    """
    FAISS-based vector store with observability helpers.
    """

    def __init__(self, embedding_dim: int):
        self.embedding_dim = embedding_dim
        self.index_type = FAISS_INDEX_TYPE
        self.index = self._create_index()
        self.chunks: List[Dict] = []

    def _create_index(self):
        if self.index_type == "hnsw":
            index = faiss.IndexHNSWFlat(
                self.embedding_dim,
                FAISS_HNSW_M,
                faiss.METRIC_INNER_PRODUCT,
            )
            index.hnsw.efSearch = FAISS_HNSW_EF_SEARCH
            index.hnsw.efConstruction = FAISS_HNSW_EF_CONSTRUCTION
            return index

        if self.index_type == "ivf":
            nlist = max(1, FAISS_IVF_NLIST)
            quantizer = faiss.IndexFlatIP(self.embedding_dim)
            index = faiss.IndexIVFFlat(
                quantizer,
                self.embedding_dim,
                nlist,
                faiss.METRIC_INNER_PRODUCT,
            )
            index.nprobe = min(FAISS_IVF_NPROBE, nlist)
            return index

        return faiss.IndexFlatIP(self.embedding_dim)

    def add(self, chunks: List[Dict]):
        if not chunks:
            return

        vectors = np.vstack([c["embedding"] for c in chunks]).astype("float32")
        faiss.normalize_L2(vectors)

        if self.index_type == "ivf" and not self.index.is_trained:
            try:
                self.index.train(vectors)
            except Exception:
                self.index_type = "flat"
                self.index = faiss.IndexFlatIP(self.embedding_dim)

        self.index.add(vectors)
        self.chunks.extend(chunks)

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 5,
        with_scores: bool = False,
    ) -> List[Dict]:
        if self.index.ntotal == 0:
            return []

        if query_embedding.ndim == 1:
            query_embedding = query_embedding.reshape(1, -1)

        query_embedding = query_embedding.astype("float32")
        faiss.normalize_L2(query_embedding)

        scores, indices = self.index.search(query_embedding, top_k)

        if not with_scores:
            return [
                self.chunks[idx]
                for idx in indices[0]
                if idx != -1
            ]

        results = []
        for rank, (score, idx) in enumerate(zip(scores[0], indices[0]), start=1):
            if idx == -1:
                continue
            results.append(
                {
                    "chunk": self.chunks[idx],
                    "score": float(score),
                    "rank": rank,
                }
            )

        return results

    def size(self) -> int:
        return len(self.chunks)

    def is_ready(self) -> bool:
        return self.index.ntotal > 0

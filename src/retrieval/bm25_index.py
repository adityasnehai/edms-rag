from typing import List, Dict
from rank_bm25 import BM25Okapi


class BM25Index:
    """
    Lightweight BM25 index over chunk text.
    """

    def __init__(self, chunks: List[Dict]):
        self.chunks = chunks
        self.corpus = [c["text"].lower().split() for c in chunks]
        self.bm25 = BM25Okapi(self.corpus)

    def search(self, query: str, top_k: int = 5) -> List[Dict]:
        tokens = query.lower().split()
        scores = self.bm25.get_scores(tokens)

        ranked = sorted(
            zip(scores, self.chunks),
            key=lambda x: x[0],
            reverse=True
        )

        return [c for score, c in ranked[:top_k] if score > 0]

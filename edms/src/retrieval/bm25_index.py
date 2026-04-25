from typing import List, Dict
from rank_bm25 import BM25Okapi

from src.retrieval.text_utils import tokenize


class BM25Index:
    """
    Lightweight BM25 index over chunk text.
    """

    def __init__(self, chunks: List[Dict]):
        self.chunks = chunks
        self.corpus = [tokenize(c.get("text", "")) for c in chunks]
        self.bm25 = BM25Okapi(self.corpus) if self.corpus else None

    def search(
        self,
        query: str,
        top_k: int = 5,
        with_scores: bool = False,
    ) -> List[Dict]:
        tokens = tokenize(query)
        if not tokens or self.bm25 is None:
            return []

        scores = self.bm25.get_scores(tokens)

        ranked = sorted(
            zip(scores, self.chunks),
            key=lambda x: x[0],
            reverse=True,
        )

        filtered = [(float(score), chunk) for score, chunk in ranked if score > 0][:top_k]

        if not with_scores:
            return [chunk for score, chunk in filtered]

        return [
            {
                "chunk": chunk,
                "score": score,
                "rank": rank,
            }
            for rank, (score, chunk) in enumerate(filtered, start=1)
        ]

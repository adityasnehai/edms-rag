# src/eval/retrieval_metrics.py

from typing import List


def precision_at_k(
    retrieved_doc_ids: List[str],
    relevant_doc_ids: List[str],
    k: int,
) -> float:
    """
    Precision@K = (# relevant docs in top-K) / K
    """
    if k == 0:
        return 0.0

    retrieved_k = retrieved_doc_ids[:k]
    relevant_count = sum(
        1 for d in retrieved_k if d in relevant_doc_ids
    )

    return relevant_count / k


def hit_rate_at_k(
    retrieved_doc_ids: List[str],
    relevant_doc_ids: List[str],
    k: int,
) -> int:
    """
    Hit@K = 1 if ANY relevant doc is in top-K, else 0
    """
    retrieved_k = retrieved_doc_ids[:k]

    for d in retrieved_k:
        if d in relevant_doc_ids:
            return 1

    return 0


def mean_reciprocal_rank(
    retrieved_doc_ids: List[str],
    relevant_doc_ids: List[str],
) -> float:
    """
    MRR = 1 / rank of first relevant document
    """
    for idx, d in enumerate(retrieved_doc_ids):
        if d in relevant_doc_ids:
            return 1.0 / (idx + 1)

    return 0.0

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


def recall_at_k(
    retrieved_doc_ids: List[str],
    relevant_doc_ids: List[str],
    k: int,
) -> float:
    """
    Recall@K = (# relevant docs in top-K) / (# relevant docs)
    """
    if not relevant_doc_ids:
        return 0.0

    retrieved_k = retrieved_doc_ids[:k]
    relevant_set = set(relevant_doc_ids)
    retrieved_relevant = sum(1 for doc_id in retrieved_k if doc_id in relevant_set)

    return retrieved_relevant / len(relevant_set)


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

from datetime import datetime

from src.api.index_manager import rebuild_vector_store, get_bm25_index, get_vector_store
from src.auth.models import list_organizations
from src.retriever import retrieve_chunks
from src.eval.eval_dataset import EVAL_QUERIES
from src.eval.retrieval_metrics import (
    precision_at_k,
    recall_at_k,
    mean_reciprocal_rank,
)
from src.eval.eval_store import save_eval_result

TOP_K = 3


def run_evaluation(org_slug: str | None = None):
    print("\n🔍 Running RAG Retrieval Evaluation\n")

    organizations = list_organizations()
    if not organizations:
        raise RuntimeError("No organizations available for evaluation")

    organization = next(
        (org for org in organizations if org["slug"] == org_slug),
        organizations[0],
    )
    meta = rebuild_vector_store(organization["slug"], organization["id"])
    if meta.get("status") != "ready":
        raise RuntimeError(
            "Evaluation requires an indexed workspace with uploaded documents"
        )

    store = get_vector_store(organization["slug"])
    bm25_index = get_bm25_index(organization["slug"])

    precision_scores = []
    recall_scores = []
    mrr_scores = []

    for item in EVAL_QUERIES:
        query = item["query"]
        relevant_ids = item["relevant_doc_ids"]

        retrieved_chunks = retrieve_chunks(
            query=query,
            store=store,
            bm25_index=bm25_index,
            top_k=TOP_K,
            org_slug=organization["slug"],
            index_version=meta.get("index_version"),
        )

        retrieved_doc_ids = [c["doc_id"] for c in retrieved_chunks]

        p = precision_at_k(retrieved_doc_ids, relevant_ids, TOP_K)
        r = recall_at_k(retrieved_doc_ids, relevant_ids, TOP_K)
        mrr = mean_reciprocal_rank(retrieved_doc_ids, relevant_ids)

        precision_scores.append(p)
        recall_scores.append(r)
        mrr_scores.append(mrr)

        print(f"Query: {query}")
        print(f"Retrieved: {retrieved_doc_ids}")
        print(f"Precision@{TOP_K}: {p:.2f}")
        print(f"Recall@{TOP_K}: {r:.2f}")
        print(f"MRR: {mrr:.2f}")
        print("-" * 60)

    avg_precision = sum(precision_scores) / len(precision_scores)
    avg_recall = sum(recall_scores) / len(recall_scores)
    avg_mrr = sum(mrr_scores) / len(mrr_scores)

    print("\n📊 FINAL AVERAGED METRICS")
    print(f"Avg Precision@{TOP_K}: {avg_precision:.3f}")
    print(f"Recall@{TOP_K}: {avg_recall:.3f}")
    print(f"Mean Reciprocal Rank: {avg_mrr:.3f}")
    print("\n✅ Evaluation complete\n")

    result = {
        "precision_at_k": avg_precision,
        "recall_at_k": avg_recall,
        "mrr": avg_mrr,
        "k": TOP_K,
        "evaluated_queries": len(EVAL_QUERIES),
        "organization": organization["name"],
        "evaluated_at": datetime.utcnow().isoformat(),
    }

    save_eval_result(organization["slug"], result)
    return result


if __name__ == "__main__":
    run_evaluation()

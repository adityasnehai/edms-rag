from src.api.index_manager import rebuild_vector_store, get_vector_store
from src.retriever import retrieve_chunks
from src.eval.eval_dataset import EVAL_QUERIES
from src.eval.retrieval_metrics import (
    precision_at_k,
    hit_rate_at_k,
    mean_reciprocal_rank,
)
from src.eval.eval_store import save_eval_result

TOP_K = 5


def run_evaluation():
    print("\n🔍 Running RAG Retrieval Evaluation\n")

    rebuild_vector_store()
    store = get_vector_store()

    precision_scores = []
    hit_scores = []
    mrr_scores = []

    for item in EVAL_QUERIES:
        query = item["query"]
        relevant_ids = item["relevant_doc_ids"]

        retrieved_chunks = retrieve_chunks(
            query=query,
            store=store,
            top_k=TOP_K,
        )

        retrieved_doc_ids = [c["doc_id"] for c in retrieved_chunks]

        p = precision_at_k(retrieved_doc_ids, relevant_ids, TOP_K)
        h = hit_rate_at_k(retrieved_doc_ids, relevant_ids, TOP_K)
        mrr = mean_reciprocal_rank(retrieved_doc_ids, relevant_ids)

        precision_scores.append(p)
        hit_scores.append(h)
        mrr_scores.append(mrr)

        print(f"Query: {query}")
        print(f"Retrieved: {retrieved_doc_ids}")
        print(f"Precision@{TOP_K}: {p:.2f}")
        print(f"Hit@{TOP_K}: {h}")
        print(f"MRR: {mrr:.2f}")
        print("-" * 60)

    avg_precision = sum(precision_scores) / len(precision_scores)
    avg_hit = sum(hit_scores) / len(hit_scores)
    avg_mrr = sum(mrr_scores) / len(mrr_scores)

    print("\n📊 FINAL AVERAGED METRICS")
    print(f"Avg Precision@{TOP_K}: {avg_precision:.3f}")
    print(f"Hit Rate@{TOP_K}: {avg_hit:.3f}")
    print(f"Mean Reciprocal Rank: {avg_mrr:.3f}")
    print("\n✅ Evaluation complete\n")

    # ✅ Persist for Admin UI
    save_eval_result({
        "precision_at_k": avg_precision,
        "hit_rate_at_k": avg_hit,
        "mrr": avg_mrr,
        "k": TOP_K,
        "evaluated_queries": len(EVAL_QUERIES),
    })


if __name__ == "__main__":
    run_evaluation()

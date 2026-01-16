from parser import parse_org_folder
from chunker import create_chunks
from embedder import embed_chunks
from vector_store import VectorStore
from retriever import retrieve_chunks
from generator import generate_answer


def run_pipeline(query: str, top_k: int = 5):
    docs = parse_org_folder("data/acmetech")
    chunks = create_chunks(docs)
    embedded_chunks = embed_chunks(chunks)

    dim = len(embedded_chunks[0]["embedding"])
    store = VectorStore(embedding_dim=dim)
    store.add(embedded_chunks)

    retrieved = retrieve_chunks(query, store, top_k=top_k)
    result = generate_answer(query, retrieved)

    print("\nQUERY:", query)
    print("\nANSWER:\n", result["answer"])

    print("\nEVIDENCE:\n")
    for e in result["evidence"]:
        print(
            f"- [{e['data_type']}] {e['doc_id']} | {e['section_type']}"
        )


if __name__ == "__main__":
    run_pipeline("Which architectural decisions led to later incidents?")

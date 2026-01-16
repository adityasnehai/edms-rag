import os
from typing import List, Dict
from openai import OpenAI


GENERATION_MODEL = "gpt-4o-mini"


def generate_answer(query: str, chunks: List[Dict]) -> Dict:
    """
    Generate an evidence-grounded answer using retrieved chunks only.
    """

    if not chunks:
        return {
            "answer": "Insufficient evidence to answer the question.",
            "evidence": []
        }

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    client = OpenAI(api_key=api_key)

    evidence_text = "\n\n".join(
        f"[{c['data_type']} | {c['doc_id']} | {c['section_type']}]\n{c['text']}"
        for c in chunks
    )

    system_prompt = (
        "You are an enterprise decision explanation system.\n"
        "Use ONLY the provided evidence to answer the question.\n"
        "Do NOT use external knowledge.\n"
        "If the answer is not fully supported, say so explicitly."
    )

    user_prompt = f"""
Question:
{query}

Evidence:
{evidence_text}

Answer:
"""

    response = client.chat.completions.create(
        model=GENERATION_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2
    )

    answer_text = response.choices[0].message.content.strip()

    return {
        "answer": answer_text,
        "evidence": chunks
    }


# ------------------------
# Manual test
# ------------------------
if __name__ == "__main__":
    from src.parser import parse_org_folder
    from src.chunker import create_chunks
    from src.embedder import embed_chunks
    from src.vector_store import VectorStore
    from src.retriever import retrieve_chunks


    docs = parse_org_folder("data/acmetech")
    chunks = create_chunks(docs)
    embedded_chunks = embed_chunks(chunks)

    dim = len(embedded_chunks[0]["embedding"])
    store = VectorStore(embedding_dim=dim)
    store.add(embedded_chunks)

    query = "Which architectural decisions led to later incidents?"
    retrieved = retrieve_chunks(query, store, top_k=5)

    result = generate_answer(query, retrieved)

    print("\nANSWER:\n")
    print(result["answer"])

    print("\nEVIDENCE USED:\n")
    for e in result["evidence"]:
        print(f"- [{e['data_type']}] {e['doc_id']} | {e['section_type']}")

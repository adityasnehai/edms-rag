import os
from typing import List, Dict, Optional
from openai import OpenAI

GENERATION_MODEL = "gpt-4o-mini"


def generate_answer(
    query: str,
    chunks: List[Dict],
    history: Optional[List[Dict]] = None,
) -> Dict:
    """
    Non-streaming answer (used by /search and /chat)
    """

    history = history or []

    # 🛑 Guardrail response
    if not chunks:
        return {
            "answer": (
                "I can help with questions about architecture decisions, "
                "incidents, design trade-offs, or system diagrams. "
                "Try asking something more specific."
            ),
            "evidence": [],
        }

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    evidence_text = "\n\n".join(
        f"[{c['data_type']} | {c['doc_id']} | {c['section_type']}]\n{c['text']}"
        for c in chunks
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are an enterprise decision explanation system.\n"
                "Use ONLY the provided evidence.\n"
                "If unsupported, say so."
            ),
        },
    ]

    for h in history:
        messages.append(h)

    messages.append(
        {
            "role": "user",
            "content": f"""
Question:
{query}

Evidence:
{evidence_text}

Answer:
""",
        }
    )

    response = client.chat.completions.create(
        model=GENERATION_MODEL,
        messages=messages,
        temperature=0.2,
    )

    return {
        "answer": response.choices[0].message.content.strip(),
        "evidence": [
            {
                "doc_id": c["doc_id"],
                "data_type": c["data_type"],
                "section_type": c["section_type"],
                "text": c["text"],
            }
            for c in chunks
        ],
    }


# ✅ STREAMING VERSION (same guardrail)
def stream_answer(
    query: str,
    chunks: List[Dict],
    history: Optional[List[Dict]] = None,
):
    history = history or []

    if not chunks:
        yield (
            "I need a more specific question related to system decisions, "
            "architecture, incidents, or diagrams."
        )
        return

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    evidence_text = "\n\n".join(
        f"[{c['data_type']} | {c['doc_id']} | {c['section_type']}]\n{c['text']}"
        for c in chunks
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are an enterprise decision explanation system.\n"
                "Use ONLY the provided evidence.\n"
                "If unsupported, say so."
            ),
        },
    ]

    for h in history:
        messages.append(h)

    messages.append(
        {
            "role": "user",
            "content": f"""
Question:
{query}

Evidence:
{evidence_text}

Answer:
""",
        }
    )

    stream = client.chat.completions.create(
        model=GENERATION_MODEL,
        messages=messages,
        temperature=0.2,
        stream=True,
    )

    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content

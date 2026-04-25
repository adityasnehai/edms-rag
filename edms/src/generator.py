from typing import Dict, List, Optional

from src.cache_store import build_cache_key, get_memory_cache, set_memory_cache, stable_hash
from src.llm_worker import run_completion, stream_completion
from src.resilience import retry_with_backoff
from src.runtime_config import (
    ANSWER_CACHE_TTL_SECONDS,
    LARGE_GENERATION_MODEL,
    RETRY_BASE_DELAY_SECONDS,
    RETRY_MAX_ATTEMPTS,
    RETRY_MAX_DELAY_SECONDS,
    ROUTING_COMPLEX_HISTORY_MESSAGES,
    ROUTING_COMPLEX_QUERY_WORDS,
    ROUTING_LONG_EVIDENCE_CHARS,
    ROUTING_MIN_EVIDENCE_FOR_SMALL_MODEL,
    SMALL_GENERATION_MODEL,
)
from src.telemetry import LLM_REQUESTS_TOTAL, log_event, stage_timer

ANSWER_NAMESPACE = "answer"


def _guardrail_response() -> Dict:
    return {
        "answer": (
            "I can help with questions about the workspace documents, "
            "meeting notes, tickets, postmortems, RFCs, ADRs, "
            "or system diagrams. "
            "Try asking something more specific."
        ),
        "evidence": [],
    }


def _evidence_payload(chunks: List[Dict]) -> List[Dict]:
    return [
        {
            "doc_id": chunk["doc_id"],
            "data_type": chunk["data_type"],
            "section_type": chunk["section_type"],
            "text": chunk["text"],
        }
        for chunk in chunks
    ]


def _evidence_text(chunks: List[Dict]) -> str:
    return "\n\n".join(
        f"[{c['data_type']} | {c['doc_id']} | {c['section_type']}]\n{c['text']}"
        for c in chunks
    )


def _route_generation_model(
    query: str,
    chunks: List[Dict],
    history: List[Dict],
) -> str:
    query_words = len(query.split())
    history_messages = len(history)
    total_evidence_chars = sum(len(chunk.get("text", "")) for chunk in chunks)
    multi_part_query = query.count("?") > 1 or query.lower().count(" and ") >= 2

    if (
        query_words >= ROUTING_COMPLEX_QUERY_WORDS
        or history_messages >= ROUTING_COMPLEX_HISTORY_MESSAGES
        or total_evidence_chars >= ROUTING_LONG_EVIDENCE_CHARS
        or len(chunks) < ROUTING_MIN_EVIDENCE_FOR_SMALL_MODEL
        or multi_part_query
    ):
        return LARGE_GENERATION_MODEL

    return SMALL_GENERATION_MODEL


def _messages(query: str, chunks: List[Dict], history: List[Dict]) -> List[Dict]:
    messages = [
        {
            "role": "system",
            "content": (
                "You are an enterprise decision explanation system.\n"
                "Use ONLY the provided evidence.\n"
                "If unsupported, say so.\n"
                "Answer clearly and concisely."
            ),
        },
    ]

    for item in history:
        messages.append(item)

    messages.append(
        {
            "role": "user",
            "content": f"""
Question:
{query}

Evidence:
{_evidence_text(chunks)}

Answer:
""",
        }
    )

    return messages


def _grounded_fallback_answer(query: str, chunks: List[Dict]) -> str:
    if not chunks:
        return _guardrail_response()["answer"]

    lines = [
        "I could not complete the full answer right now, but the top evidence says:",
    ]

    for chunk in chunks[:3]:
        snippet = " ".join((chunk.get("text") or "").split())
        if len(snippet) > 220:
            snippet = f"{snippet[:220].rstrip()}..."
        lines.append(
            f"- [{chunk.get('data_type')} | {chunk.get('doc_id')} | {chunk.get('section_type')}] {snippet}"
        )

    lines.append("")
    lines.append("Ask again in a moment if you want a full synthesized answer.")
    return "\n".join(lines)


def _answer_cache_key(
    query: str,
    chunks: List[Dict],
    history: List[Dict],
    org_slug: Optional[str],
    index_version: Optional[str],
    model_name: str,
) -> Optional[str]:
    if not org_slug or not index_version:
        return None

    return build_cache_key(
        org_slug=org_slug,
        namespace=ANSWER_NAMESPACE,
        payload={
            "query": query,
            "history_hash": stable_hash(history),
            "chunk_refs": [
                {
                    "chunk_id": chunk.get("chunk_id"),
                    "doc_id": chunk.get("doc_id"),
                    "section_type": chunk.get("section_type"),
                }
                for chunk in chunks
            ],
            "index_version": index_version,
            "generation_model": model_name,
        },
    )


def generate_answer(
    query: str,
    chunks: List[Dict],
    history: Optional[List[Dict]] = None,
    org_slug: Optional[str] = None,
    index_version: Optional[str] = None,
) -> Dict:
    history = history or []

    if not chunks:
        return _guardrail_response()

    model_name = _route_generation_model(query, chunks, history)
    cache_key = _answer_cache_key(
        query=query,
        chunks=chunks,
        history=history,
        org_slug=org_slug,
        index_version=index_version,
        model_name=model_name,
    )
    if cache_key and org_slug:
        cached_response = get_memory_cache(
            org_slug=org_slug,
            namespace=ANSWER_NAMESPACE,
            key=cache_key,
        )
        if isinstance(cached_response, dict):
            return cached_response

    messages = _messages(query, chunks, history)

    def create_completion():
        return run_completion(model_name, messages)

    try:
        with stage_timer("answer_generation", org_slug=org_slug, model=model_name):
            response = retry_with_backoff(
                create_completion,
                max_attempts=RETRY_MAX_ATTEMPTS,
                base_delay_seconds=RETRY_BASE_DELAY_SECONDS,
                max_delay_seconds=RETRY_MAX_DELAY_SECONDS,
            )
        answer = response.choices[0].message.content.strip()
        log_event(20, "answer_generated", org_slug=org_slug, model=model_name, retrieved_chunks=len(chunks), fallback_used=False)
    except Exception:
        answer = _grounded_fallback_answer(query, chunks)
        if LLM_REQUESTS_TOTAL:
            LLM_REQUESTS_TOTAL.labels(model=model_name, mode="sync", fallback_used="true").inc()
        log_event(30, "answer_fallback_used", org_slug=org_slug, model=model_name, retrieved_chunks=len(chunks), fallback_used=True)

    result = {
        "answer": answer,
        "evidence": _evidence_payload(chunks),
    }

    if cache_key and org_slug:
        set_memory_cache(
            org_slug=org_slug,
            namespace=ANSWER_NAMESPACE,
            key=cache_key,
            value=result,
            ttl_seconds=ANSWER_CACHE_TTL_SECONDS,
        )

    return result


def stream_answer(
    query: str,
    chunks: List[Dict],
    history: Optional[List[Dict]] = None,
    org_slug: Optional[str] = None,
    index_version: Optional[str] = None,
):
    history = history or []

    if not chunks:
        yield (
            "I need a more specific question about the documents, notes, "
            "tickets, postmortems, RFCs, ADRs, or diagrams in this workspace."
        )
        return

    model_name = _route_generation_model(query, chunks, history)
    cache_key = _answer_cache_key(
        query=query,
        chunks=chunks,
        history=history,
        org_slug=org_slug,
        index_version=index_version,
        model_name=model_name,
    )
    if cache_key and org_slug:
        cached_response = get_memory_cache(
            org_slug=org_slug,
            namespace=ANSWER_NAMESPACE,
            key=cache_key,
        )
        if isinstance(cached_response, dict) and cached_response.get("answer"):
            yield cached_response["answer"]
            return

    messages = _messages(query, chunks, history)

    def create_stream():
        return stream_completion(model_name, messages)

    try:
        with stage_timer("answer_stream_generation", org_slug=org_slug, model=model_name):
            stream = retry_with_backoff(
                create_stream,
                max_attempts=RETRY_MAX_ATTEMPTS,
                base_delay_seconds=RETRY_BASE_DELAY_SECONDS,
                max_delay_seconds=RETRY_MAX_DELAY_SECONDS,
            )
    except Exception:
        fallback_answer = _grounded_fallback_answer(query, chunks)
        if cache_key and org_slug:
            set_memory_cache(
                org_slug=org_slug,
                namespace=ANSWER_NAMESPACE,
                key=cache_key,
                value={
                    "answer": fallback_answer,
                    "evidence": _evidence_payload(chunks),
                },
                ttl_seconds=ANSWER_CACHE_TTL_SECONDS,
            )
        if LLM_REQUESTS_TOTAL:
            LLM_REQUESTS_TOTAL.labels(model=model_name, mode="stream", fallback_used="true").inc()
        yield fallback_answer
        return

    tokens = []
    try:
        for chunk in stream:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                tokens.append(delta.content)
                yield delta.content
    except Exception:
        if not tokens:
            fallback_answer = _grounded_fallback_answer(query, chunks)
            if cache_key and org_slug:
                set_memory_cache(
                    org_slug=org_slug,
                    namespace=ANSWER_NAMESPACE,
                    key=cache_key,
                    value={
                        "answer": fallback_answer,
                        "evidence": _evidence_payload(chunks),
                    },
                    ttl_seconds=ANSWER_CACHE_TTL_SECONDS,
                )
            yield fallback_answer
            return

    if cache_key and org_slug and tokens:
        set_memory_cache(
            org_slug=org_slug,
            namespace=ANSWER_NAMESPACE,
            key=cache_key,
            value={
                "answer": "".join(tokens),
                "evidence": _evidence_payload(chunks),
            },
            ttl_seconds=ANSWER_CACHE_TTL_SECONDS,
        )

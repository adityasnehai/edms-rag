from typing import Dict, List, Optional, Tuple

import numpy as np
import requests
from openai import OpenAI

from src.cache_store import (
    build_cache_key,
    get_disk_cache,
    get_memory_cache,
    set_disk_cache,
    set_memory_cache,
)
from src.resilience import retry_with_backoff
from src.retrieval.bm25_index import BM25Index
from src.retrieval.text_utils import content_terms, tokenize
from src.runtime_config import (
    COHERE_RERANK_MAX_DOC_CHARS,
    COHERE_RERANK_MODEL,
    COHERE_RERANK_TIMEOUT_SECONDS,
    COHERE_RERANK_URL,
    DEFAULT_TOP_K,
    EMBEDDING_MODEL,
    EMBEDDING_TIMEOUT_SECONDS,
    HYBRID_CANDIDATE_MULTIPLIER,
    MAX_TOP_K,
    OPENAI_TIMEOUT_SECONDS,
    QUERY_EMBEDDING_CACHE_TTL_SECONDS,
    RETRIEVAL_CACHE_TTL_SECONDS,
    RRF_K,
    RETRY_BASE_DELAY_SECONDS,
    RETRY_MAX_ATTEMPTS,
    RETRY_MAX_DELAY_SECONDS,
)
from src.telemetry import RETRIEVAL_TOTAL, log_event, stage_timer
from src.vector_store import VectorStore

QUERY_EMBEDDING_NAMESPACE = "query_embedding"
RETRIEVAL_NAMESPACE = "retrieval"

LOW_SIGNAL_QUERIES = {
    "hi",
    "hello",
    "hey",
    "thanks",
    "thank you",
    "ok",
    "okay",
    "cool",
    "yes",
    "no",
}


def is_low_signal_query(query: str) -> bool:
    q = query.strip().lower()
    if not q:
        return True
    if q in LOW_SIGNAL_QUERIES:
        return True
    if len(q.split()) <= 2 and not q.endswith("?"):
        return True
    return False


def sanitize_top_k(top_k: Optional[int]) -> int:
    try:
        parsed = int(top_k or DEFAULT_TOP_K)
    except (TypeError, ValueError):
        parsed = DEFAULT_TOP_K

    return max(1, min(parsed, MAX_TOP_K))


def _chunk_key(chunk: Dict) -> Tuple[str, str, str]:
    return (
        chunk.get("chunk_id") or "",
        chunk.get("doc_id") or "",
        chunk.get("section_type") or "",
    )


def _chunk_ref(chunk: Dict) -> Dict:
    return {
        "chunk_id": chunk.get("chunk_id"),
        "doc_id": chunk.get("doc_id"),
        "section_type": chunk.get("section_type"),
    }


def _dedupe_chunks(chunks: List[Dict]) -> List[Dict]:
    seen = set()
    deduped = []
    for chunk in chunks:
        key = (
            chunk.get("doc_id") or "",
            chunk.get("section_type") or "",
            " ".join((chunk.get("text") or "").split()).lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(chunk)
    return deduped


def _restore_chunks_from_refs(store: VectorStore, refs: List[Dict]) -> List[Dict]:
    if not refs:
        return []

    chunk_map = {_chunk_key(chunk): chunk for chunk in store.chunks}
    restored = []
    for ref in refs:
        key = (
            ref.get("chunk_id") or "",
            ref.get("doc_id") or "",
            ref.get("section_type") or "",
        )
        chunk = chunk_map.get(key)
        if chunk is not None:
            restored.append(chunk)
    return restored


def embed_query(query: str, org_slug: Optional[str] = None) -> np.ndarray:
    cache_key = None

    if org_slug:
        cache_key = build_cache_key(
            org_slug=org_slug,
            namespace=QUERY_EMBEDDING_NAMESPACE,
            payload={"query": query},
        )
        cached_embedding = get_disk_cache(
            org_slug=org_slug,
            namespace=QUERY_EMBEDDING_NAMESPACE,
            key=cache_key,
        )
        if isinstance(cached_embedding, list) and cached_embedding:
            return np.array(cached_embedding, dtype="float32").reshape(1, -1)

    from os import getenv

    client = OpenAI(
        api_key=getenv("OPENAI_API_KEY"),
        timeout=EMBEDDING_TIMEOUT_SECONDS or OPENAI_TIMEOUT_SECONDS,
        max_retries=0,
    )

    def create_embedding():
        return client.embeddings.create(model=EMBEDDING_MODEL, input=query)

    response = retry_with_backoff(
        create_embedding,
        max_attempts=RETRY_MAX_ATTEMPTS,
        base_delay_seconds=RETRY_BASE_DELAY_SECONDS,
        max_delay_seconds=RETRY_MAX_DELAY_SECONDS,
    )
    emb = np.array(response.data[0].embedding, dtype="float32")

    if org_slug and cache_key:
        set_disk_cache(
            org_slug=org_slug,
            namespace=QUERY_EMBEDDING_NAMESPACE,
            key=cache_key,
            value=emb.tolist(),
            ttl_seconds=QUERY_EMBEDDING_CACHE_TTL_SECONDS,
        )

    return emb.reshape(1, -1)


def _rrf_score(rank: int) -> float:
    return 1.0 / (RRF_K + rank)


def _normalize_vector(vector: np.ndarray) -> np.ndarray:
    normalized = np.asarray(vector, dtype="float32").reshape(-1)
    norm = np.linalg.norm(normalized)
    if norm == 0:
        return normalized
    return normalized / norm


def _normalize_score_map(score_map: Dict[Tuple[str, str, str], float]) -> Dict[Tuple[str, str, str], float]:
    if not score_map:
        return {}

    values = list(score_map.values())
    minimum = min(values)
    maximum = max(values)

    if maximum <= minimum:
        return {
            key: (1.0 if maximum > 0 else 0.0)
            for key in score_map
        }

    return {
        key: (value - minimum) / (maximum - minimum)
        for key, value in score_map.items()
    }


def _build_candidate_pool(
    query: str,
    query_embedding: np.ndarray,
    store: VectorStore,
    bm25_index: Optional[BM25Index],
    candidate_top_k: int,
) -> List[Dict]:
    try:
        semantic_hits = store.search(
            query_embedding,
            top_k=candidate_top_k,
            with_scores=True,
        )
    except Exception:
        semantic_hits = []

    try:
        lexical_hits = (
            bm25_index.search(query, top_k=candidate_top_k, with_scores=True)
            if bm25_index is not None
            else []
        )
    except Exception:
        lexical_hits = []

    candidate_map: Dict[Tuple[str, str, str], Dict] = {}

    for hit in semantic_hits:
        chunk = hit["chunk"]
        key = _chunk_key(chunk)
        candidate = candidate_map.setdefault(
            key,
            {
                "chunk": chunk,
                "semantic_rank": None,
                "lexical_rank": None,
                "lexical_score": 0.0,
                "fusion_score": 0.0,
            },
        )
        candidate["semantic_rank"] = hit["rank"]
        candidate["fusion_score"] += _rrf_score(hit["rank"])

    for hit in lexical_hits:
        chunk = hit["chunk"]
        key = _chunk_key(chunk)
        candidate = candidate_map.setdefault(
            key,
            {
                "chunk": chunk,
                "semantic_rank": None,
                "lexical_rank": None,
                "lexical_score": 0.0,
                "fusion_score": 0.0,
            },
        )
        candidate["lexical_rank"] = hit["rank"]
        candidate["lexical_score"] = max(candidate["lexical_score"], hit["score"])
        candidate["fusion_score"] += _rrf_score(hit["rank"])

    return sorted(
        candidate_map.values(),
        key=lambda candidate: candidate["fusion_score"],
        reverse=True,
    )


def _lexical_only_results(
    query: str,
    bm25_index: Optional[BM25Index],
    top_k: int,
) -> List[Dict]:
    if bm25_index is None:
        return []

    try:
        return bm25_index.search(query, top_k=top_k)
    except Exception:
        return []


def _lexical_overlap_score(query_terms: set[str], chunk: Dict) -> float:
    if not query_terms:
        return 0.0

    searchable_text = " ".join(
        [
            chunk.get("doc_id", ""),
            chunk.get("data_type", ""),
            chunk.get("section_type", ""),
            chunk.get("metadata", {}).get("title", ""),
            chunk.get("text", ""),
        ]
    )
    chunk_terms = set(content_terms(searchable_text))
    if not chunk_terms:
        return 0.0

    return len(query_terms & chunk_terms) / len(query_terms)


def _metadata_match_score(query_text: str, query_terms: set[str], chunk: Dict) -> float:
    score = 0.0
    doc_id = (chunk.get("doc_id") or "").lower()
    if doc_id and doc_id in query_text:
        score += 0.4

    title_terms = set(content_terms(chunk.get("metadata", {}).get("title", "")))
    if title_terms and query_terms & title_terms:
        score += 0.2

    section_terms = set(tokenize(chunk.get("section_type", "")))
    if section_terms and query_terms & section_terms:
        score += 0.15

    data_type_terms = set(tokenize(chunk.get("data_type", "")))
    if data_type_terms and query_terms & data_type_terms:
        score += 0.1

    return min(score, 1.0)


def _semantic_similarity(query_vector: np.ndarray, chunk: Dict) -> float:
    embedding = chunk.get("embedding")
    if embedding is None:
        return 0.0

    chunk_vector = _normalize_vector(np.asarray(embedding, dtype="float32"))
    return float(max(np.dot(query_vector, chunk_vector), 0.0))


def _format_chunk_for_rerank(chunk: Dict) -> str:
    metadata = chunk.get("metadata") or {}
    title = metadata.get("title") or ""
    text = (chunk.get("text") or "").strip()
    if len(text) > COHERE_RERANK_MAX_DOC_CHARS:
        text = f"{text[:COHERE_RERANK_MAX_DOC_CHARS].rstrip()}..."

    return "\n".join(
        [
            f"doc_id: {chunk.get('doc_id', '')}",
            f"data_type: {chunk.get('data_type', '')}",
            f"section_type: {chunk.get('section_type', '')}",
            f"title: {title}",
            "content:",
            text,
        ]
    ).strip()


def _cohere_rerank_candidates(
    query: str,
    candidates: List[Dict],
    top_k: int,
) -> List[Dict]:
    from os import getenv

    api_key = getenv("COHERE_API_KEY")
    if not api_key or not candidates:
        return []

    documents = [
        _format_chunk_for_rerank(candidate["chunk"])
        for candidate in candidates
    ]

    def post_rerank():
        response = requests.post(
            COHERE_RERANK_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": COHERE_RERANK_MODEL,
                "query": query,
                "documents": documents,
                "top_n": top_k,
            },
            timeout=COHERE_RERANK_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response

    response = retry_with_backoff(
        post_rerank,
        max_attempts=RETRY_MAX_ATTEMPTS,
        base_delay_seconds=RETRY_BASE_DELAY_SECONDS,
        max_delay_seconds=RETRY_MAX_DELAY_SECONDS,
    )

    payload = response.json()
    results = payload.get("results") or []
    reranked_chunks = []

    for item in results:
        index = item.get("index")
        if isinstance(index, int) and 0 <= index < len(candidates):
            reranked_chunks.append(candidates[index]["chunk"])

    return reranked_chunks


def _heuristic_rerank_candidates(
    query: str,
    query_embedding: np.ndarray,
    candidates: List[Dict],
    top_k: int,
) -> List[Dict]:
    if not candidates:
        return []

    query_vector = _normalize_vector(query_embedding)
    normalized_query = query.lower()
    query_terms = set(content_terms(query))

    semantic_scores = {}
    lexical_scores = {}
    fusion_scores = {}
    overlap_scores = {}
    metadata_scores = {}

    for candidate in candidates:
        chunk = candidate["chunk"]
        key = _chunk_key(chunk)
        semantic_scores[key] = _semantic_similarity(query_vector, chunk)
        lexical_scores[key] = candidate.get("lexical_score", 0.0)
        fusion_scores[key] = candidate.get("fusion_score", 0.0)
        overlap_scores[key] = _lexical_overlap_score(query_terms, chunk)
        metadata_scores[key] = _metadata_match_score(normalized_query, query_terms, chunk)

    normalized_semantic = _normalize_score_map(semantic_scores)
    normalized_lexical = _normalize_score_map(lexical_scores)
    normalized_fusion = _normalize_score_map(fusion_scores)

    ranked_candidates = []
    for candidate in candidates:
        chunk = candidate["chunk"]
        key = _chunk_key(chunk)
        score = (
            0.42 * normalized_semantic.get(key, 0.0)
            + 0.2 * normalized_lexical.get(key, 0.0)
            + 0.18 * overlap_scores.get(key, 0.0)
            + 0.12 * normalized_fusion.get(key, 0.0)
            + 0.08 * metadata_scores.get(key, 0.0)
        )
        ranked_candidates.append((score, normalized_fusion.get(key, 0.0), chunk))

    ranked_candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [chunk for _, _, chunk in ranked_candidates[:top_k]]


def retrieve_chunks(
    query: str,
    store: VectorStore,
    bm25_index: Optional[BM25Index] = None,
    top_k: int = DEFAULT_TOP_K,
    org_slug: Optional[str] = None,
    index_version: Optional[str] = None,
) -> List[Dict]:
    if is_low_signal_query(query):
        return []

    final_top_k = sanitize_top_k(top_k)
    candidate_top_k = max(final_top_k, final_top_k * HYBRID_CANDIDATE_MULTIPLIER)
    candidate_top_k = min(candidate_top_k, store.size())

    if candidate_top_k == 0:
        return []

    retrieval_cache_key = None
    if org_slug and index_version:
        retrieval_cache_key = build_cache_key(
            org_slug=org_slug,
            namespace=RETRIEVAL_NAMESPACE,
            payload={
                "query": query,
                "top_k": final_top_k,
                "index_version": index_version,
            },
        )
        cached_refs = get_memory_cache(
            org_slug=org_slug,
            namespace=RETRIEVAL_NAMESPACE,
            key=retrieval_cache_key,
        )
        if isinstance(cached_refs, list):
            restored_chunks = _dedupe_chunks(_restore_chunks_from_refs(store, cached_refs))
            if restored_chunks and len(restored_chunks) == len(cached_refs):
                if RETRIEVAL_TOTAL:
                    RETRIEVAL_TOTAL.labels(fallback_used="false", cache_hit="true").inc()
                log_event(20, "retrieval_completed", org_slug=org_slug, retrieved_chunks=len(restored_chunks), cache_hit=True, fallback_used=False, top_k=final_top_k)
                return restored_chunks

    try:
        with stage_timer("query_embedding", org_slug=org_slug):
            query_embedding = embed_query(query, org_slug=org_slug)
    except Exception:
        results = _lexical_only_results(query, bm25_index, final_top_k)
        if RETRIEVAL_TOTAL:
            RETRIEVAL_TOTAL.labels(fallback_used="true", cache_hit="false").inc()
        log_event(20, "retrieval_completed", org_slug=org_slug, retrieved_chunks=len(results), cache_hit=False, fallback_used=True, top_k=final_top_k)
        return results

    with stage_timer("candidate_retrieval", org_slug=org_slug):
        candidates = _build_candidate_pool(
            query=query,
            query_embedding=query_embedding,
            store=store,
            bm25_index=bm25_index,
            candidate_top_k=candidate_top_k,
        )

    if not candidates:
        results = _lexical_only_results(query, bm25_index, final_top_k)
        if RETRIEVAL_TOTAL:
            RETRIEVAL_TOTAL.labels(fallback_used="true", cache_hit="false").inc()
        log_event(20, "retrieval_completed", org_slug=org_slug, retrieved_chunks=len(results), cache_hit=False, fallback_used=True, top_k=final_top_k)
        return results

    try:
        with stage_timer("rerank", org_slug=org_slug):
            reranked_chunks = _cohere_rerank_candidates(
                query=query,
                candidates=candidates,
                top_k=final_top_k,
            )
    except Exception:
        reranked_chunks = []

    if not reranked_chunks:
        with stage_timer("heuristic_rerank", org_slug=org_slug):
            reranked_chunks = _heuristic_rerank_candidates(
                query=query,
                query_embedding=query_embedding,
                candidates=candidates,
                top_k=final_top_k,
            )
    reranked_chunks = _dedupe_chunks(reranked_chunks)[:final_top_k]

    if retrieval_cache_key and reranked_chunks:
        set_memory_cache(
            org_slug=org_slug,
            namespace=RETRIEVAL_NAMESPACE,
            key=retrieval_cache_key,
            value=[_chunk_ref(chunk) for chunk in reranked_chunks],
            ttl_seconds=RETRIEVAL_CACHE_TTL_SECONDS,
        )
    if RETRIEVAL_TOTAL:
        RETRIEVAL_TOTAL.labels(fallback_used="false", cache_hit="false").inc()
    log_event(20, "retrieval_completed", org_slug=org_slug, retrieved_chunks=len(reranked_chunks), cache_hit=False, fallback_used=False, top_k=final_top_k)

    return reranked_chunks

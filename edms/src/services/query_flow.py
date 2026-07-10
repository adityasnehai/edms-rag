from dataclasses import dataclass
from typing import Dict, List

from src.cache_store import build_cache_key, get_memory_cache, set_memory_cache
from src.api.index_manager import ensure_org_search_indexes, get_index_metadata
from src.chunker import create_chunks
from src.parser import parse_org_folder
from src.retrieval.bm25_index import BM25Index
from src.retriever import retrieve_chunks, sanitize_top_k
from src.runtime_config import WORKSPACE_INSIGHTS_CACHE_TTL_SECONDS
from src.telemetry import log_event
from src.services.workspace_context import build_workspace_insights


@dataclass(slots=True)
class QueryResolution:
    retrieved: List[Dict]
    meta: Dict
    used_file_fallback: bool = False


def should_use_file_fallback_first(meta: Dict) -> bool:
    return meta.get("status") != "ready"


def _file_fallback_chunks(org_slug: str, org_id: int) -> List[Dict]:
    docs = parse_org_folder(org_slug=org_slug, org_id=org_id)
    return create_chunks(docs) if docs else []


def load_workspace_chunks(org_slug: str, org_id: int) -> List[Dict]:
    try:
        store, _, _ = ensure_org_search_indexes(org_slug, org_id)
        return list(getattr(store, "chunks", []) or [])
    except Exception:
        return _file_fallback_chunks(org_slug, org_id)


def fallback_file_retrieval(
    *,
    query: str,
    org_slug: str,
    org_id: int,
    top_k: int,
) -> List[Dict]:
    chunks = _file_fallback_chunks(org_slug, org_id)
    if not chunks:
        return []

    bm25_index = BM25Index(chunks)
    results = bm25_index.search(query, top_k=sanitize_top_k(top_k))
    if results:
        log_event(
            30,
            "file_fallback_used",
            event="query",
            org_slug=org_slug,
            retrieved_chunks=len(results),
        )
    return results


def resolve_query_chunks(
    *,
    query: str,
    org_slug: str,
    org_id: int,
    top_k: int,
    prefer_file_fallback: bool = True,
) -> QueryResolution:
    meta = get_index_metadata(org_slug)
    retrieved = None
    used_file_fallback = False

    if prefer_file_fallback and should_use_file_fallback_first(meta):
        retrieved = fallback_file_retrieval(
            query=query,
            org_slug=org_slug,
            org_id=org_id,
            top_k=top_k,
        )
        used_file_fallback = True

    if retrieved is None:
        store, bm25_index, meta = ensure_org_search_indexes(org_slug, org_id)
        retrieved = retrieve_chunks(
            query,
            store,
            bm25_index=bm25_index,
            top_k=sanitize_top_k(top_k),
            org_slug=org_slug,
            index_version=meta.get("index_version"),
        )

    return QueryResolution(
        retrieved=retrieved,
        meta=meta,
        used_file_fallback=used_file_fallback,
    )


def annotate_file_fallback_index_version(meta: Dict, org_slug: str, used_file_fallback: bool) -> Dict:
    if not used_file_fallback:
        return meta

    return {
        **meta,
        "index_version": f"file-fallback:{org_slug}",
    }


def get_cached_workspace_insights(
    *,
    org_slug: str,
    org_id: int,
    index_version: str | None,
    query: str | None = None,
    seed_chunks: List[Dict] | None = None,
    related_limit: int = 6,
    timeline_limit: int = 12,
    service_limit: int = 6,
) -> Dict:
    cache_key = None
    if index_version:
        cache_key = build_cache_key(
            org_slug=org_slug,
            namespace="workspace_insights",
            payload={
                "index_version": index_version,
                "query": (query or "").strip(),
                "seed_refs": [
                    {
                        "chunk_id": chunk.get("chunk_id"),
                        "doc_id": chunk.get("doc_id"),
                        "section_type": chunk.get("section_type"),
                    }
                    for chunk in (seed_chunks or [])
                ],
                "related_limit": related_limit,
                "timeline_limit": timeline_limit,
                "service_limit": service_limit,
            },
        )
        cached = get_memory_cache(
            org_slug=org_slug,
            namespace="workspace_insights",
            key=cache_key,
        )
        if isinstance(cached, dict):
            return cached

    workspace_chunks = load_workspace_chunks(org_slug, org_id)

    insights = build_workspace_insights(
        workspace_chunks,
        seed_chunks=seed_chunks,
        query=query,
        related_limit=related_limit,
        timeline_limit=timeline_limit,
        service_limit=service_limit,
    )
    if cache_key:
        set_memory_cache(
            org_slug=org_slug,
            namespace="workspace_insights",
            key=cache_key,
            value=insights,
            ttl_seconds=WORKSPACE_INSIGHTS_CACHE_TTL_SECONDS,
        )
    return insights

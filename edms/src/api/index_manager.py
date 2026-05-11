from datetime import datetime
from threading import Lock
from typing import Any, Dict
import time
from uuid import uuid4

from src.cache_store import invalidate_org_caches
from src.auth.models import list_organizations
from src.chunker import create_chunks
from src.embedder import embed_chunks_with_stats
from src.ingestion.manifest import (
    build_source_manifest,
    clear_source_manifest,
    diff_source_manifests,
    load_source_manifest,
    save_source_manifest,
)
from src.parser import parse_org_folder
from src.pinecone_store import PineconeVectorStore
from src.retrieval.bm25_index import BM25Index
from src.retrieval.elasticsearch_index import ElasticsearchBM25Index
from src.runtime_config import FAISS_INDEX_TYPE, LEXICAL_BACKEND, VECTOR_BACKEND
from src.traffic_control import distributed_lock
from src.vector_store import VectorStore

vector_stores: Dict[str, Any] = {}
bm25_indexes: Dict[str, Any] = {}
index_metadata: Dict[str, Dict] = {}
org_rebuild_locks: Dict[str, Lock] = {}


def _default_metadata() -> Dict:
    return {
        "status": "not_initialized",
        "last_rebuild": None,
        "index_version": None,
        "total_chunks": 0,
        "embedding_model": None,
        "last_error": None,
        "vector_backend": VECTOR_BACKEND,
        "lexical_backend": LEXICAL_BACKEND,
        "backend_warning": None,
        "vector_index_type": FAISS_INDEX_TYPE,
        "pipeline_status": "idle",
        "last_job_id": None,
        "last_trigger_source": None,
        "changed_files": 0,
        "removed_files": 0,
        "new_embeddings": 0,
        "cached_embeddings": 0,
    }


def _get_org_lock(org_slug: str) -> Lock:
    lock = org_rebuild_locks.get(org_slug)
    if lock is None:
        lock = Lock()
        org_rebuild_locks[org_slug] = lock
    return lock


def _mark_meta_job(
    meta: Dict,
    job_id: str | None,
    pipeline_status: str,
) -> None:
    meta["pipeline_status"] = pipeline_status
    if job_id:
        meta["last_job_id"] = job_id


def mark_ingestion_job_state(
    org_slug: str,
    job_id: str | None,
    *,
    pipeline_status: str,
) -> Dict:
    meta = index_metadata.setdefault(org_slug, _default_metadata())
    _mark_meta_job(meta, job_id, pipeline_status)
    if meta.get("status") in {"not_initialized", "error"} and pipeline_status in {"queued", "running"}:
        meta["status"] = pipeline_status
    return dict(meta)


def _clear_remote_backends(org_slug: str) -> None:
    if VECTOR_BACKEND == "pinecone":
        PineconeVectorStore.delete_namespace(org_slug)
    if LEXICAL_BACKEND == "elasticsearch":
        ElasticsearchBM25Index.delete_org_index(org_slug)


def _build_vector_backend(org_slug: str, embedded_chunks):
    dim = len(embedded_chunks[0]["embedding"])
    if VECTOR_BACKEND == "pinecone":
        try:
            store = PineconeVectorStore(org_slug=org_slug, embedding_dim=dim)
            store.replace(embedded_chunks)
            return store, "pinecone", None
        except Exception as exc:
            warning = f"Vector backend fell back to faiss: {exc}"
        else:
            warning = None
    else:
        warning = None

    fallback_store = VectorStore(embedding_dim=dim)
    fallback_store.add(embedded_chunks)
    return fallback_store, "faiss", warning


def _build_lexical_backend(org_slug: str, embedded_chunks):
    if LEXICAL_BACKEND == "elasticsearch":
        try:
            index = ElasticsearchBM25Index(org_slug=org_slug)
            index.replace(embedded_chunks)
            return index, "elasticsearch", None
        except Exception as exc:
            warning = f"Lexical backend fell back to local_bm25: {exc}"
        else:
            warning = None
    else:
        warning = None

    return BM25Index(embedded_chunks), "local_bm25", warning


def rebuild_vector_store(
    org_slug: str,
    org_id: int,
    *,
    job_id: str | None = None,
    trigger_source: str | None = None,
):
    with distributed_lock(f"rebuild:{org_slug}"), _get_org_lock(org_slug):
        meta = index_metadata.setdefault(org_slug, _default_metadata())
        new_index_version = uuid4().hex
        previous_manifest = load_source_manifest(org_slug)
        current_manifest = build_source_manifest(org_slug)
        manifest_diff = diff_source_manifests(previous_manifest, current_manifest)
        meta.update({
            "status": "rebuilding",
            "index_version": new_index_version,
            "last_error": None,
            "changed_files": len(manifest_diff["touched"]),
            "removed_files": len(manifest_diff["removed"]),
            "vector_index_type": FAISS_INDEX_TYPE,
        })
        _mark_meta_job(meta, job_id, "running")

        try:
            docs = parse_org_folder(org_slug=org_slug, org_id=org_id)

            if not docs:
                vector_stores.pop(org_slug, None)
                bm25_indexes.pop(org_slug, None)
                _clear_remote_backends(org_slug)
                clear_source_manifest(org_slug)
                meta.update({
                    "status": "empty",
                    "last_rebuild": datetime.utcnow().isoformat(),
                    "index_version": new_index_version,
                    "total_chunks": 0,
                    "embedding_model": None,
                    "last_error": None,
                    "vector_backend": VECTOR_BACKEND,
                    "lexical_backend": LEXICAL_BACKEND,
                    "backend_warning": None,
                    "pipeline_status": "completed",
                    "new_embeddings": 0,
                    "cached_embeddings": 0,
                })
                if trigger_source:
                    meta["last_trigger_source"] = trigger_source
                invalidate_org_caches(
                    org_slug,
                    namespaces=("query_embedding", "retrieval", "answer"),
                )
                return dict(meta)

            touched_files = set(manifest_diff["touched"])
            removed_files = set(manifest_diff["removed"])
            existing_chunks = list(getattr(vector_stores.get(org_slug), "chunks", []) or [])
            force_full_rebuild = not existing_chunks
            reusable_chunks = [
                chunk
                for chunk in existing_chunks
                if chunk.get("metadata", {}).get("source_file") not in touched_files
                and chunk.get("metadata", {}).get("source_file") not in removed_files
            ] if not force_full_rebuild else []
            touched_docs = [
                doc
                for doc in docs
                if (
                    force_full_rebuild
                    or not previous_manifest.get("files")
                    or doc.get("source_file") in touched_files
                )
            ]
            touched_chunks = create_chunks(touched_docs)
            embedded_touched_chunks, embedding_stats = embed_chunks_with_stats(
                touched_chunks,
                org_slug=org_slug,
            ) if touched_chunks else ([], {
                "generated_embeddings": 0,
                "cached_embeddings": 0,
            })
            embedded_chunks = reusable_chunks + embedded_touched_chunks

            if not embedded_chunks:
                vector_stores.pop(org_slug, None)
                bm25_indexes.pop(org_slug, None)
                _clear_remote_backends(org_slug)
                clear_source_manifest(org_slug)
                meta.update({
                    "status": "empty",
                    "last_rebuild": datetime.utcnow().isoformat(),
                    "index_version": new_index_version,
                    "total_chunks": 0,
                    "embedding_model": None,
                    "last_error": None,
                    "vector_backend": VECTOR_BACKEND,
                    "lexical_backend": LEXICAL_BACKEND,
                    "backend_warning": None,
                    "pipeline_status": "completed",
                    "new_embeddings": 0,
                    "cached_embeddings": 0,
                })
                if trigger_source:
                    meta["last_trigger_source"] = trigger_source
                invalidate_org_caches(
                    org_slug,
                    namespaces=("query_embedding", "retrieval", "answer"),
                )
                return dict(meta)

            store, vector_backend_used, vector_warning = _build_vector_backend(
                org_slug,
                embedded_chunks,
            )
            vector_stores[org_slug] = store
            bm25_index, lexical_backend_used, lexical_warning = _build_lexical_backend(
                org_slug,
                embedded_chunks,
            )
            bm25_indexes[org_slug] = bm25_index
            warnings = [warning for warning in (vector_warning, lexical_warning) if warning]

            meta.update({
                "status": "ready",
                "last_rebuild": datetime.utcnow().isoformat(),
                "index_version": new_index_version,
                "total_chunks": len(embedded_chunks),
                "embedding_model": embedded_chunks[0].get("embedding_model", "unknown"),
                "last_error": None,
                "vector_backend": vector_backend_used,
                "lexical_backend": lexical_backend_used,
                "backend_warning": " | ".join(warnings) if warnings else None,
                "pipeline_status": "completed",
                "new_embeddings": embedding_stats["generated_embeddings"],
                "cached_embeddings": embedding_stats["cached_embeddings"],
            })
            if trigger_source:
                meta["last_trigger_source"] = trigger_source
            save_source_manifest(org_slug, current_manifest)
            invalidate_org_caches(
                org_slug,
                namespaces=("query_embedding", "retrieval", "answer"),
            )
        except Exception as exc:
            vector_stores.pop(org_slug, None)
            bm25_indexes.pop(org_slug, None)
            meta.update({
                "status": "error",
                "last_rebuild": datetime.utcnow().isoformat(),
                "index_version": new_index_version,
                "total_chunks": 0,
                "embedding_model": None,
                "last_error": str(exc),
                "vector_backend": VECTOR_BACKEND,
                "lexical_backend": LEXICAL_BACKEND,
                "backend_warning": None,
                "pipeline_status": "failed",
                "new_embeddings": 0,
                "cached_embeddings": 0,
            })
            if trigger_source:
                meta["last_trigger_source"] = trigger_source
            invalidate_org_caches(
                org_slug,
                namespaces=("query_embedding", "retrieval", "answer"),
            )

        return dict(meta)


def rebuild_all_vector_stores():
    organizations = list_organizations()
    active_slugs = {org["slug"] for org in organizations}

    for organization in organizations:
        rebuild_vector_store(
            org_slug=organization["slug"],
            org_id=organization["id"],
        )

    for org_slug in list(vector_stores.keys()):
        if org_slug not in active_slugs:
            vector_stores.pop(org_slug, None)
            _clear_remote_backends(org_slug)

    for org_slug in list(bm25_indexes.keys()):
        if org_slug not in active_slugs:
            bm25_indexes.pop(org_slug, None)

    for org_slug in list(index_metadata.keys()):
        if org_slug not in active_slugs:
            index_metadata.pop(org_slug, None)
            org_rebuild_locks.pop(org_slug, None)


def get_vector_store(org_slug: str):
    store = vector_stores.get(org_slug)
    if store is None:
        raise RuntimeError("Vector store not initialized")
    return store


def get_bm25_index(org_slug: str):
    bm25 = bm25_indexes.get(org_slug)
    if bm25 is None:
        raise RuntimeError("BM25 index not initialized")
    return bm25


def _wait_for_vector_store(org_slug: str, timeout_seconds: float = 20.0):
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        store = vector_stores.get(org_slug)
        if store is not None:
            return store
        meta = get_index_metadata(org_slug)
        if meta.get("status") in {"ready", "empty", "error"} and meta.get("pipeline_status") != "running":
            break
        time.sleep(0.25)
    return vector_stores.get(org_slug)


def ensure_org_search_indexes(org_slug: str, org_id: int):
    try:
        store = get_vector_store(org_slug)
    except Exception:
        try:
            meta = rebuild_vector_store(
                org_slug=org_slug,
                org_id=org_id,
                trigger_source="lazy_search_rebuild",
            )
        except Exception as exc:
            store = _wait_for_vector_store(org_slug)
            if store is not None:
                meta = get_index_metadata(org_slug)
            else:
                latest_meta = get_index_metadata(org_slug)
                raise RuntimeError(
                    latest_meta.get("last_error") or str(exc) or "Knowledge index is not ready"
                ) from exc
        if meta.get("status") != "ready":
            raise RuntimeError(meta.get("last_error") or "Knowledge index is not ready")
        store = get_vector_store(org_slug)
    else:
        meta = get_index_metadata(org_slug)

    try:
        bm25 = get_bm25_index(org_slug)
    except Exception:
        bm25 = None

    return store, bm25, meta


def get_index_metadata(org_slug: str) -> Dict:
    return index_metadata.get(org_slug, _default_metadata())

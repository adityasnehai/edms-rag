from typing import Dict, List, Optional

import numpy as np
from openai import OpenAI

from src.cache_store import build_cache_key, get_disk_cache, set_disk_cache, stable_hash
from src.resilience import retry_with_backoff
from src.runtime_config import (
    DOCUMENT_EMBEDDING_CACHE_TTL_SECONDS,
    EMBEDDING_MODEL,
    EMBEDDING_TIMEOUT_SECONDS,
    OPENAI_TIMEOUT_SECONDS,
    RETRY_BASE_DELAY_SECONDS,
    RETRY_MAX_ATTEMPTS,
    RETRY_MAX_DELAY_SECONDS,
)
from src.telemetry import log_event, stage_timer

BATCH_SIZE = 64
DOCUMENT_EMBEDDING_NAMESPACE = "document_embedding"


def _clean_text(text: str) -> str | None:
    if not isinstance(text, str):
        return None

    cleaned = text.strip()
    if len(cleaned) < 5:
        return None

    return cleaned


def _chunk_embedding_payload(chunk: Dict, cleaned_text: str) -> Dict:
    return {
        "chunk_id": chunk.get("chunk_id"),
        "doc_id": chunk.get("doc_id"),
        "data_type": chunk.get("data_type"),
        "section_type": chunk.get("section_type"),
        "text_hash": stable_hash(cleaned_text),
    }


def embed_chunks(chunks: List[Dict], org_slug: Optional[str] = None) -> List[Dict]:
    return _embed_chunks_internal(chunks, org_slug=org_slug, return_stats=False)


def embed_chunks_with_stats(
    chunks: List[Dict],
    org_slug: Optional[str] = None,
) -> tuple[List[Dict], Dict]:
    return _embed_chunks_internal(chunks, org_slug=org_slug, return_stats=True)


def _embed_chunks_internal(
    chunks: List[Dict],
    org_slug: Optional[str] = None,
    return_stats: bool = False,
):
    api_key = None
    client = None
    stats = {
        "requested_chunks": 0,
        "valid_chunks": 0,
        "cached_embeddings": 0,
        "generated_embeddings": 0,
    }

    valid_chunks = []
    chunks_to_embed = []
    texts_to_embed = []

    for chunk in chunks:
        stats["requested_chunks"] += 1
        cleaned = _clean_text(chunk.get("text"))
        if not cleaned:
            continue

        valid_chunks.append(chunk)
        stats["valid_chunks"] += 1
        chunk["embedding_model"] = EMBEDDING_MODEL

        if org_slug:
            cache_key = build_cache_key(
                org_slug=org_slug,
                namespace=DOCUMENT_EMBEDDING_NAMESPACE,
                payload=_chunk_embedding_payload(chunk, cleaned),
            )
            cached_embedding = get_disk_cache(
                org_slug=org_slug,
                namespace=DOCUMENT_EMBEDDING_NAMESPACE,
                key=cache_key,
            )
            if isinstance(cached_embedding, list) and cached_embedding:
                chunk["embedding"] = np.array(cached_embedding, dtype="float32")
                chunk["embedding_source"] = "cache"
                stats["cached_embeddings"] += 1
                continue

        chunks_to_embed.append(chunk)
        texts_to_embed.append(cleaned)

    if not valid_chunks:
        raise RuntimeError("No valid text chunks to embed")

    if chunks_to_embed:
        from os import getenv

        api_key = getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")

        client = OpenAI(
            api_key=api_key,
            timeout=EMBEDDING_TIMEOUT_SECONDS or OPENAI_TIMEOUT_SECONDS,
            max_retries=0,
        )

        embeddings = []
        for i in range(0, len(texts_to_embed), BATCH_SIZE):
            batch = texts_to_embed[i : i + BATCH_SIZE]

            with stage_timer("document_embedding_batch", org_slug=org_slug):
                response = retry_with_backoff(
                    lambda: client.embeddings.create(
                        model=EMBEDDING_MODEL,
                        input=batch,
                    ),
                    max_attempts=RETRY_MAX_ATTEMPTS,
                    base_delay_seconds=RETRY_BASE_DELAY_SECONDS,
                    max_delay_seconds=RETRY_MAX_DELAY_SECONDS,
                )

            embeddings.extend(
                np.array(item.embedding, dtype="float32")
                for item in response.data
            )

        for chunk, cleaned_text, embedding in zip(chunks_to_embed, texts_to_embed, embeddings):
            chunk["embedding"] = embedding
            chunk["embedding_model"] = EMBEDDING_MODEL
            chunk["embedding_source"] = "generated"
            stats["generated_embeddings"] += 1

            if not org_slug:
                continue

            cache_key = build_cache_key(
                org_slug=org_slug,
                namespace=DOCUMENT_EMBEDDING_NAMESPACE,
                payload=_chunk_embedding_payload(chunk, cleaned_text),
            )
            set_disk_cache(
                org_slug=org_slug,
                namespace=DOCUMENT_EMBEDDING_NAMESPACE,
                key=cache_key,
                value=embedding.tolist(),
                ttl_seconds=DOCUMENT_EMBEDDING_CACHE_TTL_SECONDS,
            )

    if return_stats:
        log_event(20, "embedding_completed", org_slug=org_slug, retrieved_chunks=stats["valid_chunks"], cache_hit=stats["cached_embeddings"] > 0)
        return valid_chunks, stats

    return valid_chunks

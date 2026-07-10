import json
import re
from typing import Dict, List, Tuple

import requests

from src.cache_store import stable_hash
from src.retrieval.bm25_index import BM25Index
from src.runtime_config import (
    ELASTICSEARCH_INDEX_PREFIX,
    ELASTICSEARCH_TIMEOUT_SECONDS,
    ELASTICSEARCH_URL,
    PRODUCTION_MODE,
)


def _chunk_key(chunk: Dict) -> Tuple[str, str, str]:
    return (
        chunk.get("chunk_id") or "",
        chunk.get("doc_id") or "",
        chunk.get("section_type") or "",
    )


def _safe_chunk_id(chunk: Dict) -> str:
    chunk_id = chunk.get("chunk_id")
    if chunk_id:
        return str(chunk_id)

    return stable_hash(
        {
            "doc_id": chunk.get("doc_id"),
            "section_type": chunk.get("section_type"),
            "text": chunk.get("text"),
        }
    )


def _sanitize_index_name(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9_-]+", "-", (value or "").strip().lower())
    cleaned = cleaned.strip("-_")
    return cleaned or "edms"


def _chunk_document(chunk: Dict, org_slug: str) -> Dict:
    metadata = chunk.get("metadata") or {}
    return {
        "chunk_id": str(chunk.get("chunk_id") or ""),
        "doc_id": str(chunk.get("doc_id") or ""),
        "data_type": str(chunk.get("data_type") or ""),
        "section_type": str(chunk.get("section_type") or ""),
        "title": str(metadata.get("title") or ""),
        "source_file": str(metadata.get("source_file") or ""),
        "service": str(chunk.get("service") or metadata.get("service") or ""),
        "service_confidence": float(chunk.get("service_confidence") or metadata.get("service_confidence") or 0.0),
        "source_updated_at": float(chunk.get("source_updated_at") or metadata.get("source_updated_at") or 0.0),
        "source_size_bytes": int(chunk.get("source_size_bytes") or metadata.get("source_size_bytes") or 0),
        "text": str(chunk.get("text") or ""),
        "org_slug": str(org_slug or ""),
    }


class ElasticsearchBM25Index:
    def __init__(self, org_slug: str):
        if not ELASTICSEARCH_URL:
            raise RuntimeError("ELASTICSEARCH_URL is not set")

        self.org_slug = org_slug
        self.index_name = (
            f"{_sanitize_index_name(ELASTICSEARCH_INDEX_PREFIX)}"
            f"-{_sanitize_index_name(org_slug)}"
        )
        self.timeout = ELASTICSEARCH_TIMEOUT_SECONDS
        self.chunks: List[Dict] = []
        self._chunk_map: Dict[Tuple[str, str, str], Dict] = {}
        self._fallback = BM25Index([])

    def replace(self, chunks: List[Dict]):
        self.chunks = list(chunks)
        self._chunk_map = {
            _chunk_key(chunk): chunk
            for chunk in self.chunks
        }
        self._fallback = BM25Index(self.chunks)

        self._delete_index()
        if not self.chunks:
            return

        self._create_index()
        self._bulk_index(self.chunks)

    def _request(self, method: str, path: str, **kwargs):
        response = requests.request(
            method,
            f"{ELASTICSEARCH_URL}/{path.lstrip('/')}",
            timeout=self.timeout,
            **kwargs,
        )
        return response

    def _delete_index(self):
        response = self._request("DELETE", self.index_name)
        if response.status_code not in (200, 202, 404):
            response.raise_for_status()

    def _create_index(self):
        payload = {
            "settings": {
                "index": {
                    "number_of_shards": 1,
                    "number_of_replicas": 0,
                }
            },
            "mappings": {
                "properties": {
                    "chunk_id": {"type": "keyword"},
                    "doc_id": {"type": "keyword"},
                    "data_type": {"type": "keyword"},
                    "section_type": {"type": "keyword"},
                    "title": {"type": "text"},
                    "source_file": {"type": "keyword"},
                    "service": {"type": "keyword"},
                    "service_confidence": {"type": "float"},
                    "source_updated_at": {"type": "double"},
                    "source_size_bytes": {"type": "long"},
                    "text": {"type": "text"},
                    "org_slug": {"type": "keyword"},
                }
            },
        }
        response = self._request("PUT", self.index_name, json=payload)
        if response.status_code not in (200, 201):
            response.raise_for_status()

    def _bulk_index(self, chunks: List[Dict]):
        lines = []
        for chunk in chunks:
            lines.append(
                json.dumps(
                    {
                        "index": {
                            "_index": self.index_name,
                            "_id": _safe_chunk_id(chunk),
                        }
                    },
                    ensure_ascii=True,
                )
            )
            lines.append(
                json.dumps(
                    _chunk_document(chunk, self.org_slug),
                    ensure_ascii=True,
                )
            )

        response = self._request(
            "POST",
            "_bulk?refresh=true",
            data="\n".join(lines) + "\n",
            headers={"Content-Type": "application/x-ndjson"},
        )
        if response.status_code not in (200, 201):
            response.raise_for_status()

        payload = response.json()
        if payload.get("errors"):
            raise RuntimeError("Elasticsearch bulk indexing returned errors")

    def search(
        self,
        query: str,
        top_k: int = 5,
        with_scores: bool = False,
    ) -> List[Dict]:
        if not query.strip():
            return []

        request_body = {
            "size": top_k,
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": [
                    "text^3",
                    "title^2",
                    "doc_id^4",
                    "data_type^2",
                    "section_type^2",
                    "service^2",
                ],
                "type": "best_fields",
                "operator": "or",
                }
            },
        }

        try:
            response = self._request(
                "POST",
                f"{self.index_name}/_search",
                json=request_body,
            )
            if response.status_code not in (200, 201):
                response.raise_for_status()
            hits = response.json().get("hits", {}).get("hits", [])
        except Exception:
            if PRODUCTION_MODE:
                raise
            return self._fallback.search(
                query,
                top_k=top_k,
                with_scores=with_scores,
            )

        results = []
        for rank, hit in enumerate(hits, start=1):
            source = hit.get("_source") or {}
            key = (
                source.get("chunk_id") or "",
                source.get("doc_id") or "",
                source.get("section_type") or "",
            )
            chunk = self._chunk_map.get(key)
            if chunk is None:
                chunk = {
                    "chunk_id": source.get("chunk_id"),
                    "doc_id": source.get("doc_id"),
                    "data_type": source.get("data_type"),
                    "section_type": source.get("section_type"),
                    "text": source.get("text", ""),
                    "service": source.get("service"),
                    "service_confidence": source.get("service_confidence", 0.0),
                    "source_updated_at": source.get("source_updated_at"),
                    "source_size_bytes": source.get("source_size_bytes"),
                    "metadata": {
                        "title": source.get("title", ""),
                        "source_file": source.get("source_file", ""),
                        "service": source.get("service", ""),
                        "service_confidence": source.get("service_confidence", 0.0),
                        "source_updated_at": source.get("source_updated_at"),
                        "source_size_bytes": source.get("source_size_bytes"),
                    },
                }

            if not with_scores:
                results.append(chunk)
                continue

            results.append(
                {
                    "chunk": chunk,
                    "score": float(hit.get("_score") or 0.0),
                    "rank": rank,
                }
            )

        return results

    def size(self) -> int:
        return len(self.chunks)

    def is_ready(self) -> bool:
        return bool(self.chunks)

    @classmethod
    def delete_org_index(cls, org_slug: str) -> None:
        if not ELASTICSEARCH_URL:
            return

        index_name = (
            f"{_sanitize_index_name(ELASTICSEARCH_INDEX_PREFIX)}"
            f"-{_sanitize_index_name(org_slug)}"
        )
        try:
            response = requests.delete(
                f"{ELASTICSEARCH_URL}/{index_name}",
                timeout=ELASTICSEARCH_TIMEOUT_SECONDS,
            )
            if response.status_code not in (200, 202, 404):
                response.raise_for_status()
        except Exception:
            return

import os
import re
from typing import Dict, List, Tuple

import numpy as np

from src.cache_store import stable_hash
from src.runtime_config import (
    PINECONE_CLOUD,
    PINECONE_INDEX_NAME,
    PINECONE_METRIC,
    PINECONE_REGION,
    PINECONE_UPSERT_BATCH_SIZE,
    PRODUCTION_MODE,
)
from src.vector_store import VectorStore


def _chunk_key(chunk: Dict) -> Tuple[str, str, str, str]:
    return (
        chunk.get("chunk_id") or "",
        chunk.get("data_type") or "",
        chunk.get("doc_id") or "",
        chunk.get("section_type") or "",
    )


def _sanitize_namespace(org_slug: str) -> str:
    cleaned = re.sub(r"[^a-z0-9_-]+", "-", (org_slug or "").strip().lower())
    cleaned = cleaned.strip("-_")
    return cleaned[:128] or "default-org"


def _chunk_metadata(chunk: Dict, org_slug: str) -> Dict:
    metadata = chunk.get("metadata") or {}
    return {
        "chunk_id": str(chunk.get("chunk_id") or ""),
        "doc_id": str(chunk.get("doc_id") or ""),
        "data_type": str(chunk.get("data_type") or ""),
        "section_type": str(chunk.get("section_type") or ""),
        "title": str(metadata.get("title") or ""),
        "source_file": str(metadata.get("source_file") or ""),
        "text": str(chunk.get("text") or ""),
        "org_slug": str(org_slug or ""),
    }


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


def _extract_index_names(client) -> List[str]:
    indexes = client.list_indexes()

    if hasattr(indexes, "names") and callable(indexes.names):
        return list(indexes.names())

    if isinstance(indexes, list):
        names = []
        for item in indexes:
            if isinstance(item, str):
                names.append(item)
            elif isinstance(item, dict) and item.get("name"):
                names.append(item["name"])
            elif getattr(item, "name", None):
                names.append(item.name)
        return names

    if isinstance(indexes, dict):
        values = indexes.get("indexes") or indexes.get("data") or []
        return [
            item.get("name")
            for item in values
            if isinstance(item, dict) and item.get("name")
        ]

    return []


class PineconeVectorStore:
    def __init__(self, org_slug: str, embedding_dim: int):
        self.org_slug = org_slug
        self.embedding_dim = embedding_dim
        self.namespace = _sanitize_namespace(org_slug)
        self.index_name = PINECONE_INDEX_NAME
        self.chunks: List[Dict] = []
        self._chunk_map: Dict[Tuple[str, str, str], Dict] = {}
        self._fallback = VectorStore(embedding_dim=embedding_dim)
        self._index = self._bootstrap_index()

    def _bootstrap_index(self):
        api_key = os.getenv("PINECONE_API_KEY")
        if not api_key:
            raise RuntimeError("PINECONE_API_KEY is not set")

        try:
            from pinecone import Pinecone, ServerlessSpec
        except ImportError as exc:
            raise RuntimeError("pinecone package is not installed") from exc

        client = Pinecone(api_key=api_key)
        existing_names = _extract_index_names(client)
        exists = self.index_name in existing_names
        if not existing_names:
            try:
                client.describe_index(self.index_name)
                exists = True
            except Exception:
                exists = False

        if not exists:
            client.create_index(
                name=self.index_name,
                dimension=self.embedding_dim,
                metric=PINECONE_METRIC,
                spec=ServerlessSpec(
                    cloud=PINECONE_CLOUD,
                    region=PINECONE_REGION,
                ),
            )

        return client.Index(self.index_name)

    def replace(self, chunks: List[Dict]):
        self.chunks = list(chunks)
        self._chunk_map = {
            _chunk_key(chunk): chunk
            for chunk in self.chunks
        }

        self._fallback = VectorStore(embedding_dim=self.embedding_dim)
        if self.chunks:
            self._fallback.add(self.chunks)

        self.delete_namespace(self.org_slug)

        if not self.chunks:
            return

        for start in range(0, len(self.chunks), PINECONE_UPSERT_BATCH_SIZE):
            batch = self.chunks[start : start + PINECONE_UPSERT_BATCH_SIZE]
            vectors = [
                {
                    "id": _safe_chunk_id(chunk),
                    "values": np.asarray(chunk["embedding"], dtype="float32").tolist(),
                    "metadata": _chunk_metadata(chunk, self.org_slug),
                }
                for chunk in batch
            ]
            self._index.upsert(vectors=vectors, namespace=self.namespace)

    def search(
        self,
        query_embedding: np.ndarray,
        top_k: int = 5,
        with_scores: bool = False,
    ) -> List[Dict]:
        if not self.chunks:
            return []

        vector = np.asarray(query_embedding, dtype="float32").reshape(-1).tolist()

        try:
            response = self._index.query(
                vector=vector,
                top_k=top_k,
                namespace=self.namespace,
                include_values=True,
                include_metadata=True,
            )
            matches = getattr(response, "matches", None)
            if matches is None and isinstance(response, dict):
                matches = response.get("matches", [])
            if matches is None:
                matches = []
        except Exception:
            if PRODUCTION_MODE:
                raise
            return self._fallback.search(
                query_embedding,
                top_k=top_k,
                with_scores=with_scores,
            )

        if not with_scores:
            results = []
            for match in matches:
                metadata = getattr(match, "metadata", None) or {}
                if not metadata and isinstance(match, dict):
                    metadata = match.get("metadata") or {}
                key = (
                    str(metadata.get("chunk_id") or ""),
                    str(metadata.get("data_type") or ""),
                    str(metadata.get("doc_id") or ""),
                    str(metadata.get("section_type") or ""),
                )
                chunk = self._chunk_map.get(key)
                if chunk is not None:
                    results.append(chunk)
                    continue
                values = getattr(match, "values", None)
                if values is None and isinstance(match, dict):
                    values = match.get("values")
                results.append(
                    {
                        "chunk_id": metadata.get("chunk_id"),
                        "doc_id": metadata.get("doc_id"),
                        "data_type": metadata.get("data_type"),
                        "section_type": metadata.get("section_type"),
                        "text": metadata.get("text", ""),
                        "metadata": {
                            "title": metadata.get("title", ""),
                            "source_file": metadata.get("source_file", ""),
                        },
                        "embedding": np.asarray(values or [], dtype="float32"),
                    }
                )
            return results

        results = []
        for rank, match in enumerate(matches, start=1):
            metadata = getattr(match, "metadata", None) or {}
            if not metadata and isinstance(match, dict):
                metadata = match.get("metadata") or {}
            key = (
                str(metadata.get("chunk_id") or ""),
                str(metadata.get("data_type") or ""),
                str(metadata.get("doc_id") or ""),
                str(metadata.get("section_type") or ""),
            )
            chunk = self._chunk_map.get(key)
            if chunk is None:
                values = getattr(match, "values", None)
                if values is None and isinstance(match, dict):
                    values = match.get("values")
                chunk = {
                    "chunk_id": metadata.get("chunk_id"),
                    "doc_id": metadata.get("doc_id"),
                    "data_type": metadata.get("data_type"),
                    "section_type": metadata.get("section_type"),
                    "text": metadata.get("text", ""),
                    "metadata": {
                        "title": metadata.get("title", ""),
                        "source_file": metadata.get("source_file", ""),
                    },
                    "embedding": np.asarray(values or [], dtype="float32"),
                }

            score = getattr(match, "score", None)
            if score is None and isinstance(match, dict):
                score = match.get("score", 0.0)

            results.append(
                {
                    "chunk": chunk,
                    "score": float(score or 0.0),
                    "rank": rank,
                }
            )

        return results

    def size(self) -> int:
        return len(self.chunks)

    def is_ready(self) -> bool:
        return bool(self.chunks)

    @classmethod
    def delete_namespace(cls, org_slug: str) -> None:
        api_key = os.getenv("PINECONE_API_KEY")
        if not api_key:
            return

        try:
            from pinecone import Pinecone
        except ImportError:
            return

        try:
            client = Pinecone(api_key=api_key)
            if PINECONE_INDEX_NAME not in _extract_index_names(client):
                return
            client.Index(PINECONE_INDEX_NAME).delete(
                delete_all=True,
                namespace=_sanitize_namespace(org_slug),
            )
        except Exception:
            return

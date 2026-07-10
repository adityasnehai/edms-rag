from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Dict, List, Optional, Sequence, Tuple

from src.retrieval.text_utils import content_terms, tokenize

GENERAL_SERVICE = "General"

SERVICE_HINTS: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    # Keep the mapping coarse on purpose; the goal is product direction, not perfect classification.
    ("Auth", ("auth", "login", "signin", "sso", "oauth", "token", "session", "invite")),
    ("Billing", ("billing", "invoice", "subscription", "plan", "charge", "refund")),
    ("Payments", ("payment", "payments", "stripe", "checkout", "refunds", "payout")),
    ("Search", ("search", "retrieval", "rag", "embedding", "vector", "index", "query")),
    ("Platform", ("platform", "infra", "deploy", "release", "pipeline", "kubernetes", "terraform", "ci", "cd")),
    ("Support", ("incident", "outage", "postmortem", "sev", "bug", "ticket", "support", "failure")),
    ("Notifications", ("notification", "email", "sms", "push", "digest", "alert")),
    ("Data", ("analytics", "warehouse", "etl", "report", "dashboard", "metrics", "events")),
    ("Growth", ("onboarding", "activation", "experiment", "conversion", "growth")),
    ("Product", ("api", "backend", "frontend", "service", "feature", "workflow")),
)

SECTION_EVENT_TYPES = {
    "decision": "decision",
    "rationale": "decision",
    "consequences": "decision",
    "proposed_solution": "proposal",
    "alternatives_considered": "proposal",
    "discussion_summary": "meeting",
    "decisions_made": "meeting",
    "action_items": "meeting",
    "incident_summary": "incident",
    "root_cause": "incident",
    "resolution": "incident",
    "lessons_learned": "incident",
    "description": "task",
    "discussion": "task",
    "vision_summary": "visual evidence",
}


def _clean_text(*parts: Optional[str]) -> str:
    return " ".join(part.strip() for part in parts if part and part.strip())


def _doc_root(value: str | None) -> str:
    tokens = [token for token in tokenize(value or "") if token not in {"md", "txt", "png", "jpg", "jpeg"}]
    if not tokens:
        return ""
    root = tokens[:4]
    if root and root[-1].isdigit():
        root = root[:-1]
    return "-".join(root)


def _timestamp_sort_key(value) -> float:
    try:
        if value is None:
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _timestamp_iso(value) -> str | None:
    ts = _timestamp_sort_key(value)
    if ts <= 0:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def infer_service_context(
    *,
    data_type: str | None = None,
    title: str | None = None,
    source_file: str | None = None,
    text: str | None = None,
    section_type: str | None = None,
) -> Dict[str, object]:
    # Score a few obvious product signals instead of adding a heavy ML classifier.
    field_values = {
        "title": title or "",
        "source_file": source_file or "",
        "text": text or "",
        "section_type": section_type or "",
        "data_type": data_type or "",
    }
    field_weights = {
        "title": 3.0,
        "source_file": 2.0,
        "text": 1.0,
        "section_type": 1.0,
        "data_type": 1.5,
    }

    best_service = GENERAL_SERVICE
    best_score = 0.0
    best_fields: List[str] = []

    for service, keywords in SERVICE_HINTS:
        service_score = 0.0
        matched_fields: List[str] = []
        for field_name, field_value in field_values.items():
            if not field_value:
                continue
            normalized = field_value.lower()
            field_tokens = set(tokenize(field_value))
            matches = 0
            for keyword in keywords:
                if keyword in normalized or keyword in field_tokens:
                    matches += 1
            if matches:
                matched_fields.append(field_name)
                service_score += matches * field_weights[field_name]

        if service_score > best_score:
            best_service = service
            best_score = service_score
            best_fields = matched_fields

    if best_service == GENERAL_SERVICE:
        return {
            "service": GENERAL_SERVICE,
            "service_confidence": 0.0,
            "service_source": "fallback",
        }

    service_confidence = min(1.0, 0.35 + (best_score / 10.0))
    if data_type == "postmortems":
        service_confidence = min(1.0, service_confidence + 0.05)
    if data_type == "rfcs":
        service_confidence = min(1.0, service_confidence + 0.03)

    return {
        "service": best_service,
        "service_confidence": round(service_confidence, 3),
        "service_source": ",".join(best_fields) if best_fields else "inferred",
    }


def infer_event_type(chunk: Dict) -> str:
    section_type = (chunk.get("section_type") or "").strip().lower()
    data_type = (chunk.get("data_type") or "").strip().lower()
    return SECTION_EVENT_TYPES.get(section_type) or SECTION_EVENT_TYPES.get(data_type, data_type or "record")


def _chunk_timestamp(chunk: Dict) -> float:
    return _timestamp_sort_key(chunk.get("source_updated_at") or chunk.get("updated_at"))


def _chunk_doc_key(chunk: Dict) -> str:
    metadata = chunk.get("metadata") or {}
    source_file = metadata.get("source_file") or ""
    doc_id = chunk.get("doc_id") or ""
    root = _doc_root(source_file) or _doc_root(doc_id)
    if root:
        return root
    return "-".join(tokenize(doc_id))[:64]


def _chunk_text_terms(chunk: Dict) -> set[str]:
    metadata = chunk.get("metadata") or {}
    searchable = _clean_text(
        chunk.get("doc_id"),
        chunk.get("data_type"),
        chunk.get("section_type"),
        metadata.get("title"),
        metadata.get("service"),
        chunk.get("text"),
    )
    return set(content_terms(searchable))


def _chunk_payload(chunk: Dict, *, reason: str | None = None, score: float | None = None) -> Dict:
    metadata = chunk.get("metadata") or {}
    payload = {
        "chunk_id": chunk.get("chunk_id"),
        "doc_id": chunk.get("doc_id"),
        "data_type": chunk.get("data_type"),
        "section_type": chunk.get("section_type"),
        "title": metadata.get("title") or chunk.get("doc_id"),
        "text": chunk.get("text") or "",
        "service": chunk.get("service") or metadata.get("service") or GENERAL_SERVICE,
        "service_confidence": chunk.get("service_confidence", metadata.get("service_confidence", 0.0)),
        "source_file": metadata.get("source_file") or "",
        "source_updated_at": chunk.get("source_updated_at", metadata.get("source_updated_at")),
        "source_size_bytes": chunk.get("source_size_bytes", metadata.get("source_size_bytes")),
    }
    if reason is not None:
        payload["related_reason"] = reason
    if score is not None:
        payload["related_score"] = round(float(score), 4)
    return payload


def build_service_summary(chunks: Sequence[Dict], limit: int = 6) -> List[Dict]:
    buckets: Dict[str, Dict[str, object]] = {}

    for chunk in chunks:
        metadata = chunk.get("metadata") or {}
        service = chunk.get("service") or metadata.get("service") or GENERAL_SERVICE
        bucket = buckets.setdefault(
            service,
            {
                "service": service,
                "chunk_count": 0,
                "document_ids": set(),
                "data_types": Counter(),
                "latest_activity": 0.0,
            },
        )
        bucket["chunk_count"] = int(bucket["chunk_count"]) + 1
        bucket["document_ids"].add(chunk.get("doc_id") or "")
        bucket["data_types"][chunk.get("data_type") or "unknown"] += 1
        bucket["latest_activity"] = max(bucket["latest_activity"], _chunk_timestamp(chunk))

    summary: List[Dict] = []
    for bucket in buckets.values():
        document_ids = {doc_id for doc_id in bucket["document_ids"] if doc_id}
        data_types = bucket["data_types"]
        primary_data_type = None
        if data_types:
            primary_data_type = data_types.most_common(1)[0][0]
        summary.append(
            {
                "service": bucket["service"],
                "document_count": len(document_ids),
                "chunk_count": bucket["chunk_count"],
                "primary_data_type": primary_data_type,
                "latest_activity": bucket["latest_activity"] or None,
                "latest_activity_iso": _timestamp_iso(bucket["latest_activity"]),
            }
        )

    summary.sort(
        key=lambda item: (
            item["chunk_count"],
            item["latest_activity"] or 0.0,
            item["service"] or "",
        ),
        reverse=True,
    )
    return summary[:limit]


def build_timeline(chunks: Sequence[Dict], limit: int = 12) -> List[Dict]:
    events: List[Dict] = []

    for chunk in chunks:
        timestamp = _chunk_timestamp(chunk)
        if timestamp <= 0:
            continue
        metadata = chunk.get("metadata") or {}
        event_type = infer_event_type(chunk)
        snippet = " ".join((chunk.get("text") or "").split())
        if len(snippet) > 180:
            snippet = f"{snippet[:180].rstrip()}..."
        events.append(
            {
                "timestamp": timestamp,
                "timestamp_iso": _timestamp_iso(timestamp),
                "doc_id": chunk.get("doc_id"),
                "data_type": chunk.get("data_type"),
                "section_type": chunk.get("section_type"),
                "service": chunk.get("service") or metadata.get("service") or GENERAL_SERVICE,
                "event_type": event_type,
                "title": metadata.get("title") or chunk.get("doc_id"),
                "source_file": metadata.get("source_file"),
                "summary": snippet,
            }
        )

    events.sort(key=lambda item: (item["timestamp"], item["title"] or ""), reverse=True)
    return events[:limit]


def build_related_evidence(
    chunks: Sequence[Dict],
    *,
    seed_chunks: Sequence[Dict] | None = None,
    query: str | None = None,
    limit: int = 6,
) -> List[Dict]:
    seeds = list(seed_chunks or [])
    if not seeds and not query:
        return []

    # Related evidence is intentionally heuristic: same service, same document family, or strong query overlap.
    seed_doc_keys = {
        doc_key
        for chunk in seeds
        if (doc_key := _chunk_doc_key(chunk))
    }
    seed_services = {
        (chunk.get("service") or chunk.get("metadata", {}).get("service") or GENERAL_SERVICE)
        for chunk in seeds
    }
    seed_types = {chunk.get("data_type") or "" for chunk in seeds}
    query_terms = set(content_terms(query or ""))
    latest_seed_timestamp = max((_chunk_timestamp(chunk) for chunk in seeds), default=0.0)

    scored: List[Tuple[float, Dict, str]] = []
    seen = set()
    for chunk in chunks:
        key = (
            chunk.get("chunk_id") or "",
            chunk.get("doc_id") or "",
            chunk.get("section_type") or "",
        )
        if key in seen:
            continue
        seen.add(key)

        doc_key = _chunk_doc_key(chunk)
        if doc_key and doc_key in seed_doc_keys:
            continue

        service = chunk.get("service") or chunk.get("metadata", {}).get("service") or GENERAL_SERVICE
        score = 0.0
        reason = ""

        if service in seed_services and service != GENERAL_SERVICE:
            score += 3.0
            reason = "same service"

        if doc_key and any(doc_key.startswith(seed_key) or seed_key.startswith(doc_key) for seed_key in seed_doc_keys):
            score += 4.0
            reason = "same document family"

        if query_terms:
            chunk_terms = _chunk_text_terms(chunk)
            overlap = query_terms & chunk_terms
            if overlap:
                score += min(2.0, len(overlap) / max(1, len(query_terms)) * 2.5)
                if not reason:
                    reason = "keyword overlap"

        if seed_types and (chunk.get("data_type") or "") in seed_types:
            score += 0.4
            if not reason:
                reason = "same content type"

        if latest_seed_timestamp:
            gap = abs(_chunk_timestamp(chunk) - latest_seed_timestamp)
            if gap and gap < 60 * 60 * 24 * 30:
                score += 0.25
                if not reason:
                    reason = "recently related"

        if score <= 0:
            continue

        if not reason:
            reason = "related evidence"
        scored.append((score, chunk, reason))

    scored.sort(
        key=lambda item: (
            item[0],
            _chunk_timestamp(item[1]),
            item[1].get("doc_id") or "",
        ),
        reverse=True,
    )

    return [
        _chunk_payload(chunk, reason=reason, score=score)
        for score, chunk, reason in scored[:limit]
    ]


def build_workspace_insights(
    chunks: Sequence[Dict],
    *,
    seed_chunks: Sequence[Dict] | None = None,
    query: str | None = None,
    related_limit: int = 6,
    timeline_limit: int = 12,
    service_limit: int = 6,
) -> Dict:
    total_documents = len({chunk.get("doc_id") for chunk in chunks if chunk.get("doc_id")})
    services = build_service_summary(chunks, limit=service_limit)
    timeline = build_timeline(chunks, limit=timeline_limit)
    related_evidence = build_related_evidence(
        chunks,
        seed_chunks=seed_chunks,
        query=query,
        limit=related_limit,
    )

    latest_activity = timeline[0]["timestamp"] if timeline else None
    return {
        "workspace_summary": {
            "document_count": total_documents,
            "record_count": len(chunks),
            "service_count": len(services),
            "latest_activity": latest_activity,
            "latest_activity_iso": _timestamp_iso(latest_activity) if latest_activity else None,
        },
        "service_summary": services,
        "timeline": timeline,
        "related_evidence": related_evidence,
    }

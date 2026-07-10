from typing import List, Dict

from src.services.workspace_context import infer_service_context

IMPORTANT_SECTIONS = {
    # ADRs
    "context",
    "decision",
    "rationale",
    "consequences",
    "considered_options",

    # RFCs
    "problem_statement",
    "proposed_solution",
    "alternatives_considered",
    "trade_offs",

    # Meeting notes
    "discussion_summary",
    "decisions_made",
    "action_items",

    # Postmortems
    "incident_summary",
    "root_cause",
    "resolution",
    "lessons_learned",

    # Tickets
    "description",
    "discussion",
    "resolution",
}


def create_chunks(docs: List[Dict]) -> List[Dict]:
    """
    Create chunks from:
    - Structured documents (with sections)
    - Flat documents (images / vision / OCR)
    """

    chunks = []

    for doc in docs:
        # =====================================================
        # CASE 1 — SECTIONED DOCUMENTS (ADRs, RFCs, etc.)
        # =====================================================
        if "sections" in doc and isinstance(doc["sections"], dict):
            service_context = infer_service_context(
                data_type=doc.get("data_type"),
                title=doc.get("title"),
                source_file=doc.get("source_file"),
                text="\n".join(
                    text for text in doc["sections"].values() if text
                ),
                section_type="content",
            )
            service_label = doc.get("service") or service_context.get("service")
            service_confidence = doc.get("service_confidence", service_context.get("service_confidence", 0.0))
            service_source = doc.get("service_source", service_context.get("service_source", "inferred"))
            for section, text in doc["sections"].items():
                if not text:
                    continue

                if section not in IMPORTANT_SECTIONS:
                    continue

                chunks.append({
                    "chunk_id": f"{doc['data_type']}:{doc['doc_id']}:{section}",
                    "org_id": doc.get("org_id"),
                    "doc_id": doc["doc_id"],
                    "data_type": doc["data_type"],
                    "section_type": section,
                    "text": text.strip(),
                    "service": service_label,
                    "service_confidence": service_confidence,
                    "service_source": service_source,
                    "source_updated_at": doc.get("source_updated_at"),
                    "source_size_bytes": doc.get("source_size_bytes"),
                    "metadata": {
                        "title": doc.get("title"),
                        "source_file": doc.get("source_file"),
                        "service": service_label,
                        "service_confidence": service_confidence,
                        "source_updated_at": doc.get("source_updated_at"),
                        "source_size_bytes": doc.get("source_size_bytes"),
                    },
                })

        # =====================================================
        # CASE 2 — FLAT DOCUMENTS (IMAGES / VISION OUTPUT)
        # =====================================================
        elif "text" in doc:
            text = doc["text"].strip()
            if not text:
                continue

            service_context = infer_service_context(
                data_type=doc.get("data_type"),
                title=doc.get("title", "Image document"),
                source_file=doc.get("source_file"),
                text=text,
                section_type=doc.get("section_type", "vision_summary"),
            )
            service_label = doc.get("service") or service_context.get("service")
            service_confidence = doc.get("service_confidence", service_context.get("service_confidence", 0.0))
            service_source = doc.get("service_source", service_context.get("service_source", "inferred"))

            chunks.append({
                "chunk_id": f"{doc['data_type']}:{doc['doc_id']}:{doc.get('section_type', 'vision_summary')}",
                "org_id": doc.get("org_id"),
                "doc_id": doc["doc_id"],
                "data_type": doc["data_type"],     # usually "images"
                "section_type": doc.get("section_type", "vision_summary"),
                "text": text,
                "service": service_label,
                "service_confidence": service_confidence,
                "service_source": service_source,
                "source_updated_at": doc.get("source_updated_at"),
                "source_size_bytes": doc.get("source_size_bytes"),
                "metadata": {
                    "title": doc.get("title", "Image document"),
                    "source_file": doc.get("source_file"),
                    "service": service_label,
                    "service_confidence": service_confidence,
                    "source_updated_at": doc.get("source_updated_at"),
                    "source_size_bytes": doc.get("source_size_bytes"),
                },
            })

    return chunks

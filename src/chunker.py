from typing import List, Dict

IMPORTANT_SECTIONS = {
    # ADRs
    "context",
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

    # Postmortems
    "incident_summary",
    "root_cause",
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
            for section, text in doc["sections"].items():
                if not text:
                    continue

                if section not in IMPORTANT_SECTIONS:
                    continue

                chunks.append({
                    "chunk_id": f"{doc['doc_id']}-{section}",
                    "org_id": doc.get("org_id"),
                    "doc_id": doc["doc_id"],
                    "data_type": doc["data_type"],
                    "section_type": section,
                    "text": text.strip(),
                    "metadata": {
                        "title": doc.get("title"),
                        "source_file": doc.get("source_file"),
                    },
                })

        # =====================================================
        # CASE 2 — FLAT DOCUMENTS (IMAGES / VISION OUTPUT)
        # =====================================================
        elif "text" in doc:
            text = doc["text"].strip()
            if not text:
                continue

            chunks.append({
                "chunk_id": f"{doc['doc_id']}-vision",
                "org_id": doc.get("org_id"),
                "doc_id": doc["doc_id"],
                "data_type": doc["data_type"],     # usually "images"
                "section_type": doc.get("section_type", "vision_summary"),
                "text": text,
                "metadata": {
                    "title": doc.get("title", "Image document"),
                    "source_file": doc.get("source_file"),
                },
            })

    return chunks


# -----------------------
# Manual test
# -----------------------
if __name__ == "__main__":
    from src.parser import parse_org_folder

    docs = parse_org_folder("data/acmetech")
    chunks = create_chunks(docs)

    print(f"Total chunks created: {len(chunks)}")
    print(chunks[0]["data_type"], chunks[0]["section_type"])

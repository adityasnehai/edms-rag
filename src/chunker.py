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
    chunks = []

    for doc in docs:
        for section, text in doc["sections"].items():
            if not text:
                continue

            if section not in IMPORTANT_SECTIONS:
                continue

            chunk = {
                "chunk_id": f"{doc['doc_id']}-{section}",
                "org_id": doc["org_id"],
                "doc_id": doc["doc_id"],
                "data_type": doc["data_type"],
                "section_type": section,
                "text": text.strip(),
                "metadata": {
                    "title": doc["title"],
                    "source_file": doc["source_file"],
                },
            }

            chunks.append(chunk)

    return chunks


if __name__ == "__main__":
    from src.parser import parse_org_folder

    docs = parse_org_folder("data/acmetech")
    chunks = create_chunks(docs)

    print(f"Total chunks created: {len(chunks)}")
    print(chunks[0]["data_type"], chunks[0]["section_type"])

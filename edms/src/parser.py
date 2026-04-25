from typing import Dict, List

from src.storage import iter_files


def parse_org_folder(
    org_slug: str,
    org_id: int,
    base_path: str | None = None,
) -> List[Dict]:
    documents: List[Dict] = []
    for rel, payload in iter_files(org_slug, suffixes=(".md", ".txt")):
        parts = rel.split("/")
        fname = parts[-1]
        if parts[0] == "images":
            data_type = "images"
            section_type = "vision_summary"
            doc_id = fname.replace(".txt", "")
        else:
            data_type = parts[0]
            section_type = "content"
            doc_id = fname.replace(".md", "")
        documents.append(
            {
                "org_id": org_id,
                "org_slug": org_slug,
                "doc_id": doc_id,
                "data_type": data_type,
                "section_type": section_type,
                "text": payload.decode("utf-8", errors="ignore"),
                "title": fname.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").strip(),
                "source_file": rel,
            }
        )

    return documents

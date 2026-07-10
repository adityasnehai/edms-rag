import os
from typing import Dict, List

from src.data_types import canonicalize_data_type
from src.storage import iter_files
from src.tenancy import get_org_data_path
from src.services.workspace_context import infer_service_context


def parse_org_folder(
    org_slug: str,
    org_id: int,
) -> List[Dict]:
    documents: List[Dict] = []
    for rel, payload in iter_files(org_slug, suffixes=(".md", ".txt")):
        parts = rel.split("/")
        if not parts:
            continue
        fname = parts[-1]
        data_type = canonicalize_data_type(parts[0])
        if data_type not in {"adrs", "rfcs", "meeting_notes", "postmortems", "tickets", "images"}:
            continue

        if data_type == "images":
            section_type = "vision_summary"
            doc_id = fname.replace(".txt", "")
        else:
            section_type = "content"
            doc_id = fname.replace(".md", "")

        full_path = os.path.join(get_org_data_path(org_slug), rel)
        stat = os.stat(full_path) if os.path.exists(full_path) else None
        service_context = infer_service_context(
            data_type=data_type,
            title=fname.rsplit(".", 1)[0].replace("_", " ").replace("-", " ").strip(),
            source_file=rel,
            text=payload.decode("utf-8", errors="ignore"),
            section_type=section_type,
        )
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
                "source_updated_at": stat.st_mtime if stat else None,
                "source_size_bytes": stat.st_size if stat else len(payload),
                **service_context,
            }
        )

    return documents

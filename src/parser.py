import os
from typing import List, Dict

ORG_DATA_PATH = "data/acmetech"


def parse_org_folder(base_path: str = ORG_DATA_PATH) -> List[Dict]:
    documents = []

    for root, _, files in os.walk(base_path):
        for fname in files:
            if not fname.endswith((".md", ".txt")):
                continue

            path = os.path.join(root, fname)

            rel = os.path.relpath(path, base_path)
            parts = rel.split(os.sep)

            # images/*.png.txt
            if parts[0] == "images":
                data_type = "images"
                section_type = "vision_summary"
                doc_id = fname.replace(".txt", "")
            else:
                data_type = parts[0]
                section_type = "content"
                doc_id = fname.replace(".md", "")

            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()

            documents.append(
                {
                    "doc_id": doc_id,
                    "data_type": data_type,
                    "section_type": section_type,
                    "text": text,
                }
            )

    return documents

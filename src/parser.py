import os
import re
from typing import Dict, List

ORG_ID = "acmetech"

SECTION_MAP = {
    "adrs": [
        "Status",
        "Context",
        "Decision",
        "Considered Options",
        "Rationale",
        "Consequences",
    ],
    "rfcs": [
        "Problem Statement",
        "Proposed Solution",
        "Alternatives Considered",
        "Trade-offs",
    ],
    "meeting_notes": [
        "Attendees",
        "Discussion Summary",
        "Decisions Made",
        "Action Items",
    ],
    "postmortems": [
        "Incident Summary",
        "Root Cause",
        "Contributing Factors",
        "Corrective Actions",
        "Lessons Learned",
    ],
    "tickets": [
        "Description",
        "Business Justification",
        "Discussion",
        "Resolution",
    ],
}


def parse_markdown(file_path: str, data_type: str) -> Dict:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    title_match = re.search(r"#\s+(.*)", content)
    title = title_match.group(1).strip() if title_match else "Untitled"

    sections = {}
    for section in SECTION_MAP[data_type]:
        pattern = rf"##\s+{section}\n(.*?)(?=\n##|\Z)"
        match = re.search(pattern, content, re.DOTALL)
        sections[section.lower().replace(" ", "_")] = (
            match.group(1).strip() if match else None
        )

    doc_id = os.path.splitext(os.path.basename(file_path))[0]

    return {
        "org_id": ORG_ID,
        "doc_id": doc_id,
        "data_type": data_type,
        "title": title,
        "sections": sections,
        "source_file": file_path,
    }


def parse_org_folder(base_path: str) -> List[Dict]:
    records = []

    for folder in SECTION_MAP.keys():
        folder_path = os.path.join(base_path, folder)
        if not os.path.exists(folder_path):
            continue

        for file in os.listdir(folder_path):
            if file.endswith(".md"):
                full_path = os.path.join(folder_path, file)
                record = parse_markdown(full_path, folder)
                records.append(record)

    return records


if __name__ == "__main__":
    docs = parse_org_folder("data/acmetech")
    print(f"Parsed documents: {len(docs)}")
    print(docs[0]["data_type"], docs[0]["doc_id"])

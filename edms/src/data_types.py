from __future__ import annotations

from typing import Optional

CANONICAL_DATA_TYPES = (
    "adrs",
    "rfcs",
    "meeting_notes",
    "postmortems",
    "tickets",
    "images",
)

DATA_TYPE_ALIASES = {
    "adrs": ("adrs", "adr"),
    "rfcs": ("rfcs", "rfc"),
    "meeting_notes": ("meeting_notes", "meeting-note", "meetingnotes"),
    "postmortems": ("postmortems", "postmortem"),
    "tickets": ("tickets", "ticket"),
    "images": ("images",),
}

DATA_TYPE_LOOKUP = {
    alias: canonical for canonical, aliases in DATA_TYPE_ALIASES.items() for alias in aliases
}


def canonicalize_data_type(data_type: Optional[str]) -> Optional[str]:
    if data_type is None:
        return None
    cleaned = str(data_type).strip().lower()
    if not cleaned:
        return None
    return DATA_TYPE_LOOKUP.get(cleaned, cleaned)


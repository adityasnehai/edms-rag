import re
from typing import List

TOKEN_PATTERN = re.compile(r"[a-z0-9]+")

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
}


def tokenize(text: str) -> List[str]:
    if not text:
        return []

    return TOKEN_PATTERN.findall(text.lower())


def content_terms(text: str) -> List[str]:
    return [token for token in tokenize(text) if token not in STOPWORDS]

# src/eval/eval_dataset.py

"""
Offline evaluation dataset for RAG retrieval.

Each query has a list of relevant doc_ids that
*should* appear in the retrieved results.
"""

EVAL_QUERIES = [
    {
        "query": "Why was GitHub chosen over GitLab?",
        "relevant_doc_ids": ["ADR-001", "ADR-002"],
    },
    {
        "query": "What caused the recent production outage?",
        "relevant_doc_ids": ["INC-004", "POST-001"],
    },
    {
        "query": "Which decisions affected system scalability?",
        "relevant_doc_ids": ["ADR-005", "RFC-003"],
    },
    {
        "query": "What tickets discuss Kafka performance?",
        "relevant_doc_ids": ["JIRA-101", "JIRA-106"],
    },
]

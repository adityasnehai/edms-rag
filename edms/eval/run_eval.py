from __future__ import annotations

import json
import math
import re
import sys
import csv
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from statistics import mean
from typing import Dict, Iterable, List, Sequence

ROOT = Path(__file__).resolve().parents[2]
EDMS_DIR = ROOT / "edms"
SAMPLE_DATA_DIR = ROOT / "sample_data"
OUTPUT_DIR = Path(__file__).resolve().parent
DATASET_PATH = OUTPUT_DIR / "synthetic_dataset.jsonl"
DATASET_CSV_PATH = OUTPUT_DIR / "synthetic_dataset.csv"
RESULTS_PATH = OUTPUT_DIR / "eval_results.json"
RESULTS_CSV_PATH = OUTPUT_DIR / "eval_summary.csv"
EXAMPLES_CSV_PATH = OUTPUT_DIR / "eval_examples.csv"
VALIDATION_PATH = OUTPUT_DIR / "eval_validation.json"
NO_ANSWER_SCORE_THRESHOLD = 5.0

if str(EDMS_DIR) not in sys.path:
    sys.path.insert(0, str(EDMS_DIR))

try:
    from src.retrieval.bm25_index import BM25Index as RepoBM25Index
    from src.retrieval.text_utils import tokenize
except Exception:  # pragma: no cover - local fallback when optional deps are missing
    RepoBM25Index = None

    def tokenize(text: str) -> List[str]:
        return re.findall(r"[a-z0-9]+", (text or "").lower())


SECTION_NAME_MAP = {
    "context": "context",
    "decision": "decision",
    "rationale": "rationale",
    "consequences": "consequences",
    "considered options": "considered_options",
    "problem statement": "problem_statement",
    "proposed solution": "proposed_solution",
    "alternatives considered": "alternatives_considered",
    "trade offs": "trade_offs",
    "trade-offs": "trade_offs",
    "discussion summary": "discussion_summary",
    "decisions made": "decisions_made",
    "action items": "action_items",
    "incident summary": "incident_summary",
    "root cause": "root_cause",
    "resolution": "resolution",
    "lessons learned": "lessons_learned",
    "description": "description",
    "discussion": "discussion",
}


@dataclass(slots=True)
class Document:
    data_type: str
    doc_id: str
    title: str
    source_file: str
    raw_text: str
    metadata: Dict[str, str]
    sections: Dict[str, str]


@dataclass(slots=True)
class Example:
    id: str
    query_type: str
    data_type: str
    doc_id: str | None
    question: str
    gold_answer: str | None
    gold_section: str | None
    gold_chunk_ids: List[str]
    no_answer: bool = False


def normalize_text(text: str) -> str:
    return " ".join((text or "").lower().split())


def normalize_section_name(raw: str) -> str:
    key = raw.strip().lower()
    return SECTION_NAME_MAP.get(key, re.sub(r"[^a-z0-9]+", "_", key).strip("_"))


def first_sentence(text: str) -> str:
    cleaned = " ".join((text or "").split())
    if not cleaned:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", cleaned)
    return parts[0].strip()


def truncate_words(text: str, limit: int = 16) -> str:
    words = (text or "").split()
    if len(words) <= limit:
        return " ".join(words)
    return " ".join(words[:limit]).rstrip(",;:") + "..."


def split_sections(text: str) -> Dict[str, str]:
    sections: Dict[str, List[str]] = {}
    current_key: str | None = None
    current_lines: List[str] = []

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        match = re.match(r"^##\s+(.+)$", line)
        if match:
            if current_key is not None:
                sections[current_key] = "\n".join(current_lines).strip()
            current_key = normalize_section_name(match.group(1))
            current_lines = []
            continue
        if current_key is None:
            continue
        current_lines.append(line)

    if current_key is not None:
        sections[current_key] = "\n".join(current_lines).strip()

    if not sections:
        body = "\n".join(
            line for line in text.splitlines() if line and not line.startswith("#")
        ).strip()
        if body:
            sections["content"] = body

    return {key: value for key, value in sections.items() if value}


def parse_metadata(text: str) -> Dict[str, str]:
    metadata: Dict[str, str] = {}
    for line in text.splitlines():
        if line.startswith("## "):
            break
        match = re.match(r"^([A-Za-z][A-Za-z \-/]+):\s*(.+)$", line.strip())
        if match:
            key = match.group(1).strip().lower()
            value = match.group(2).strip()
            metadata[key] = value
    return metadata


def load_documents() -> List[Document]:
    documents: List[Document] = []
    for data_type_dir in sorted(p for p in SAMPLE_DATA_DIR.iterdir() if p.is_dir()):
        data_type = data_type_dir.name
        for path in sorted(data_type_dir.glob("*.md")):
            text = path.read_text(encoding="utf-8")
            doc_id = path.stem
            metadata = parse_metadata(text)
            sections = split_sections(text)
            title_match = re.search(r"^#\s+(.+)$", text, flags=re.MULTILINE)
            title = title_match.group(1).strip() if title_match else doc_id
            documents.append(
                Document(
                    data_type=data_type,
                    doc_id=doc_id,
                    title=title,
                    source_file=f"{data_type}/{path.name}",
                    raw_text=text,
                    metadata=metadata,
                    sections=sections,
                )
            )
    return documents


def build_chunks(documents: Sequence[Document]) -> List[Dict]:
    chunks: List[Dict] = []
    for doc in documents:
        chunks.append(
            {
                "chunk_id": f"{doc.data_type}:{doc.doc_id}:content",
                "doc_id": doc.doc_id,
                "data_type": doc.data_type,
                "section_type": "content",
                "text": doc.raw_text,
                "metadata": {
                    "title": doc.title,
                    "source_file": doc.source_file,
                },
            }
        )
        for section_name, section_text in doc.sections.items():
            chunk_id = f"{doc.data_type}:{doc.doc_id}:{section_name}"
            chunks.append(
                {
                    "chunk_id": chunk_id,
                    "doc_id": doc.doc_id,
                    "data_type": doc.data_type,
                    "section_type": section_name,
                    "text": section_text,
                    "metadata": {
                        "title": doc.title,
                        "source_file": doc.source_file,
                    },
                }
            )
    return chunks


def make_examples(documents: Sequence[Document]) -> List[Example]:
    examples: List[Example] = []
    negative_prompts = [
        "What does the workspace say about florbax protocol 19?",
        "Which record approves zentora authentication for quorim 7?",
        "Where is the narvex deployment plan documented?",
        "What is the official guidance for plinzo billing reconciliation?",
        "Which note explains solar flare reimbursement for vextro?",
        "What does MemoStack say about tarvix payroll for region 9?",
        "Which document covers potato encryption standards in yulma?",
        "What is the process for unicorn incident response in qelto?",
        "Which record explains helium customer onboarding for zyxra?",
        "What is the policy for orbital coffee refills in brondo?",
    ]

    for doc in documents:
        title = doc.title
        doc_id = doc.doc_id
        data_type = doc.data_type
        section_keys = sorted(doc.sections.keys())

        def add_example(
            suffix: str,
            query_type: str,
            question: str,
            answer: str | None,
            section_key: str | None,
        ) -> None:
            if answer is None:
                return
            examples.append(
                Example(
                    id=f"{doc_id}:{suffix}",
                    query_type=query_type,
                    data_type=data_type,
                    doc_id=doc_id,
                    question=question,
                    gold_answer=answer,
                    gold_section=section_key,
                    gold_chunk_ids=[
                        f"{data_type}:{doc_id}:{section_key}"
                    ]
                    if section_key
                    else [f"{data_type}:{doc_id}:content"],
                    no_answer=False,
                )
            )

        if data_type == "adrs":
            add_example(
                "status",
                "metadata",
                f"What is the status of {doc_id}?",
                doc.metadata.get("status"),
                None,
            )
            if "decision" in doc.sections:
                add_example(
                    "decision",
                    "section",
                    f"What decision does {doc_id} make?",
                    first_sentence(doc.sections["decision"]),
                    "decision",
                )
            if "consequences" in doc.sections:
                add_example(
                    "consequences",
                    "section",
                    f"What consequence does {doc_id} mention?",
                    first_sentence(doc.sections["consequences"]),
                    "consequences",
                )
        elif data_type == "rfcs":
            add_example(
                "status",
                "metadata",
                f"What is the status of {doc_id}?",
                doc.metadata.get("status"),
                None,
            )
            if "problem_statement" in doc.sections:
                add_example(
                    "problem",
                    "section",
                    f"What problem does {doc_id} describe?",
                    first_sentence(doc.sections["problem_statement"]),
                    "problem_statement",
                )
            if "trade_offs" in doc.sections:
                add_example(
                    "tradeoffs",
                    "section",
                    f"What trade-offs does {doc_id} note?",
                    first_sentence(doc.sections["trade_offs"]),
                    "trade_offs",
                )
        elif data_type == "meeting_notes":
            add_example(
                "date",
                "metadata",
                f"When was {doc_id} held?",
                doc.metadata.get("date"),
                None,
            )
            if "decisions_made" in doc.sections:
                add_example(
                    "decisions",
                    "section",
                    f"What decisions were made in {doc_id}?",
                    first_sentence(doc.sections["decisions_made"]),
                    "decisions_made",
                )
            if "action_items" in doc.sections:
                add_example(
                    "actions",
                    "section",
                    f"What action items were assigned in {doc_id}?",
                    first_sentence(doc.sections["action_items"]),
                    "action_items",
                )
        elif data_type == "postmortems":
            add_example(
                "severity",
                "metadata",
                f"What severity is listed for {doc_id}?",
                doc.metadata.get("severity"),
                None,
            )
            if "root_cause" in doc.sections:
                add_example(
                    "root_cause",
                    "section",
                    f"What was the root cause in {doc_id}?",
                    first_sentence(doc.sections["root_cause"]),
                    "root_cause",
                )
            if "resolution" in doc.sections:
                add_example(
                    "resolution",
                    "section",
                    f"What was the resolution in {doc_id}?",
                    first_sentence(doc.sections["resolution"]),
                    "resolution",
                )
        elif data_type == "tickets":
            add_example(
                "priority",
                "metadata",
                f"What priority is listed for {doc_id}?",
                doc.metadata.get("priority"),
                None,
            )
            if "description" in doc.sections:
                add_example(
                    "description",
                    "section",
                    f"What does {doc_id} ask for?",
                    first_sentence(doc.sections["description"]),
                    "description",
                )
            if "resolution" in doc.sections:
                add_example(
                    "resolution",
                    "section",
                    f"What was the resolution for {doc_id}?",
                    first_sentence(doc.sections["resolution"]),
                    "resolution",
                )

        if doc.sections:
            first_section_key = section_keys[0]
            add_example(
                "section_summary",
                "section",
                f"What does {doc_id} say in the {first_section_key.replace('_', ' ')} section?",
                truncate_words(first_sentence(doc.sections[first_section_key]), 18),
                first_section_key,
            )

    for index, prompt in enumerate(negative_prompts, start=1):
        examples.append(
            Example(
                id=f"negative:{index}",
                query_type="negative",
                data_type="mixed",
                doc_id=None,
                question=prompt,
                gold_answer=None,
                gold_section=None,
                gold_chunk_ids=[],
                no_answer=True,
            )
        )

    return examples


class SimpleBM25Index:
    def __init__(self, chunks: List[Dict]):
        self.chunks = chunks
        self.docs = [tokenize(f"{c['chunk_id']} {c['text']} {c.get('metadata', {}).get('title', '')}") for c in chunks]
        self.doc_freq = Counter()
        for doc in self.docs:
            for term in set(doc):
                self.doc_freq[term] += 1
        self.avgdl = sum(len(doc) for doc in self.docs) / max(1, len(self.docs))
        self.k1 = 1.5
        self.b = 0.75

    def search(self, query: str, top_k: int = 5, with_scores: bool = False) -> List[Dict]:
        q_terms = tokenize(query)
        if not q_terms or not self.docs:
            return []

        q_counts = Counter(q_terms)
        scored = []
        total_docs = len(self.docs)
        for idx, doc in enumerate(self.docs):
            doc_counts = Counter(doc)
            score = 0.0
            doc_len = len(doc)
            norm = self.k1 * (1 - self.b + self.b * doc_len / self.avgdl)
            for term, q_freq in q_counts.items():
                tf = doc_counts.get(term, 0)
                if tf == 0:
                    continue
                df = self.doc_freq.get(term, 0)
                idf = math.log(1 + (total_docs - df + 0.5) / (df + 0.5))
                score += idf * ((tf * (self.k1 + 1)) / (tf + norm)) * q_freq
            if score > 0:
                scored.append((score, self.chunks[idx]))

        scored.sort(key=lambda item: item[0], reverse=True)
        ranked = scored[:top_k]
        if not with_scores:
            return [chunk for score, chunk in ranked]
        return [
            {"chunk": chunk, "score": float(score), "rank": rank}
            for rank, (score, chunk) in enumerate(ranked, start=1)
        ]


def get_retriever(chunks: List[Dict]):
    if RepoBM25Index is not None:
        return RepoBM25Index(chunks)
    return SimpleBM25Index(chunks)


def retrieve(index, query: str, top_k: int = 5) -> List[Dict]:
    results = index.search(query, top_k=top_k)
    if results and isinstance(results[0], dict) and "chunk" in results[0]:
        return [item["chunk"] for item in results]
    return results


def score_examples(examples: Sequence[Example], chunks: Sequence[Dict], index) -> Dict:
    metrics = {
        "total": len(examples),
        "positive": 0,
        "negative": 0,
        "retrieval_at_1": 0,
        "retrieval_at_3": 0,
        "retrieval_at_5": 0,
        "mrr": [],
        "answer_support_at_1": 0,
        "answer_support_at_3": 0,
        "no_answer_accuracy": 0,
        "abstain_threshold_hits": 0,
    }
    by_type = defaultdict(lambda: Counter())
    detailed_rows = []

    for example in examples:
        ranked = index.search(example.question, top_k=5, with_scores=True)
        retrieved = [row["chunk"] for row in ranked]
        top_score = ranked[0]["score"] if ranked else 0.0
        retrieved_doc_ids = [chunk.get("doc_id") for chunk in retrieved]
        retrieved_chunk_ids = [chunk.get("chunk_id") for chunk in retrieved]
        top_texts = [normalize_text(chunk.get("text", "")) for chunk in retrieved[:3]]
        gold_chunk_ids = set(example.gold_chunk_ids)
        predicted_no_answer = top_score < NO_ANSWER_SCORE_THRESHOLD
        matched_rank = next(
            (idx for idx, chunk_id in enumerate(retrieved_chunk_ids, start=1) if chunk_id in gold_chunk_ids),
            None,
        )

        if example.no_answer:
            metrics["negative"] += 1
            metrics["no_answer_accuracy"] += int(predicted_no_answer)
            metrics["abstain_threshold_hits"] += int(predicted_no_answer)
            by_type["negative"]["count"] += 1
            by_type["negative"]["no_answer"] += int(predicted_no_answer)
        else:
            metrics["positive"] += 1
            has_gold_1 = matched_rank == 1
            has_gold_3 = matched_rank is not None and matched_rank <= 3
            has_gold_5 = matched_rank is not None and matched_rank <= 5
            metrics["retrieval_at_1"] += int(has_gold_1)
            metrics["retrieval_at_3"] += int(has_gold_3)
            metrics["retrieval_at_5"] += int(has_gold_5)
            if matched_rank is not None:
                metrics["mrr"].append(1 / matched_rank)
            answer_anchor = normalize_text(example.gold_answer or "")
            support_hit = any(answer_anchor and answer_anchor in text for text in top_texts)
            metrics["answer_support_at_1"] += int(bool(top_texts and answer_anchor and answer_anchor in top_texts[0]))
            metrics["answer_support_at_3"] += int(support_hit)
            by_type[example.data_type]["count"] += 1
            by_type[example.data_type]["retrieval_at_1"] += int(has_gold_1)
            by_type[example.data_type]["retrieval_at_3"] += int(has_gold_3)
            by_type[example.data_type]["retrieval_at_5"] += int(has_gold_5)
            by_type[example.data_type]["support_at_3"] += int(support_hit)
            if matched_rank is not None:
                by_type[example.data_type]["mrr_sum"] += 1 / matched_rank

        detailed_rows.append(
            {
                "id": example.id,
                "question": example.question,
                "gold_doc_id": example.doc_id,
                "gold_chunk_ids": example.gold_chunk_ids,
                "retrieved_doc_ids": retrieved_doc_ids,
                "retrieved_chunk_ids": retrieved_chunk_ids,
                "top_score": round(top_score, 4),
                "predicted_no_answer": predicted_no_answer,
                "matched_gold_rank": matched_rank,
                "no_answer": example.no_answer,
            }
        )

    total_positive = max(1, metrics["positive"])
    total_negative = max(1, metrics["negative"])
    total_examples = max(1, metrics["total"])

    summary = {
        "total_examples": metrics["total"],
        "positive_examples": metrics["positive"],
        "negative_examples": metrics["negative"],
        "retrieval_recall@1": round(metrics["retrieval_at_1"] / total_positive, 4),
        "retrieval_recall@3": round(metrics["retrieval_at_3"] / total_positive, 4),
        "retrieval_recall@5": round(metrics["retrieval_at_5"] / total_positive, 4),
        "mrr": round(mean(metrics["mrr"]) if metrics["mrr"] else 0.0, 4),
        "answer_support@1": round(metrics["answer_support_at_1"] / total_positive, 4),
        "answer_support@3": round(metrics["answer_support_at_3"] / total_positive, 4),
        "no_answer_accuracy": round(metrics["no_answer_accuracy"] / total_negative, 4),
        "abstain_threshold": NO_ANSWER_SCORE_THRESHOLD,
        "per_type": {},
    }

    for data_type, counts in by_type.items():
        count = max(1, counts["count"])
        summary["per_type"][data_type] = {
            "count": counts["count"],
            "retrieval_recall@1": round(counts["retrieval_at_1"] / count, 4),
            "retrieval_recall@3": round(counts["retrieval_at_3"] / count, 4),
            "retrieval_recall@5": round(counts["retrieval_at_5"] / count, 4),
            "answer_support@3": round(counts["support_at_3"] / count, 4),
            "mrr": round((counts["mrr_sum"] / count) if counts["mrr_sum"] else 0.0, 4),
        }

    return {"summary": summary, "rows": detailed_rows}


def write_dataset(examples: Sequence[Example]) -> None:
    with DATASET_PATH.open("w", encoding="utf-8") as f:
        for example in examples:
            f.write(json.dumps(asdict(example), ensure_ascii=False) + "\n")


def write_dataset_csv(examples: Sequence[Example]) -> None:
    fieldnames = [
        "id",
        "query_type",
        "data_type",
        "doc_id",
        "question",
        "gold_answer",
        "gold_section",
        "gold_chunk_ids",
        "no_answer",
    ]
    with DATASET_CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for example in examples:
            row = asdict(example)
            row["gold_chunk_ids"] = " | ".join(example.gold_chunk_ids)
            writer.writerow({key: row.get(key) for key in fieldnames})


def write_results_csv(results: Dict) -> None:
    rows = []
    corpus = results["corpus"]
    metrics = results["metrics"]
    for key, value in corpus.items():
        rows.append({"scope": "corpus", "name": key, "value": value})
    for key, value in metrics.items():
        if key != "per_type":
            rows.append({"scope": "overall", "name": key, "value": value})
    for data_type, type_metrics in metrics["per_type"].items():
        for key, value in type_metrics.items():
            rows.append({"scope": data_type, "name": key, "value": value})

    with RESULTS_CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["scope", "name", "value"])
        writer.writeheader()
        writer.writerows(rows)


def write_examples_csv(rows: Sequence[Dict]) -> None:
    fieldnames = [
        "id",
        "question",
        "gold_doc_id",
        "gold_chunk_ids",
        "retrieved_doc_ids",
        "retrieved_chunk_ids",
        "top_score",
        "predicted_no_answer",
        "matched_gold_rank",
        "no_answer",
    ]
    with EXAMPLES_CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            flat = dict(row)
            flat["gold_chunk_ids"] = " | ".join(flat.get("gold_chunk_ids") or [])
            flat["retrieved_doc_ids"] = " | ".join(flat.get("retrieved_doc_ids") or [])
            flat["retrieved_chunk_ids"] = " | ".join(flat.get("retrieved_chunk_ids") or [])
            writer.writerow({key: flat.get(key) for key in fieldnames})


def validate_examples(examples: Sequence[Example], chunks: Sequence[Dict]) -> Dict:
    chunk_ids = {chunk["chunk_id"] for chunk in chunks}
    issues = []
    seen_ids = set()

    for example in examples:
        if example.id in seen_ids:
            issues.append({"example_id": example.id, "issue": "duplicate_example_id"})
        seen_ids.add(example.id)

        if example.no_answer:
            if example.gold_chunk_ids:
                issues.append({"example_id": example.id, "issue": "negative_example_has_gold_chunk_ids"})
            if example.gold_answer is not None:
                issues.append({"example_id": example.id, "issue": "negative_example_has_gold_answer"})
            continue

        if not example.gold_answer:
            issues.append({"example_id": example.id, "issue": "positive_example_missing_gold_answer"})
        if not example.gold_chunk_ids:
            issues.append({"example_id": example.id, "issue": "positive_example_missing_gold_chunk_ids"})
        for chunk_id in example.gold_chunk_ids:
            if chunk_id not in chunk_ids:
                issues.append({"example_id": example.id, "issue": f"missing_chunk:{chunk_id}"})

    counts = Counter(example.data_type for example in examples)
    validation = {
        "examples": len(examples),
        "chunks": len(chunks),
        "issues": issues,
        "issue_count": len(issues),
        "counts_by_type": dict(counts),
        "status": "pass" if not issues else "fail",
    }
    VALIDATION_PATH.write_text(json.dumps(validation, ensure_ascii=False, indent=2), encoding="utf-8")
    if issues:
        raise ValueError(f"Eval dataset validation failed: {issues[:5]}")
    return validation


def main() -> None:
    documents = load_documents()
    chunks = build_chunks(documents)
    examples = make_examples(documents)
    write_dataset(examples)
    write_dataset_csv(examples)
    validation = validate_examples(examples, chunks)

    index = get_retriever(chunks)
    scored = score_examples(examples, chunks, index)

    results = {
        "corpus": {
            "documents": len(documents),
            "chunks": len(chunks),
            "dataset_examples": len(examples),
        },
        "metrics": scored["summary"],
        "examples": scored["rows"],
    }

    RESULTS_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    write_results_csv(results)
    write_examples_csv(scored["rows"])

    print("EDMS synthetic eval")
    print(f"Documents: {len(documents)}")
    print(f"Chunks: {len(chunks)}")
    print(f"Examples: {len(examples)}")
    print(f"Validation: {validation['status']} ({validation['issue_count']} issues)")
    print(f"Retrieval@1: {results['metrics']['retrieval_recall@1']:.4f}")
    print(f"Retrieval@3: {results['metrics']['retrieval_recall@3']:.4f}")
    print(f"Retrieval@5: {results['metrics']['retrieval_recall@5']:.4f}")
    print(f"MRR: {results['metrics']['mrr']:.4f}")
    print(f"Answer support@1: {results['metrics']['answer_support@1']:.4f}")
    print(f"Answer support@3: {results['metrics']['answer_support@3']:.4f}")
    print(
        f"No-answer accuracy: {results['metrics']['no_answer_accuracy']:.4f} "
        f"(threshold={results['metrics']['abstain_threshold']:.2f})"
    )
    print("Per type:")
    for data_type, metrics in results["metrics"]["per_type"].items():
        print(
            f"  {data_type}: "
            f"n={metrics['count']} "
            f"R@1={metrics['retrieval_recall@1']:.4f} "
            f"R@3={metrics['retrieval_recall@3']:.4f} "
            f"R@5={metrics['retrieval_recall@5']:.4f} "
            f"Ans@3={metrics['answer_support@3']:.4f} "
            f"MRR={metrics['mrr']:.4f}"
        )
    print(f"Dataset written to: {DATASET_PATH}")
    print(f"Dataset CSV written to: {DATASET_CSV_PATH}")
    print(f"Results written to: {RESULTS_PATH}")
    print(f"Results CSV written to: {RESULTS_CSV_PATH}")
    print(f"Examples CSV written to: {EXAMPLES_CSV_PATH}")
    print(f"Validation written to: {VALIDATION_PATH}")


if __name__ == "__main__":
    main()

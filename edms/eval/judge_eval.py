from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from collections import defaultdict
from dataclasses import asdict
from pathlib import Path
from statistics import mean
from typing import Dict, List

ROOT = Path(__file__).resolve().parents[2]
EDMS_DIR = ROOT / "edms"
EVAL_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = Path(__file__).resolve().parent
DATASET_PATH = OUTPUT_DIR / "synthetic_dataset.jsonl"
RESULTS_PATH = OUTPUT_DIR / "llm_judge_results.json"
RESULTS_CSV_PATH = OUTPUT_DIR / "llm_judge_results.csv"
DEFAULT_JUDGE_MODEL = os.getenv("JUDGE_MODEL", "gpt-4o-mini")
DEFAULT_BATCH_SIZE = 6
DEFAULT_TOP_K = 3

if str(EDMS_DIR) not in sys.path:
    sys.path.insert(0, str(EDMS_DIR))
if str(EVAL_DIR) not in sys.path:
    sys.path.insert(0, str(EVAL_DIR))

from openai import OpenAI  # noqa: E402

from run_eval import build_chunks, get_retriever, load_documents  # noqa: E402


def load_examples() -> List[Dict]:
    examples = []
    with DATASET_PATH.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                examples.append(json.loads(line))
    return examples


def score_scale(value):
    try:
        score = int(value)
    except Exception:
        return 0
    return max(0, min(5, score))


def chunk_context(chunk: Dict) -> str:
    text = " ".join((chunk.get("text") or "").split())
    if len(text) > 280:
        text = f"{text[:280].rstrip()}..."
    return (
        f"{chunk.get('chunk_id')} | {chunk.get('data_type')} | {chunk.get('section_type')}\n"
        f"{text}"
    )


def build_batches(items: List[Dict], batch_size: int) -> List[List[Dict]]:
    return [items[index : index + batch_size] for index in range(0, len(items), batch_size)]


def judge_batch(client: OpenAI, model: str, batch: List[Dict]) -> List[Dict]:
    payload = []
    for item in batch:
        payload.append(
            {
                "id": item["id"],
                "query_type": item["query_type"],
                "question": item["question"],
                "no_answer": item["no_answer"],
                "gold_answer": item["gold_answer"],
                "gold_section": item["gold_section"],
                "retrieved": item["retrieved"],
            }
        )

    system = (
        "You are a strict evaluation judge for a retrieval-augmented generation system. "
        "Score each case using only the provided question, gold answer, and retrieved evidence. "
        "Return JSON only with an object containing an items array. "
        "Each item must include: id, groundedness, answer_quality, citation_quality, abstention_quality, overall, reason. "
        "Use integers 1-5 where 5 is best. "
        "For no-answer cases, answer_quality may be null and abstention_quality should reflect whether the evidence correctly supports abstaining. "
        "Keep reasons short."
    )
    user = {
        "cases": payload,
        "rubric": {
            "groundedness": "Does the retrieved evidence support the expected answer?",
            "answer_quality": "How complete and correct is the answer implied by the evidence?",
            "citation_quality": "Would the evidence be appropriate to cite back to the user?",
            "abstention_quality": "For no-answer cases, does the evidence justify saying no grounded answer exists?",
            "overall": "Overall RAG quality for this case.",
        },
        "output_format": {
            "items": [
                {
                    "id": "string",
                    "groundedness": 5,
                    "answer_quality": 5,
                    "citation_quality": 5,
                    "abstention_quality": 5,
                    "overall": 5,
                    "reason": "short string",
                }
            ]
        },
    }

    response = client.chat.completions.create(
        model=model,
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": json.dumps(user, ensure_ascii=False)},
        ],
    )
    content = response.choices[0].message.content or "{}"
    parsed = json.loads(content)
    return parsed.get("items", [])


def main() -> None:
    parser = argparse.ArgumentParser(description="Judge EDMS synthetic retrieval outputs with an LLM.")
    parser.add_argument("--model", default=DEFAULT_JUDGE_MODEL)
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--top-k", type=int, default=DEFAULT_TOP_K)
    parser.add_argument("--limit", type=int, default=0, help="Optional example limit for quick runs.")
    args = parser.parse_args()

    examples = load_examples()
    if args.limit and args.limit > 0:
        examples = examples[: args.limit]

    documents = load_documents()
    chunks = build_chunks(documents)
    index = get_retriever(chunks)

    enriched = []
    for example in examples:
        ranked = index.search(example["question"], top_k=args.top_k, with_scores=True)
        retrieved = [
            {
                "chunk_id": row["chunk"].get("chunk_id"),
                "doc_id": row["chunk"].get("doc_id"),
                "data_type": row["chunk"].get("data_type"),
                "section_type": row["chunk"].get("section_type"),
                "score": round(float(row["score"]), 4),
                "text": row["chunk"].get("text", ""),
            }
            for row in ranked
        ]
        enriched.append(
            {
                **example,
                "retrieved": retrieved,
            }
        )

    client = OpenAI()
    batches = build_batches(enriched, args.batch_size)
    scored_items: List[Dict] = []
    for batch in batches:
        scored_items.extend(judge_batch(client, args.model, batch))

    score_map = {item["id"]: item for item in scored_items if isinstance(item, dict) and item.get("id")}

    per_type: Dict[str, Dict[str, List[int]]] = defaultdict(lambda: defaultdict(list))
    overall_scores = []
    grounded_scores = []
    answer_scores = []
    citation_scores = []
    abstain_scores = []

    detailed_rows = []
    for example in enriched:
        judged = score_map.get(example["id"], {})
        grounded = score_scale(judged.get("groundedness"))
        answer = judged.get("answer_quality")
        answer_score = score_scale(answer) if answer is not None else None
        citation = score_scale(judged.get("citation_quality"))
        abstain = score_scale(judged.get("abstention_quality"))
        overall = score_scale(judged.get("overall"))
        reason = judged.get("reason", "")

        overall_scores.append(overall)
        grounded_scores.append(grounded)
        citation_scores.append(citation)
        abstain_scores.append(abstain)
        if answer_score is not None:
            answer_scores.append(answer_score)

        bucket = "negative" if example["no_answer"] else example["data_type"]
        per_type[bucket]["overall"].append(overall)
        per_type[bucket]["groundedness"].append(grounded)
        per_type[bucket]["citation_quality"].append(citation)
        per_type[bucket]["abstention_quality"].append(abstain)
        if answer_score is not None:
            per_type[bucket]["answer_quality"].append(answer_score)

        detailed_rows.append(
            {
                "id": example["id"],
                "question": example["question"],
                "no_answer": example["no_answer"],
                "judge": {
                    "groundedness": grounded,
                    "answer_quality": answer_score,
                    "citation_quality": citation,
                    "abstention_quality": abstain,
                    "overall": overall,
                    "reason": reason,
                },
                "retrieved": example["retrieved"],
            }
        )

    def avg(values: List[int]) -> float:
        return round(mean(values), 4) if values else 0.0

    summary = {
        "model": args.model,
        "examples": len(enriched),
        "overall": avg(overall_scores),
        "groundedness": avg(grounded_scores),
        "answer_quality": avg(answer_scores),
        "citation_quality": avg(citation_scores),
        "abstention_quality": avg(abstain_scores),
        "per_type": {},
    }
    for bucket, metrics in per_type.items():
        summary["per_type"][bucket] = {
            "count": len(metrics.get("overall", [])),
            "overall": avg(metrics.get("overall", [])),
            "groundedness": avg(metrics.get("groundedness", [])),
            "answer_quality": avg(metrics.get("answer_quality", [])),
            "citation_quality": avg(metrics.get("citation_quality", [])),
            "abstention_quality": avg(metrics.get("abstention_quality", [])),
        }

    results = {
        "summary": summary,
        "rows": detailed_rows,
    }
    RESULTS_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    with RESULTS_CSV_PATH.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "id",
                "query_type",
                "no_answer",
                "groundedness",
                "answer_quality",
                "citation_quality",
                "abstention_quality",
                "overall",
                "reason",
            ],
        )
        writer.writeheader()
        for row in detailed_rows:
            judge = row.get("judge", {})
            writer.writerow(
                {
                    "id": row.get("id"),
                    "query_type": row.get("query_type"),
                    "no_answer": row.get("no_answer"),
                    "groundedness": judge.get("groundedness"),
                    "answer_quality": judge.get("answer_quality"),
                    "citation_quality": judge.get("citation_quality"),
                    "abstention_quality": judge.get("abstention_quality"),
                    "overall": judge.get("overall"),
                    "reason": judge.get("reason"),
                }
            )

    print("EDMS LLM judge eval")
    print(f"Model: {args.model}")
    print(f"Examples: {summary['examples']}")
    print(f"Overall: {summary['overall']:.4f}")
    print(f"Groundedness: {summary['groundedness']:.4f}")
    print(f"Answer quality: {summary['answer_quality']:.4f}")
    print(f"Citation quality: {summary['citation_quality']:.4f}")
    print(f"Abstention quality: {summary['abstention_quality']:.4f}")
    print("Per type:")
    for bucket, metrics in summary["per_type"].items():
        print(
            f"  {bucket}: "
            f"n={metrics['count']} "
            f"overall={metrics['overall']:.4f} "
            f"grounded={metrics['groundedness']:.4f} "
            f"answer={metrics['answer_quality']:.4f} "
            f"citation={metrics['citation_quality']:.4f} "
            f"abstain={metrics['abstention_quality']:.4f}"
        )
    print(f"Results written to: {RESULTS_PATH}")
    print(f"Results CSV written to: {RESULTS_CSV_PATH}")


if __name__ == "__main__":
    main()

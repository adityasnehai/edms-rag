# EDMS Eval

This folder contains a synthetic benchmark for the EDMS RAG pipeline.

## What it evaluates
- Retrieval recall@1/3/5
- Mean reciprocal rank
- Source citation hit rate
- Answer anchor match
- Abstention on out-of-scope questions

## Run

```bash
cd /home/aditya/projects/edms-rag/edms
python eval/run_eval.py
```

The script generates:
- `synthetic_dataset.jsonl`
- `synthetic_dataset.csv`
- `eval_results.json`
- `eval_summary.csv`
- `eval_examples.csv`
- `eval_validation.json`

LLM judge pass:

```bash
cd /home/aditya/projects/edms-rag/edms
python3 eval/judge_eval.py
```

This writes `llm_judge_results.json`.
The judge script also writes `llm_judge_results.csv`.

import os
from threading import BoundedSemaphore

from openai import OpenAI

from src.runtime_config import (
    GENERATION_MAX_OUTPUT_TOKENS,
    GENERATION_TIMEOUT_SECONDS,
    LLM_WORKER_MAX_CONCURRENCY,
    OPENAI_TIMEOUT_SECONDS,
)
from src.telemetry import LLM_REQUESTS_TOTAL, stage_timer

_worker_slots = BoundedSemaphore(LLM_WORKER_MAX_CONCURRENCY)


def _openai_client() -> OpenAI:
    return OpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        timeout=GENERATION_TIMEOUT_SECONDS or OPENAI_TIMEOUT_SECONDS,
        max_retries=0,
    )


def run_completion(model: str, messages):
    acquired = _worker_slots.acquire(timeout=GENERATION_TIMEOUT_SECONDS or OPENAI_TIMEOUT_SECONDS)
    if not acquired:
        raise RuntimeError("LLM worker is busy")

    try:
        client = _openai_client()
        with stage_timer("llm_completion", model=model):
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.2,
                max_tokens=GENERATION_MAX_OUTPUT_TOKENS,
            )
        if LLM_REQUESTS_TOTAL:
            LLM_REQUESTS_TOTAL.labels(model=model, mode="sync", fallback_used="false").inc()
        return response
    finally:
        _worker_slots.release()


def stream_completion(model: str, messages):
    acquired = _worker_slots.acquire(timeout=GENERATION_TIMEOUT_SECONDS or OPENAI_TIMEOUT_SECONDS)
    if not acquired:
        raise RuntimeError("LLM worker is busy")

    client = _openai_client()
    released = False

    def release_once():
        nonlocal released
        if not released:
            _worker_slots.release()
            released = True

    try:
        with stage_timer("llm_stream_start", model=model):
            stream = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.2,
                max_tokens=GENERATION_MAX_OUTPUT_TOKENS,
                stream=True,
            )
        if LLM_REQUESTS_TOTAL:
            LLM_REQUESTS_TOTAL.labels(model=model, mode="stream", fallback_used="false").inc()
    except Exception:
        release_once()
        raise

    def iterator():
        try:
            for chunk in stream:
                yield chunk
        finally:
            release_once()

    return iterator()

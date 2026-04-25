import json
import logging
import os
import sys
import time
from contextlib import contextmanager
from contextvars import ContextVar
from logging.handlers import RotatingFileHandler
from typing import Any

from src.runtime_config import ENABLE_METRICS, ERROR_TRACKING_DSN, LOG_JSON, LOG_LEVEL, SENTRY_ENVIRONMENT

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", request_id_var.get("-")),
        }
        for key in (
            "route",
            "method",
            "status_code",
            "latency_ms",
            "user_id",
            "org_id",
            "org_slug",
            "stage",
            "stage_latency_ms",
            "job_id",
            "error_type",
            "model",
            "top_k",
            "retrieved_chunks",
            "cache_hit",
            "fallback_used",
        ):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=True)


def configure_logging() -> None:
    root = logging.getLogger()
    root.setLevel(getattr(logging, LOG_LEVEL, logging.INFO))
    formatter = JsonFormatter() if LOG_JSON else logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    handlers = [stream_handler]
    os.makedirs("logs", exist_ok=True)
    file_handler = RotatingFileHandler("logs/edms.log", maxBytes=5 * 1024 * 1024, backupCount=5)
    file_handler.setFormatter(formatter)
    handlers.append(file_handler)
    root.handlers = handlers


def init_sentry() -> None:
    if not ERROR_TRACKING_DSN:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
    except Exception:
        return
    sentry_sdk.init(
        dsn=ERROR_TRACKING_DSN,
        environment=SENTRY_ENVIRONMENT,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
    )


logger = logging.getLogger("edms")


try:
    if ENABLE_METRICS:
        from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, Histogram, generate_latest
    else:
        CONTENT_TYPE_LATEST = "text/plain"
        Counter = Gauge = Histogram = None
        generate_latest = lambda: b""  # type: ignore
except Exception:
    ENABLE_METRICS = False
    CONTENT_TYPE_LATEST = "text/plain"
    Counter = Gauge = Histogram = None
    generate_latest = lambda: b""  # type: ignore


HTTP_REQUESTS_TOTAL = Counter("edms_http_requests_total", "Total HTTP requests", ["route", "method", "status_code"]) if Counter else None
HTTP_REQUEST_LATENCY = Histogram("edms_http_request_latency_seconds", "HTTP latency", ["route", "method"]) if Histogram else None
STAGE_LATENCY = Histogram("edms_stage_latency_seconds", "Stage latency", ["stage"]) if Histogram else None
INGESTION_JOBS_TOTAL = Counter("edms_ingestion_jobs_total", "Ingestion jobs", ["status", "trigger_source", "data_type"]) if Counter else None
LLM_REQUESTS_TOTAL = Counter("edms_llm_requests_total", "LLM calls", ["model", "mode", "fallback_used"]) if Counter else None
RETRIEVAL_TOTAL = Counter("edms_retrieval_total", "Retrieval calls", ["fallback_used", "cache_hit"]) if Counter else None
QUEUE_DEPTH = Gauge("edms_queue_depth", "Queue depth", ["queue_name"]) if Gauge else None


def set_request_id(value: str) -> None:
    request_id_var.set(value)


def log_event(level: int, message: str, **fields: Any) -> None:
    extra = {"request_id": request_id_var.get("-"), **fields}
    logger.log(level, message, extra=extra)


@contextmanager
def stage_timer(stage: str, **fields: Any):
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        if STAGE_LATENCY:
            STAGE_LATENCY.labels(stage=stage).observe(elapsed)
        log_event(logging.INFO, "stage_complete", stage=stage, stage_latency_ms=round(elapsed * 1000, 2), **fields)


def observe_http(route: str, method: str, status_code: int, latency_seconds: float) -> None:
    if HTTP_REQUESTS_TOTAL:
        HTTP_REQUESTS_TOTAL.labels(route=route, method=method, status_code=str(status_code)).inc()
    if HTTP_REQUEST_LATENCY:
        HTTP_REQUEST_LATENCY.labels(route=route, method=method).observe(latency_seconds)


def metrics_payload() -> bytes:
    return generate_latest()

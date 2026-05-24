import json
import logging
import os
import sys
import time
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any

from src.runtime_config import (
    ENABLE_METRICS,
    ERROR_TRACKING_DSN,
    LOG_JSON,
    LOG_LEVEL,
    OTEL_EXPORTER_OTLP_ENDPOINT,
    OTEL_EXPORTER_OTLP_HEADERS,
    OTEL_SERVICE_NAME,
    OTEL_TRACES_ENABLED,
    SENTRY_ENVIRONMENT,
)

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

try:
    from opentelemetry import trace as otel_trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
    from opentelemetry.instrumentation.logging import LoggingInstrumentor
    from opentelemetry.instrumentation.requests import RequestsInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
except Exception:  # pragma: no cover - optional dependency
    otel_trace = None
    OTLPSpanExporter = None
    FastAPIInstrumentor = None
    HTTPXClientInstrumentor = None
    LoggingInstrumentor = None
    RequestsInstrumentor = None
    Resource = None
    TracerProvider = None
    BatchSpanProcessor = None


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        trace_id = getattr(record, "otelTraceID", None)
        span_id = getattr(record, "otelSpanID", None)
        if not trace_id and otel_trace is not None:
            span = otel_trace.get_current_span()
            if span is not None:
                context = span.get_span_context()
                if context is not None and context.is_valid:
                    trace_id = f"{context.trace_id:032x}"
                    span_id = f"{context.span_id:016x}"
        payload = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", request_id_var.get("-")),
        }
        if trace_id:
            payload["trace_id"] = trace_id
        if span_id:
            payload["span_id"] = span_id
        for key in (
            "event",
            "route",
            "method",
            "status_code",
            "latency_ms",
            "client_ip",
            "user_agent",
            "user_id",
            "org_id",
            "org_slug",
            "organization",
            "data_type",
            "filename",
            "file_count",
            "uploaded_count",
            "query_length",
            "result_count",
            "outcome",
            "stage",
            "stage_latency_ms",
            "job_id",
            "error_type",
            "model",
            "top_k",
            "retrieved_chunks",
            "cache_hit",
            "fallback_used",
            "index_status",
            "pipeline_status",
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
    root.handlers = [stream_handler]


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


def _parse_otlp_headers(raw_headers: str) -> dict[str, str]:
    headers: dict[str, str] = {}
    for item in raw_headers.split(","):
        if "=" not in item:
            continue
        key, value = item.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key:
            headers[key] = value
    return headers


def init_opentelemetry(app: Any | None = None) -> None:
    if not OTEL_TRACES_ENABLED or not OTEL_EXPORTER_OTLP_ENDPOINT:
        return
    if (
        otel_trace is None
        or OTLPSpanExporter is None
        or FastAPIInstrumentor is None
        or HTTPXClientInstrumentor is None
        or LoggingInstrumentor is None
        or RequestsInstrumentor is None
        or Resource is None
        or TracerProvider is None
        or BatchSpanProcessor is None
    ):
        return
    resource = Resource.create(
        {
            "service.name": OTEL_SERVICE_NAME,
            "service.namespace": "edms",
            "deployment.environment": SENTRY_ENVIRONMENT,
        }
    )
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(
        endpoint=OTEL_EXPORTER_OTLP_ENDPOINT,
        headers=_parse_otlp_headers(OTEL_EXPORTER_OTLP_HEADERS) or None,
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    otel_trace.set_tracer_provider(provider)
    LoggingInstrumentor().instrument(set_logging_format=False)
    RequestsInstrumentor().instrument()
    HTTPXClientInstrumentor().instrument()
    if app is not None:
        FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)


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

import os

ALLOW_DOTENV = os.getenv("ALLOW_DOTENV", "1").strip().lower() in {"1", "true", "yes"}
if ALLOW_DOTENV:
    from dotenv import load_dotenv
    load_dotenv()

from fastapi import FastAPI, Query, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.requests import Request
from starlette.responses import Response
from typing import Dict
import threading
import time
import uuid
from pydantic import BaseModel, Field
from src.runtime_config import CORS_ALLOW_ORIGINS, PRODUCTION_MODE

# -------------------------
# CREATE APP FIRST
# -------------------------
app = FastAPI(
    title="EDMS API",
    description="Enterprise Decision Memory System",
    version="0.1.0",
)

# -------------------------
# CORS
# -------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS or [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
        "http://localhost:5176",
        "http://127.0.0.1:5176",
        "http://localhost:5177",
        "http://127.0.0.1:5177",
        "http://localhost:5178",
        "http://127.0.0.1:5178",
        "http://localhost:5180",
        "http://127.0.0.1:5180",
        "http://localhost:5181",
        "http://127.0.0.1:5181",
        "http://localhost:5182",
        "http://127.0.0.1:5182",
        "http://localhost:5183",
        "http://127.0.0.1:5183",
    ],
    allow_origin_regex=None
    if PRODUCTION_MODE
    else (
        r"https?://("
        r"localhost|"
        r"127\.0\.0\.1|"
        r"0\.0\.0\.0|"
        r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
        r"192\.168\.\d{1,3}\.\d{1,3}|"
        r"172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}"
        r")(:\d+)?$"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
    set_request_id(request_id)
    started = time.perf_counter()
    response: Response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    response.headers.setdefault("Cache-Control", "no-store")
    response.headers.setdefault("X-Request-Id", request_id)
    elapsed = time.perf_counter() - started
    observe_http(request.url.path, request.method, response.status_code, elapsed)
    log_event(20, "http_request", route=request.url.path, method=request.method, status_code=response.status_code, latency_ms=round(elapsed * 1000, 2))
    return response



# -------------------------
# GLOBAL ERROR HANDLER
# -------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log_event(40, "unhandled_exception", route=request.url.path, method=request.method, error_type=exc.__class__.__name__)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# -------------------------
# IMPORT ROUTERS (AFTER APP)
# -------------------------
from src.api.auth_routes import router as auth_router
from src.api.admin_routes import router as admin_router
from src.api.chat_routes import (
    router as chat_router,
    _fallback_file_retrieval,
    _should_use_file_fallback_first,
)
from src.api.evidence_routes import router as evidence_router
from src.api.state_routes import router as state_router
from src.api.stats_routes import router as stats_router

from src.auth.dependencies import get_current_user
from src.auth.models import (
    create_user,
    get_or_create_organization,
    get_user_by_email,
    init_db,
    normalize_role,
)
from src.auth.auth import hash_password
from src.api.index_manager import (
    get_index_metadata,
    ensure_org_search_indexes,
    rebuild_all_vector_stores,
)
from src.ingestion.pipeline import start_ingestion_worker
from src.runtime_config import (
    CELERY_BROKER_URL,
    CELERY_RESULT_BACKEND,
    CORS_ALLOW_ORIGINS,
    ELASTICSEARCH_URL,
    LEXICAL_BACKEND,
    PRODUCTION_MODE,
    QUERY_MAX_CHARS,
    REDIS_URL,
    VECTOR_BACKEND,
)
from src.retriever import DEFAULT_TOP_K, MAX_TOP_K, retrieve_chunks, sanitize_top_k
from src.generator import generate_answer, stream_answer
from src.traffic_control import enforce_rate_limit, request_capacity_guard
from src.state_store import init_state_tables
from src.storage import validate_production_storage
from src.telemetry import CONTENT_TYPE_LATEST, configure_logging, init_opentelemetry, init_sentry, log_event, metrics_payload, observe_http, set_request_id, stage_timer
from src.cache_store import _get_redis_client
import requests


class SearchRequest(BaseModel):
    query: str = Field(..., max_length=QUERY_MAX_CHARS)
    top_k: int = DEFAULT_TOP_K


def _validated_query(query: str) -> str:
    cleaned = (query or "").strip()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    if len(cleaned) > QUERY_MAX_CHARS:
        raise HTTPException(status_code=400, detail="Query is too long")
    return cleaned

# -------------------------
# REGISTER ROUTERS (ORDER MATTERS)
# -------------------------
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(stats_router)
app.include_router(evidence_router)
app.include_router(chat_router)
app.include_router(state_router)

# -------------------------
# STARTUP
# -------------------------
@app.on_event("startup")
def startup_event():
    configure_logging()
    init_sentry()
    init_opentelemetry(app)
    os.makedirs("data", exist_ok=True)
    jwt_secret = os.getenv("JWT_SECRET", "")
    if not jwt_secret or jwt_secret in {"change-me", "secret", "test-jwt-secret"}:
        raise RuntimeError("JWT_SECRET must be set to a strong secret value")
    if PRODUCTION_MODE:
        if not REDIS_URL:
            raise RuntimeError("Production requires REDIS_URL")
        if not CELERY_BROKER_URL or not CELERY_RESULT_BACKEND:
            raise RuntimeError("Production requires Celery + Redis")
        if VECTOR_BACKEND != "pinecone":
            raise RuntimeError("Production requires Pinecone vector backend")
        if LEXICAL_BACKEND != "elasticsearch" or not ELASTICSEARCH_URL:
            raise RuntimeError("Production requires Elasticsearch/OpenSearch")
        if not CORS_ALLOW_ORIGINS:
            raise RuntimeError("Production requires explicit CORS_ALLOW_ORIGINS")
        validate_production_storage()
    init_db()
    init_state_tables()
    start_ingestion_worker()
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")
    admin_role = normalize_role(os.getenv("ADMIN_ROLE", "admin"))
    admin_org_name = os.getenv("ADMIN_ORG_NAME", "AcmeTech")
    if admin_email and admin_password:
        if admin_role not in ("admin", "user"):
            admin_role = "admin"
        if not get_user_by_email(admin_email):
            organization = get_or_create_organization(admin_org_name)
            create_user(
                admin_email,
                hash_password(admin_password),
                admin_role,
                organization["id"],
            )
    rebuild_on_startup = os.getenv(
        "REBUILD_ON_STARTUP",
        "1" if PRODUCTION_MODE else "0",
    ).strip().lower() in {"1", "true", "yes"}
    if rebuild_on_startup:
        threading.Thread(target=rebuild_all_vector_stores, daemon=True).start()

# -------------------------
# HEALTH
# -------------------------
@app.get("/")
def health():
    return {"status": "EDMS API is running"}


@app.get("/live")
def live():
    return {"status": "alive"}


@app.get("/ready")
def ready():
    dependencies = {"redis": "ok", "elasticsearch": "ok"}
    if REDIS_URL and _get_redis_client() is None:
        dependencies["redis"] = "unavailable"
    if ELASTICSEARCH_URL:
        try:
            response = requests.get(ELASTICSEARCH_URL, timeout=2)
            if response.status_code >= 400:
                dependencies["elasticsearch"] = "unavailable"
        except Exception:
            dependencies["elasticsearch"] = "unavailable"
    ready_state = all(value == "ok" for value in dependencies.values())
    return JSONResponse(
        status_code=200 if ready_state else 503,
        content={"status": "ready" if ready_state else "degraded", "dependencies": dependencies},
    )


@app.get("/metrics")
def metrics(request: Request):
    metrics_token = os.getenv("METRICS_API_KEY", "")
    if metrics_token:
        auth_header = request.headers.get("Authorization", "")
        query_token = request.query_params.get("token", "")
        provided = auth_header.removeprefix("Bearer ").strip() or query_token
        if provided != metrics_token:
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    return Response(content=metrics_payload(), media_type=CONTENT_TYPE_LATEST)

# -------------------------
# SEARCH
# -------------------------
@app.get("/search")
def search(
    q: str = Query(...),
    top_k: int = Query(DEFAULT_TOP_K, ge=1, le=MAX_TOP_K),
    user=Depends(get_current_user),
) -> Dict:
    cleaned_query = _validated_query(q)
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "search")
    org_slug = user["org_slug"]
    meta = get_index_metadata(org_slug)
    retrieved = None
    query_length = len(cleaned_query)
    with request_capacity_guard():
        if _should_use_file_fallback_first(meta):
            with stage_timer("search_file_retrieval", route="/search", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
                retrieved = _fallback_file_retrieval(
                    query=cleaned_query,
                    org_slug=org_slug,
                    org_id=user["org_id"],
                    top_k=top_k,
                )

        if retrieved is None:
            try:
                with stage_timer("search_retrieval", route="/search", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
                    store, bm25_index, meta = ensure_org_search_indexes(
                        org_slug,
                        user["org_id"],
                    )
                    retrieved = retrieve_chunks(
                        cleaned_query,
                        store,
                        bm25_index=bm25_index,
                        top_k=sanitize_top_k(top_k),
                        org_slug=org_slug,
                        index_version=meta.get("index_version"),
                    )
            except Exception as exc:
                log_event(
                    40,
                    "search_retrieval_failed",
                    route="/search",
                    user_id=user["id"],
                    org_id=user["org_id"],
                    org_slug=org_slug,
                    query_length=query_length,
                    index_status=meta.get("status"),
                    pipeline_status=meta.get("pipeline_status"),
                    error_type=exc.__class__.__name__,
                )
                retrieved = _fallback_file_retrieval(
                    query=cleaned_query,
                    org_slug=org_slug,
                    org_id=user["org_id"],
                    top_k=top_k,
                )
                meta = get_index_metadata(org_slug)
                if not retrieved:
                    return {
                        "query": cleaned_query,
                        "answer": (
                            "I could not find workspace content for this query yet. "
                            "Upload data or try again after indexing finishes."
                        ),
                        "evidence": [],
                    }

    if _should_use_file_fallback_first(meta) and retrieved:
        meta = {
            **meta,
            "index_version": f"file-fallback:{org_slug}",
        }

    if not retrieved:
        return {
            "query": cleaned_query,
            "answer": (
                "I can help with the documents, notes, tickets, "
                "postmortems, ADRs, RFCs, and diagrams available "
                "in this workspace.\n\n"
                "Try asking something more specific."
            ),
            "evidence": [],
        }

    with stage_timer("search_generation", route="/search", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
        result = generate_answer(
            cleaned_query,
            retrieved,
            org_slug=org_slug,
            index_version=meta.get("index_version"),
        )
    log_event(
        20,
        "search_completed",
        event="search",
        route="/search",
        user_id=user["id"],
        org_id=user["org_id"],
        org_slug=org_slug,
        query_length=query_length,
        result_count=len(result.get("evidence", [])),
        retrieved_chunks=len(retrieved),
        index_status=meta.get("status"),
        pipeline_status=meta.get("pipeline_status"),
    )

    return {
        "query": cleaned_query,
        "answer": result["answer"],
        "evidence": result["evidence"],
    }


@app.post("/search/stream")
def search_stream(
    data: SearchRequest,
    user=Depends(get_current_user),
):
    cleaned_query = _validated_query(data.query)
    enforce_rate_limit(f"org:{user['org_id']}:user:{user['id']}", "search")
    org_slug = user["org_slug"]
    meta = get_index_metadata(org_slug)
    retrieved = None
    query_length = len(cleaned_query)

    try:
        with request_capacity_guard():
            if _should_use_file_fallback_first(meta):
                with stage_timer("search_stream_file_retrieval", route="/search/stream", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
                    retrieved = _fallback_file_retrieval(
                        query=cleaned_query,
                        org_slug=org_slug,
                        org_id=user["org_id"],
                        top_k=data.top_k,
                    )

            if retrieved is None:
                with stage_timer("search_stream_retrieval", route="/search/stream", user_id=user["id"], org_id=user["org_id"], org_slug=org_slug):
                    store, bm25_index, meta = ensure_org_search_indexes(
                        org_slug,
                        user["org_id"],
                    )
                    retrieved = retrieve_chunks(
                        cleaned_query,
                        store,
                        bm25_index=bm25_index,
                        top_k=sanitize_top_k(data.top_k),
                        org_slug=org_slug,
                        index_version=meta.get("index_version"),
                    )
    except Exception as exc:
        log_event(
            40,
            "search_stream_retrieval_failed",
            route="/search/stream",
            user_id=user["id"],
            org_id=user["org_id"],
            org_slug=org_slug,
            query_length=query_length,
            index_status=meta.get("status"),
            pipeline_status=meta.get("pipeline_status"),
            error_type=exc.__class__.__name__,
        )
        retrieved = _fallback_file_retrieval(
            query=cleaned_query,
            org_slug=org_slug,
            org_id=user["org_id"],
            top_k=data.top_k,
        )
        meta = get_index_metadata(org_slug)

    if _should_use_file_fallback_first(meta) and retrieved:
        meta = {
            **meta,
            "index_version": f"file-fallback:{org_slug}",
        }

    def event_generator():
        if retrieved is None:
            yield (
                "I could not find workspace content for this query yet. "
                "Upload data or try again after indexing finishes."
            )
            return

        if not retrieved:
            yield (
                "I can help with the documents, notes, tickets, "
                "postmortems, ADRs, RFCs, and diagrams available "
                "in this workspace. Try asking something more specific."
            )
            return

        for token in stream_answer(
            query=cleaned_query,
            chunks=retrieved,
            org_slug=org_slug,
            index_version=meta.get("index_version"),
        ):
            yield token

        log_event(
            20,
            "search_stream_completed",
            event="search",
            route="/search/stream",
            user_id=user["id"],
            org_id=user["org_id"],
            org_slug=org_slug,
            query_length=query_length,
            retrieved_chunks=len(retrieved),
            index_status=meta.get("status"),
            pipeline_status=meta.get("pipeline_status"),
        )

    from fastapi.responses import StreamingResponse

    return StreamingResponse(event_generator(), media_type="text/plain")

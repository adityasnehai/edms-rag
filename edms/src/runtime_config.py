import os


APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
PRODUCTION_MODE = APP_ENV in {"prod", "production"}


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


CACHE_SCHEMA_VERSION = os.getenv("CACHE_SCHEMA_VERSION", "cache-v1")
CHUNKING_VERSION = os.getenv("CHUNKING_VERSION", "chunk-v1")
PROMPT_VERSION = os.getenv("PROMPT_VERSION", "prompt-v1")

VECTOR_BACKEND = os.getenv(
    "VECTOR_BACKEND",
    "pinecone" if PRODUCTION_MODE else "pinecone",
).strip().lower()
LEXICAL_BACKEND = os.getenv(
    "LEXICAL_BACKEND",
    "elasticsearch" if PRODUCTION_MODE else "local_bm25",
).strip().lower()
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/edms_auth.db").strip()

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
SMALL_GENERATION_MODEL = os.getenv("SMALL_GENERATION_MODEL", "gpt-4o-mini")
LARGE_GENERATION_MODEL = os.getenv("LARGE_GENERATION_MODEL", "gpt-4.1")
GENERATION_MODEL = SMALL_GENERATION_MODEL

COHERE_RERANK_MODEL = os.getenv("COHERE_RERANK_MODEL", "rerank-v4.0-fast")
COHERE_RERANK_URL = os.getenv("COHERE_RERANK_URL", "https://api.cohere.com/v2/rerank")
COHERE_RERANK_TIMEOUT_SECONDS = _float_env("COHERE_RERANK_TIMEOUT_SECONDS", 10.0)
COHERE_RERANK_MAX_DOC_CHARS = max(
    500,
    _int_env("COHERE_RERANK_MAX_DOC_CHARS", 4000),
)
RERANKER_VERSION = os.getenv(
    "RERANKER_VERSION",
    f"cohere:{COHERE_RERANK_MODEL}",
)

PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "edms-knowledge")
PINECONE_CLOUD = os.getenv("PINECONE_CLOUD", "aws")
PINECONE_REGION = os.getenv("PINECONE_REGION", "us-east-1")
PINECONE_METRIC = os.getenv("PINECONE_METRIC", "cosine")
PINECONE_UPSERT_BATCH_SIZE = max(10, _int_env("PINECONE_UPSERT_BATCH_SIZE", 100))

ELASTICSEARCH_URL = os.getenv("ELASTICSEARCH_URL", "").strip().rstrip("/")
ELASTICSEARCH_INDEX_PREFIX = os.getenv("ELASTICSEARCH_INDEX_PREFIX", "edms")
ELASTICSEARCH_TIMEOUT_SECONDS = _float_env("ELASTICSEARCH_TIMEOUT_SECONDS", 6.0)

REDIS_URL = os.getenv("REDIS_URL", "").strip()
REDIS_KEY_PREFIX = os.getenv("REDIS_KEY_PREFIX", "edms")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", "").strip()
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", "").strip()
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "0").strip() in {"1", "true", "yes"}
S3_BUCKET = os.getenv("S3_BUCKET", "").strip()
S3_REGION = os.getenv("S3_REGION", "").strip()
S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "").strip()
S3_ACCESS_KEY_ID = os.getenv("S3_ACCESS_KEY_ID", "").strip()
S3_SECRET_ACCESS_KEY = os.getenv("S3_SECRET_ACCESS_KEY", "").strip()
S3_PREFIX = os.getenv("S3_PREFIX", "edms").strip().strip("/")
OBJECT_STORAGE_BACKEND = os.getenv(
    "OBJECT_STORAGE_BACKEND",
    "s3" if PRODUCTION_MODE else "local",
).strip().lower()

FAISS_INDEX_TYPE = os.getenv("FAISS_INDEX_TYPE", "hnsw").strip().lower()
FAISS_HNSW_M = max(8, _int_env("FAISS_HNSW_M", 32))
FAISS_HNSW_EF_SEARCH = max(16, _int_env("FAISS_HNSW_EF_SEARCH", 64))
FAISS_HNSW_EF_CONSTRUCTION = max(32, _int_env("FAISS_HNSW_EF_CONSTRUCTION", 120))
FAISS_IVF_NLIST = max(4, _int_env("FAISS_IVF_NLIST", 64))
FAISS_IVF_NPROBE = max(1, _int_env("FAISS_IVF_NPROBE", 8))

OPENAI_TIMEOUT_SECONDS = _float_env("OPENAI_TIMEOUT_SECONDS", 20.0)
EMBEDDING_TIMEOUT_SECONDS = _float_env("EMBEDDING_TIMEOUT_SECONDS", 15.0)
GENERATION_TIMEOUT_SECONDS = _float_env("GENERATION_TIMEOUT_SECONDS", 30.0)
RETRY_MAX_ATTEMPTS = max(1, _int_env("RETRY_MAX_ATTEMPTS", 3))
RETRY_BASE_DELAY_SECONDS = max(0.1, _float_env("RETRY_BASE_DELAY_SECONDS", 0.4))
RETRY_MAX_DELAY_SECONDS = max(RETRY_BASE_DELAY_SECONDS, _float_env("RETRY_MAX_DELAY_SECONDS", 2.5))
LLM_WORKER_MAX_CONCURRENCY = max(1, _int_env("LLM_WORKER_MAX_CONCURRENCY", 4))
GENERATION_MAX_OUTPUT_TOKENS = max(128, _int_env("GENERATION_MAX_OUTPUT_TOKENS", 700))
QUERY_MAX_CHARS = max(64, _int_env("QUERY_MAX_CHARS", 4000))
CHAT_HISTORY_MAX_MESSAGES = max(1, _int_env("CHAT_HISTORY_MAX_MESSAGES", 24))

INGESTION_MAX_FILE_SIZE_BYTES = max(
    1024 * 50,
    _int_env("INGESTION_MAX_FILE_SIZE_BYTES", 1024 * 1024 * 8),
)
API_MAX_CONCURRENT_REQUESTS = max(1, _int_env("API_MAX_CONCURRENT_REQUESTS", 64))
RATE_LIMIT_WINDOW_SECONDS = max(1, _int_env("RATE_LIMIT_WINDOW_SECONDS", 60))
SEARCH_RATE_LIMIT_PER_WINDOW = max(1, _int_env("SEARCH_RATE_LIMIT_PER_WINDOW", 60))
CHAT_RATE_LIMIT_PER_WINDOW = max(1, _int_env("CHAT_RATE_LIMIT_PER_WINDOW", 90))
UPLOAD_RATE_LIMIT_PER_WINDOW = max(1, _int_env("UPLOAD_RATE_LIMIT_PER_WINDOW", 12))
AUTH_RATE_LIMIT_PER_WINDOW = max(1, _int_env("AUTH_RATE_LIMIT_PER_WINDOW", 20))
READ_RATE_LIMIT_PER_WINDOW = max(1, _int_env("READ_RATE_LIMIT_PER_WINDOW", 120))
PASSWORD_MIN_LENGTH = max(8, _int_env("PASSWORD_MIN_LENGTH", 10))
ORG_MAX_FILES = max(10, _int_env("ORG_MAX_FILES", 5000))
ORG_MAX_STORAGE_BYTES = max(1024 * 1024, _int_env("ORG_MAX_STORAGE_BYTES", 1024 * 1024 * 1024))
UPLOAD_MAX_FILES_PER_REQUEST = max(1, _int_env("UPLOAD_MAX_FILES_PER_REQUEST", 25))
REFRESH_TOKEN_EXPIRE_DAYS = max(1, _int_env("REFRESH_TOKEN_EXPIRE_DAYS", 14))
PASSWORD_RESET_TOKEN_EXPIRE_MINUTES = max(5, _int_env("PASSWORD_RESET_TOKEN_EXPIRE_MINUTES", 30))
EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS = max(1, _int_env("EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS", 24))
ALLOW_DOTENV = os.getenv("ALLOW_DOTENV", "1" if not PRODUCTION_MODE else "0").strip() in {"1", "true", "yes"}
CORS_ALLOW_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOW_ORIGINS", "").split(",")
    if origin.strip()
]
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").strip().upper()
LOG_JSON = os.getenv("LOG_JSON", "1").strip() in {"1", "true", "yes"}
ENABLE_METRICS = os.getenv("ENABLE_METRICS", "1").strip() in {"1", "true", "yes"}
GLITCHTIP_DSN = os.getenv("GLITCHTIP_DSN", "").strip()
SENTRY_DSN = os.getenv("SENTRY_DSN", "").strip()
ERROR_TRACKING_DSN = GLITCHTIP_DSN or SENTRY_DSN
SENTRY_ENVIRONMENT = os.getenv("SENTRY_ENVIRONMENT", APP_ENV).strip()

DEFAULT_TOP_K = max(1, _int_env("RETRIEVAL_TOP_K", 3))
MAX_TOP_K = max(DEFAULT_TOP_K, _int_env("RETRIEVAL_MAX_TOP_K", 10))
HYBRID_CANDIDATE_MULTIPLIER = max(
    2,
    _int_env("HYBRID_CANDIDATE_MULTIPLIER", 4),
)
RRF_K = max(1, _int_env("RETRIEVAL_RRF_K", 60))
RETRIEVAL_CONFIG_VERSION = os.getenv(
    "RETRIEVAL_CONFIG_VERSION",
    (
        "hybrid-v1"
        f":topk={DEFAULT_TOP_K}"
        f":max={MAX_TOP_K}"
        f":cand={HYBRID_CANDIDATE_MULTIPLIER}"
        f":rrf={RRF_K}"
    ),
)

DOCUMENT_EMBEDDING_CACHE_TTL_SECONDS = max(
    3600,
    _int_env("DOCUMENT_EMBEDDING_CACHE_TTL_SECONDS", 60 * 60 * 24 * 30),
)
QUERY_EMBEDDING_CACHE_TTL_SECONDS = max(
    300,
    _int_env("QUERY_EMBEDDING_CACHE_TTL_SECONDS", 60 * 60 * 24),
)
RETRIEVAL_CACHE_TTL_SECONDS = max(
    30,
    _int_env("RETRIEVAL_CACHE_TTL_SECONDS", 60 * 10),
)
ANSWER_CACHE_TTL_SECONDS = max(
    30,
    _int_env("ANSWER_CACHE_TTL_SECONDS", 60 * 3),
)
ROUTING_COMPLEX_QUERY_WORDS = max(8, _int_env("ROUTING_COMPLEX_QUERY_WORDS", 16))
ROUTING_COMPLEX_HISTORY_MESSAGES = max(2, _int_env("ROUTING_COMPLEX_HISTORY_MESSAGES", 6))
ROUTING_MIN_EVIDENCE_FOR_SMALL_MODEL = max(1, _int_env("ROUTING_MIN_EVIDENCE_FOR_SMALL_MODEL", 2))
ROUTING_LONG_EVIDENCE_CHARS = max(800, _int_env("ROUTING_LONG_EVIDENCE_CHARS", 2400))


def get_cache_versions() -> dict:
    return {
        "cache_schema": CACHE_SCHEMA_VERSION,
        "chunking": CHUNKING_VERSION,
        "embedding_model": EMBEDDING_MODEL,
        "reranker": RERANKER_VERSION,
        "prompt": PROMPT_VERSION,
        "retrieval": RETRIEVAL_CONFIG_VERSION,
        "generation": f"small={SMALL_GENERATION_MODEL}:large={LARGE_GENERATION_MODEL}",
        "vector_backend": VECTOR_BACKEND,
        "lexical_backend": LEXICAL_BACKEND,
        "faiss_index_type": FAISS_INDEX_TYPE,
    }

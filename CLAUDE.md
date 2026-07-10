# EDMS-RAG — Claude Code Reference

## What This Is
**Enterprise Decision Memory System** — a multi-tenant RAG platform that lets organizations upload internal documents (ADRs, meeting notes, tickets, postmortems, RFCs) and query them via hybrid search + LLM generation.

**Stack:** FastAPI (Python 3.12) + React/Vite + SQLite (auth) + Pinecone/FAISS (vectors) + BM25/Elasticsearch (lexical)

---

## Repo Layout
```
edms/          # FastAPI backend (all business logic)
  src/
    api/       # Route handlers (main.py, chat, admin, evidence, state, stats, auth)
    auth/      # JWT auth, models, dependencies
    ingestion/ # Upload pipeline, job queue, image extraction
    retrieval/ # BM25 index, Elasticsearch, text utils
    multimodal/# Image processor
    chunker.py embedder.py parser.py retriever.py generator.py
    vector_store.py pinecone_store.py db.py state_store.py
    runtime_config.py cache_store.py telemetry.py
edms-frontend/ # React + Vite + Tailwind
  src/
    api/       # HTTP client wrappers per domain
    components/ pages/ hooks/ utils/
sample_data/   # ADRs, meeting notes, tickets (markdown)
docker-compose.yml
```

---

## Key Architecture Decisions

### Retrieval Pipeline (`src/retriever.py`)
1. Embed query via OpenAI (`text-embedding-3-small`)
2. Build candidate pool: **semantic** (vector search) + **lexical** (BM25/ES) + **exact doc-id match boost**
3. Fuse with **RRF** (Reciprocal Rank Fusion, k=60)
4. Rerank: **local sentence-transformers cross-encoder** (`cross-encoder/ms-marco-MiniLM-L-6-v2`) → fallback to heuristic (0.3·semantic + 0.22·lexical + 0.18·overlap + 0.18·metadata + 0.12·fusion)
5. Exact doc-id matches prepended regardless of score
6. Results cached: query embeddings (24h disk), retrieval refs (10min memory)

### Generation (`src/generator.py`)
- **Model routing:** complex queries → `gpt-4.1` (LARGE); simple/few-evidence → `gpt-4o-mini` (SMALL)
- Routing triggers: query word count >16, history >6 messages, evidence chars >2400
- Answer cached 3 min in memory; streaming via `StreamingResponse`

### Multi-tenancy (`src/tenancy.py`)
- Each org gets its own vector index namespace + BM25 index
- Org identified by `org_slug` from JWT
- Indexes rebuilt on startup or via admin endpoint

### Backends (env-switched)
| Component | Dev default | Prod required |
|-----------|-------------|---------------|
| Vector store | Pinecone | Pinecone |
| Lexical | `local_bm25` | Elasticsearch |
| Object storage | `local` | S3 |
| Task queue | in-process thread | Celery + Redis |
| Auth DB | SQLite | SQLite (or Postgres via `DATABASE_URL`) |

---

## Running Locally

### Backend
```bash
cd edms
cp .env.example .env   # fill OPENAI_API_KEY, PINECONE_API_KEY
python -m uvicorn src.api.main:app --reload --port 8000
```

### Frontend
```bash
cd edms-frontend
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:8000
npm install && npm run dev
```

### Docker (full stack)
```bash
docker-compose up --build
```

---

## Environment Variables (critical ones)
```
OPENAI_API_KEY          # embeddings + generation
PINECONE_API_KEY        # vector store
RERANKER_MODEL          # optional local reranker (falls back to heuristic)
APP_ENV                 # "production" enables strict checks
ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_ORG_NAME  # seeds first user on startup
VECTOR_BACKEND          # pinecone | faiss
LEXICAL_BACKEND         # local_bm25 | elasticsearch
ELASTICSEARCH_URL       # required in prod
REDIS_URL               # required in prod
CELERY_BROKER_URL / CELERY_RESULT_BACKEND  # required in prod
S3_BUCKET + creds       # required in prod
CORS_ALLOW_ORIGINS      # required in prod (comma-separated)
```

---

## API Surface
| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/search?q=&top_k=` | JWT | Hybrid RAG search |
| POST | `/search/stream` | JWT | Streaming version |
| POST | `/chat` | JWT | Conversational with history |
| GET/POST | `/evidence/*` | JWT | Browse indexed chunks |
| POST | `/admin/upload` | admin JWT | Ingest files |
| GET | `/admin/data` | admin JWT | Manage org data |
| GET | `/stats` | JWT | Index + usage stats |
| POST | `/auth/login` | — | Returns JWT |
| GET | `/ready` `/live` `/metrics` | — | Health + Prometheus |

---

## Ingestion Flow
1. Admin uploads files → `POST /admin/upload`
2. Job created in SQLite job store
3. Worker (thread in dev, Celery in prod) picks up job
4. `parser.py` → `chunker.py` → `embedder.py` → vector store upsert + BM25 index rebuild
5. Images: extracted, base64-encoded, processed via multimodal pipeline
6. Index metadata updated → search endpoints use new index

---

## Caching Layers
- **Disk cache** (file-based): document embeddings (30d TTL), query embeddings (24h)
- **Memory cache** (in-process dict): retrieval result refs (10min), answers (3min)
- **Redis** (prod): replaces in-process caches for multi-replica deployments

---

## Observability
- **Prometheus** metrics at `/metrics` (retrieval totals, LLM requests, queue depth, HTTP latency, auth failures, request rejections)
- **Grafana** dashboards provisioned from `edms/deploy/monitoring/grafana/provisioning/dashboards`
- **Alertmanager** routes Prometheus alerts from `edms/deploy/monitoring/prometheus/rules.yml`
- **OpenTelemetry** traces (OTLP export)
- **Sentry/Glitchtip** error tracking
- Structured JSON logging via `telemetry.py:log_event()`
- `stage_timer` context manager wraps key pipeline stages

---

## Auth
- JWT access tokens (jose) + refresh tokens
- Roles: `admin` (upload/manage) | `user` (search/chat only)
- Password hashing: bcrypt
- Rate limits: search 60/min, chat 90/min, upload 12/min, auth 20/min

---

## Frontend Pages
- `Login` — JWT auth
- `Dashboard` — org stats + index status
- `Chat` — conversational RAG with history
- `EvidenceBrowser` — browse/inspect indexed chunks
- `AdminUpload` — drag-drop file upload
- `AdminDataManager` — delete/manage org files
- `AdminAccess` — user management

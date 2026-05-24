<div align="center">

# EDMS — Enterprise Document Memory System

**Search your company's internal knowledge with AI-grounded answers and linked evidence.**

Upload ADRs, RFCs, meeting notes, postmortems, tickets, and diagrams. Ask questions in plain English. Get answers sourced back to the exact document — no hallucination, no guessing.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-edms--rag.vercel.app-4f46e5?style=for-the-badge&logo=vercel&logoColor=white)](https://edms-rag.vercel.app)
[![Python](https://img.shields.io/badge/Python-3.12-3776ab?style=for-the-badge&logo=python&logoColor=white)](#)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black)](#)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4.1-412991?style=for-the-badge&logo=openai&logoColor=white)](#)
[![Pinecone](https://img.shields.io/badge/Pinecone-Vector%20DB-00b386?style=for-the-badge)](#)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ed?style=for-the-badge&logo=docker&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-MIT-f59e0b?style=for-the-badge)](#license)

<br/>

![EDMS full workflow demo](docs/demo.gif)

</div>

---

## Table of Contents

- [What is EDMS?](#what-is-edms)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Retrieval Pipeline](#retrieval-pipeline)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Monitoring & Observability](#monitoring--observability)
- [License](#license)

---

## What is EDMS?

EDMS is a **multi-tenant RAG (Retrieval-Augmented Generation) platform** built for engineering and ops teams. Each company gets an isolated workspace. Admins upload internal documents, and every user in that workspace can search, chat, and browse evidence — all answers grounded in your actual records.

> Think of it as Notion Search meets a private ChatGPT, but every answer cites its source.

**Key ideas:**
- **Multi-tenant by design** — each org's vectors, files, and indices are fully isolated
- **Hybrid retrieval** — vector search + BM25 fused with RRF, reranked with a 5-signal heuristic scorer
- **Model routing** — simple queries hit `gpt-4o-mini`; complex ones escalate to `gpt-4.1`
- **Role-based access** — admins manage data; users search and chat

---

## Features

### For Users
| Feature | Description |
|---|---|
| 🔍 **Semantic Search** | Ask questions in natural language, get grounded answers with source citations |
| 💬 **Persistent Chat** | Conversational AI with full message history and context-aware follow-ups |
| 📚 **Evidence Browser** | Browse, filter by type, and search all indexed chunks |
| ⌨️ **Keyboard Shortcut** | Press `/` anywhere on the dashboard to focus the search box instantly |

### For Admins
| Feature | Description |
|---|---|
| 📤 **Document Upload** | Upload ADRs, RFCs, meeting notes, postmortems, tickets, and diagrams |
| 🔄 **Auto-Indexing** | Upload triggers extraction → chunking → embedding → index rebuild automatically |
| 🗂️ **Data Manager** | View, manage, and delete indexed files per document type |
| 🔑 **Invite Codes** | Generate and rotate invite codes to control workspace membership |
| 📊 **Index Stats** | Real-time document counts and index status per category |

### Platform
| Feature | Description |
|---|---|
| 🏢 **Multi-tenancy** | Fully isolated workspaces — vectors, files, and indices scoped per org |
| 🔐 **JWT + RBAC** | Access + refresh tokens with admin/user role separation |
| ⚡ **Streaming Answers** | SSE streams the LLM response token by token |
| 🖼️ **Image Support** | Upload diagrams and screenshots — processed through multimodal pipeline |
| 🚦 **Rate Limiting** | Per-endpoint limits (search 60/min, chat 90/min, upload 12/min) |
| 🧠 **Multi-layer Cache** | Disk cache for embeddings (24h), memory cache for answers (3 min) |

---

## System Architecture

```mermaid
flowchart TD
    subgraph Clients["👥 Clients"]
        A["Admin\nUpload · Manage · Invite"]
        U["User\nSearch · Chat · Browse"]
    end

    subgraph FE["⚡ Frontend — React 19 + Vite · Vercel CDN"]
        LP["Landing Page\nMarketing + Auth modals"]
        DASH["Dashboard\nHybrid search + evidence cards"]
        CHAT["Chat\nConversational RAG + history"]
        EB["Evidence Browser\nFilter · Search · Inspect chunks"]
        ADM["Admin Panel\nUpload · Data Manager · Access Control"]
    end

    subgraph BE["🚀 Backend API — FastAPI · Render Web Service"]
        direction LR
        MW["Middleware\nCORS · Rate limiting · JWT verify"]
        AuthR["/auth\nLogin · Register · Refresh · Reset"]
        SearchR["/search  /search/stream\nHybrid RAG + SSE streaming"]
        ChatR["/chat\nConversational RAG with history"]
        EvidR["/evidence\nBrowse indexed chunks"]
        AdminR["/admin\nUpload · Data · Org · Stats"]
        Health["/live  /ready  /metrics\nHealth + Prometheus"]
        MW --> AuthR & SearchR & ChatR & EvidR & AdminR & Health
    end

    subgraph Queue["⚙️ Task Queue — Celery + Redis"]
        JQ["Job Queue\nRedis broker"]
        CW["Celery Worker\nRender Background Service"]
        JQ -->|"pick up"| CW
    end

    subgraph Ingest["📥 Ingestion Pipeline — runs inside Celery Worker"]
        direction LR
        PA["parser.py\nExtract text + metadata\nfrom .md and images"]
        CH["chunker.py\nSplit into retrieval units\nwith section awareness"]
        EM["embedder.py\nOpenAI text-embedding-3-small\n1536-dim, disk-cached 30d"]
        PI["Pinecone upsert\nOrg-namespaced index"]
        BI["BM25 rebuild\nIn-memory lexical index per org"]
        PA --> CH --> EM --> PI & BI
    end

    subgraph RAG["🔍 Retrieval Pipeline — runs per query"]
        direction LR
        QE["① Embed query\nOpenAI · disk-cached 24h"]
        CP["② Candidate pool\nVector top-k + BM25 + exact doc-ID boost"]
        RF["③ RRF Fusion\nReciprocal Rank Fusion k=60\nmerges semantic + lexical ranks"]
        HR["④ Heuristic Reranker\n0.30 semantic · 0.22 lexical\n0.18 token overlap · 0.18 metadata\n0.12 RRF fusion · min-max normalised"]
        MR["⑤ Model routing\nComplex → gpt-4.1\nSimple → gpt-4o-mini"]
        GEN["⑥ Generate answer\nStreaming SSE · cached 3 min"]
        QE --> CP --> RF --> HR --> MR --> GEN
    end

    subgraph Storage["💾 Storage Layer"]
        PG["PostgreSQL · Neon\nUsers · Orgs · Jobs\nTokens · Sessions"]
        PC["Pinecone\nVector embeddings\nper-org namespace"]
        RD["Redis · Upstash\nCache · Job queue\nSession store"]
        S3["Cloudflare R2\nFile storage\nper-org path isolation"]
    end

    subgraph Obs["📊 Observability"]
        PR["Prometheus\n/metrics endpoint\nretrieval · LLM · queue depth"]
        SN["Sentry\nFrontend + backend\nerror tracking"]
        LG["Structured JSON logs\nstdout → Render log drain"]
        OT["OpenTelemetry\nOTLP trace export"]
    end

    A & U --> FE
    FE -->|"JWT in header"| BE
    AdminR -->|"enqueue ingestion job"| JQ
    CW --> Ingest
    Ingest --> PC & RD & S3
    SearchR & ChatR --> RAG
    RAG --> PC & RD
    BE <--> PG & RD & S3
    BE --> Obs
```

---

## Retrieval Pipeline

EDMS uses a **6-stage hybrid retrieval** pipeline — no naive single-vector lookup:

```
Query
  │
  ├─① Embed query
  │     OpenAI text-embedding-3-small · 1536 dims
  │     Result disk-cached 24h (keyed by query + org)
  │
  ├─② Build candidate pool  (3 sources merged)
  │     ├── Semantic   — Pinecone ANN top-k in org namespace
  │     ├── Lexical    — BM25 keyword match (rank-bm25, rebuilt per upload)
  │     └── Exact      — doc-ID match boost (prepended regardless of score)
  │
  ├─③ RRF Fusion  (Reciprocal Rank Fusion, k=60)
  │     Combines semantic + lexical rank lists without score normalisation
  │     Candidate pool = final_top_k × HYBRID_CANDIDATE_MULTIPLIER
  │
  ├─④ Heuristic Reranker  (5-signal weighted scorer)
  │     Each signal min-max normalised before weighting:
  │       0.30 × semantic cosine similarity  (re-computed from embeddings)
  │       0.22 × BM25 lexical score
  │       0.18 × token overlap  (content-filtered query terms vs chunk terms)
  │       0.18 × metadata match  (query terms vs doc_id, type, section header)
  │       0.12 × RRF fusion score
  │     Ties broken by fusion score · deduped · sliced to top_k
  │
  ├─⑤ Model routing  (automatic, no config needed)
  │     → gpt-4o-mini  if: query ≤16 words AND history ≤6 turns
  │                        AND evidence ≤2400 chars AND chunks ≥2
  │     → gpt-4.1      if: any of the above thresholds exceeded
  │
  └─⑥ Generate answer
        Streaming (SSE) and sync modes
        Answer cached 3 min in memory per org
        Grounded fallback answer if LLM call fails
```

---

## Tech Stack

### Backend
| Layer | Technology | Notes |
|---|---|---|
| API framework | **FastAPI** 0.115 + Python 3.12 | Async, typed, OpenAPI auto-docs |
| Auth | **JWT** (python-jose) + bcrypt | Access + refresh tokens, RBAC |
| Vector DB | **Pinecone** | Org-namespaced indices, 1536-dim |
| Lexical search | **BM25** (rank-bm25) | In-memory, rebuilt per upload; Elasticsearch-ready |
| Embeddings | **OpenAI** text-embedding-3-small | Disk-cached 30 days |
| LLM — small | **OpenAI** gpt-4o-mini | Fast, cost-efficient for simple queries |
| LLM — large | **OpenAI** gpt-4.1 | Complex queries, long history, rich evidence |
| Reranker | **Heuristic** (5-signal weighted) | Semantic + lexical + overlap + metadata + RRF |
| Task queue | **Celery** + **Redis** | Thread pool in dev, Celery worker in prod |
| Database | **PostgreSQL** (Neon) | Users, orgs, jobs, tokens |
| File storage | **S3-compatible** (Cloudflare R2) | Per-org path isolation |
| Cache | **Redis** (Upstash) | Multi-layer: disk (embeddings) + memory (answers) + Redis |
| Rate limiting | **slowapi** | Per-endpoint, per-IP |

### Frontend
| Layer | Technology | Notes |
|---|---|---|
| Framework | **React 19** + **Vite 6** | SPA, fast HMR |
| Styling | **Tailwind CSS v4** | Design tokens, CSS variables |
| Routing | **React Router v7** | Client-side SPA routing |
| Streaming | **SSE / fetch stream** | Token-by-token chat rendering |
| State | useState + Context | Toast system, auth payload |
| Error handling | **ErrorBoundary** | Class component, reload recovery |

### Infrastructure
| Service | Provider | Purpose |
|---|---|---|
| Frontend hosting | **Vercel** | CDN + edge, instant deploys |
| API hosting | **Render** | Docker web service |
| Background worker | **Render** | Celery ingestion worker |
| Database | **Neon** | Serverless Postgres |
| Cache + queue | **Upstash** | Serverless Redis |
| Vector store | **Pinecone** | Managed vector DB |
| Object storage | **Cloudflare R2** | S3-compatible file store |
| Error tracking | **Sentry** | Frontend + backend |
| CI/CD | **GitHub Actions** | Lint, build, Docker |

---

## Project Structure

```
edms-rag/
├── docs/
│   └── demo.gif                     # Product demo GIF
├── edms/                            # FastAPI backend
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── src/
│       ├── api/
│       │   ├── main.py              # App entry, middleware, startup
│       │   ├── auth_routes.py       # /auth/* endpoints
│       │   ├── chat_routes.py       # /chat endpoint (SSE streaming)
│       │   ├── evidence_routes.py   # /evidence browsing
│       │   ├── index_manager.py     # Admin upload + reindex
│       │   ├── state_routes.py      # /admin/data CRUD
│       │   └── stats_routes.py      # /stats
│       ├── auth/
│       │   ├── models.py            # User, Org Pydantic models
│       │   ├── jwt_handler.py       # Token issue + verify
│       │   └── dependencies.py      # get_current_user, require_admin
│       ├── ingestion/
│       │   ├── job_store.py         # Job queue (Postgres-backed)
│       │   ├── worker.py            # Celery tasks
│       │   └── image_processor.py   # Multimodal image handling
│       ├── retrieval/
│       │   ├── bm25_index.py        # BM25 index per org
│       │   └── text_utils.py        # Tokenisation + stopword filter
│       ├── chunker.py               # Section-aware text splitting
│       ├── embedder.py              # OpenAI embedding + disk cache
│       ├── generator.py             # Model routing + LLM call + streaming
│       ├── parser.py                # Document text + metadata extraction
│       ├── retriever.py             # Full 6-stage pipeline
│       ├── vector_store.py          # FAISS local backend
│       ├── pinecone_store.py        # Pinecone backend
│       ├── db.py                    # Postgres connection + helpers
│       ├── state_store.py           # Token tables, org state
│       ├── tenancy.py               # Org isolation helpers
│       ├── cache_store.py           # Memory + disk cache
│       ├── runtime_config.py        # Env-based feature flags + routing thresholds
│       └── telemetry.py             # Structured logging + OpenTelemetry
├── edms-frontend/                   # React + Vite frontend
│   ├── index.html                   # SEO meta, OG tags, JSON-LD schema
│   ├── vite.config.js               # Vendor chunk splitting
│   ├── public/
│   │   └── robots.txt
│   └── src/
│       ├── api/                     # HTTP client wrappers per domain
│       │   ├── config.js            # Base fetch + session expiry handling
│       │   ├── auth.js
│       │   ├── admin.js
│       │   ├── search.js
│       │   ├── chat.js
│       │   └── stats.js
│       ├── components/
│       │   ├── WorkspaceShell.jsx   # Layout wrapper (sidebar + main)
│       │   ├── Sidebar.jsx          # Role-aware navigation
│       │   ├── DashboardHeader.jsx
│       │   ├── EvidenceItem.jsx     # Chunk card with keyword highlight
│       │   ├── FormattedContent.jsx # Markdown renderer
│       │   ├── Toast.jsx            # Toast context + useToast hook
│       │   ├── ErrorBoundary.jsx    # React error boundary
│       │   └── AppIcons.jsx         # SVG icon library
│       ├── hooks/
│       │   ├── usePageTitle.js      # Per-page document.title
│       │   └── useRecentSearches.js
│       ├── pages/
│       │   ├── Login.jsx            # Landing page + auth modals
│       │   ├── Dashboard.jsx        # Search + results + recent queries
│       │   ├── Chat.jsx             # Conversational RAG
│       │   ├── EvidenceBrowser.jsx  # Browse + filter indexed chunks
│       │   ├── AdminUpload.jsx      # File upload with job polling
│       │   ├── AdminDataManager.jsx # Delete / manage org files
│       │   ├── AdminAccess.jsx      # Invite code management
│       │   └── NotFound.jsx         # 404 fallback
│       └── utils/
│           └── auth.js              # JWT payload decode
├── sample_data/                     # Example documents for testing
│   ├── adrs/
│   ├── rfcs/
│   ├── meeting_notes/
│   ├── postmortems/
│   ├── tickets/
│   └── images/
├── docker-compose.yml
├── CLAUDE.md
└── .github/
    └── workflows/
        └── ci.yml
```

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- OpenAI API key (required — embeddings + generation)
- Pinecone API key (required — vector store)

### 1. Clone

```bash
git clone https://github.com/adityasnehai/edms-rag.git
cd edms-rag
```

### 2. Backend

```bash
cd edms
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in: OPENAI_API_KEY, PINECONE_API_KEY, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_ORG_NAME
uvicorn src.api.main:app --host 127.0.0.1 --port 8001 --reload
```

### 3. Frontend

```bash
cd edms-frontend
npm install
cp .env.example .env
# Set: VITE_API_BASE_URL=http://127.0.0.1:8001
npm run dev
```

### 4. Open

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8001 |
| API docs (Swagger) | http://localhost:8001/docs |

### 5. First run

The backend seeds the first admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_ORG_NAME` env vars on startup. Sign in as admin → upload sample files from `sample_data/` → start searching.

### Docker (full stack)

```bash
cp edms/.env.example edms/.env   # fill required vars
docker compose up --build
```

---

## Deployment

### Cloud Services Map

| Component | Recommended | Alternative |
|---|---|---|
| Frontend | **Vercel** | Cloudflare Pages |
| Backend API | **Render** (Docker) | Railway, Fly.io |
| Celery worker | **Render** (Background Worker) | Railway worker |
| PostgreSQL | **Neon** | Supabase, Railway |
| Redis | **Upstash** | Railway Redis |
| Vector store | **Pinecone** | Qdrant Cloud |
| File storage | **Cloudflare R2** | AWS S3 |
| Error tracking | **Sentry** | GlitchTip |

### Step-by-Step

```
1.  Push code to GitHub (main branch)
2.  Create Neon Postgres → copy DATABASE_URL
3.  Create Upstash Redis → copy REDIS_URL
4.  Create Pinecone index (dimension: 1536, metric: cosine) → copy PINECONE_API_KEY
5.  Create Cloudflare R2 bucket → copy R2_* credentials
6.  Deploy backend on Render (Docker, root: edms/) → set all env vars
7.  Deploy Celery worker on Render (same Docker image, start command below)
8.  Set CORS_ALLOW_ORIGINS to your Vercel domain on the backend
9.  Deploy frontend on Vercel → set VITE_API_BASE_URL to Render backend URL
10. Attach Sentry DSN to frontend and backend
11. Smoke test: sign up → upload a file → search → confirm answer is grounded
```

**Celery worker start command:**
```bash
celery -A src.worker worker --loglevel=info --concurrency=2
```

---

## Environment Variables

### Backend (`edms/.env`)

| Variable | Required | Description |
|---|---|---|
| `APP_ENV` | Yes | `development` or `production` |
| `JWT_SECRET` | Yes | Long random string for signing tokens |
| `OPENAI_API_KEY` | Yes | Embeddings (text-embedding-3-small) + generation (gpt-4o-mini / gpt-4.1) |
| `PINECONE_API_KEY` | Yes | Vector store |
| `DATABASE_URL` | Prod | Neon Postgres connection string |
| `REDIS_URL` | Prod | Upstash Redis URL |
| `CELERY_BROKER_URL` | Prod | Redis URL for Celery broker |
| `CELERY_RESULT_BACKEND` | Prod | Redis URL for Celery results |
| `VECTOR_BACKEND` | No | `pinecone` (default) or `faiss` (local dev) |
| `LEXICAL_BACKEND` | No | `local_bm25` (default dev) or `elasticsearch` |
| `ELASTICSEARCH_URL` | No | Required only if `LEXICAL_BACKEND=elasticsearch` |
| `OBJECT_STORAGE_BACKEND` | No | `s3` or `local` (default dev) |
| `S3_BUCKET` | Prod | R2 / S3 bucket name |
| `R2_ENDPOINT_URL` | Prod | Cloudflare R2 endpoint |
| `R2_ACCESS_KEY_ID` | Prod | R2 access key |
| `R2_SECRET_ACCESS_KEY` | Prod | R2 secret key |
| `CORS_ALLOW_ORIGINS` | Prod | Comma-separated allowed origins |
| `ADMIN_EMAIL` | Yes | Seeds first admin user on startup |
| `ADMIN_PASSWORD` | Yes | Seeds first admin password |
| `ADMIN_ORG_NAME` | Yes | Seeds first org name |
| `GLITCHTIP_DSN` | No | Sentry-compatible error tracking DSN |

See [`edms/.env.example`](edms/.env.example) for the full template.

### Frontend (`edms-frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Backend URL (e.g. `https://your-api.onrender.com`) |
| `VITE_SENTRY_DSN` | No | Frontend error tracking |

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | — | Login, returns JWT pair |
| `POST` | `/auth/register` | — | Create org + admin account |
| `POST` | `/auth/register-user` | — | Join existing org via invite code |
| `POST` | `/auth/refresh` | Refresh token | Issue new access token |
| `POST` | `/auth/logout` | JWT | Revoke refresh token |
| `GET` | `/search?q=&top_k=` | JWT | Hybrid RAG search (sync) |
| `POST` | `/search/stream` | JWT | Streaming search via SSE |
| `POST` | `/chat` | JWT | Conversational RAG with history |
| `GET` | `/evidence` | JWT | Browse + filter indexed chunks |
| `GET` | `/stats` | JWT | Index stats + document counts |
| `POST` | `/admin/upload` | Admin JWT | Upload + trigger ingestion |
| `GET` | `/admin/data` | Admin JWT | List org files by type |
| `DELETE` | `/admin/data` | Admin JWT | Delete org files |
| `GET` | `/admin/org` | Admin JWT | Org details + invite code |
| `POST` | `/admin/org/rotate-invite` | Admin JWT | Rotate invite code |
| `GET` | `/ready` | — | Readiness probe |
| `GET` | `/live` | — | Liveness probe |
| `GET` | `/metrics` | Internal | Prometheus metrics |

Full interactive docs at `/docs` when running locally.

---

## Monitoring & Observability

| Signal | Tool | Details |
|---|---|---|
| Metrics | **Prometheus** | `GET /metrics` — retrieval totals, LLM calls, queue depth, HTTP latency |
| Traces | **OpenTelemetry** | OTLP export, `stage_timer` wraps each pipeline stage |
| Errors | **Sentry** | Frontend JS errors + backend exceptions with stack traces |
| Logs | **Structured JSON** | stdout → Render log drain, keyed by `org_slug` and event type |
| Health | **Probes** | `/live` (process alive) + `/ready` (dependencies connected) |

Key Prometheus metrics:
- `edms_retrieval_total` — by org, backend, cache hit
- `edms_llm_requests_total` — by model, mode, fallback used
- `edms_job_queue_depth` — pending ingestion jobs
- `http_requests_total` — by route and status code

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built with FastAPI · React · Pinecone · OpenAI · BM25 · RRF

[Live Demo](https://edms-rag.vercel.app) · [Report a Bug](https://github.com/adityasnehai/edms-rag/issues) · [Request a Feature](https://github.com/adityasnehai/edms-rag/issues)

</div>

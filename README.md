# EDMS

[![Backend](https://img.shields.io/badge/backend-FastAPI-059669?style=for-the-badge)](#stack)
[![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-2563eb?style=for-the-badge)](#stack)
[![Search](https://img.shields.io/badge/retrieval-Hybrid%20RAG-7c3aed?style=for-the-badge)](#search-architecture)
[![Auth](https://img.shields.io/badge/auth-JWT%20%2B%20RBAC-f97316?style=for-the-badge)](#security-and-multi-tenancy)
[![Vector](https://img.shields.io/badge/vector-Pinecone-0f172a?style=for-the-badge)](#production-stack)
[![CI](https://img.shields.io/badge/ci-GitHub%20Actions-111827?style=for-the-badge)](#development)

EDMS is a multi-tenant enterprise knowledge workspace for searching internal records with evidence. Admins create a company workspace, upload records, invite users, and keep search, chat, evidence, and access isolated per organization.

This repo is intentionally portfolio-friendly for a 1 YOE engineer:
- clear full-stack structure
- production-shaped backend architecture
- practical security and tenancy controls
- realistic retrieval pipeline instead of toy search

## What It Does
- Company-scoped signup and invite-based user onboarding
- Role-based access for admin and user flows
- Admin uploads for docs and images
- Automatic extraction, chunking, indexing, and refresh
- Hybrid retrieval with vector + lexical search + reranking
- Search answers with linked evidence
- Persistent chat threads and recent searches
- Monitoring and CI wiring

## Stack
- Frontend: React, Vite, Tailwind CSS, React Router
- Backend: FastAPI, Pydantic, JWT auth
- Search: Pinecone, Elasticsearch/OpenSearch, BM25 fallback
- Data: Postgres, Redis, Celery, S3/MinIO
- Monitoring: Prometheus, Grafana, Loki, Promtail, Flower, GlitchTip-compatible DSN
- Deployment: Docker Compose, NGINX, GitHub Actions

## Search Architecture
EDMS uses a practical RAG pipeline:

1. Upload records into an organization workspace
2. Extract text and metadata
3. Chunk records into retrieval units
4. Generate embeddings
5. Index vectors and lexical documents
6. Retrieve hybrid candidates
7. Rerank the best matches
8. Generate a grounded answer with evidence

Current production-oriented behaviors:
- org-scoped caching
- rerank top candidates only
- timeout, retry, and fallback handling
- grounded fallback answers when LLM generation fails
- BM25 fallback when vector retrieval is unavailable

## Security And Multi-Tenancy
- JWT access tokens plus refresh-token sessions
- Admin and user role separation
- Invite-code-based workspace joining
- Organization-scoped file, state, and retrieval access
- Rate limiting and request-capacity guards
- Token refresh, logout, and logout-all session APIs
- Password reset and email verification endpoints
- Production guards for Redis, Celery, Pinecone, Elasticsearch, and object storage

## Project Structure
```text
edms-rag/
├── .github/workflows/ci.yml
├── docker-compose.yml
├── README.md
├── edms/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── src/
│       ├── api/
│       ├── auth/
│       ├── ingestion/
│       ├── multimodal/
│       ├── retrieval/
│       ├── runtime_config.py
│       ├── telemetry.py
│       └── ...
└── edms-frontend/
    ├── package.json
    └── src/
        ├── api/
        ├── components/
        ├── hooks/
        ├── pages/
        └── utils/
```

## Local Development
### 1. Backend
```bash
cd edms
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn src.api.main:app --host 127.0.0.1 --port 8001
```

### 2. Frontend
```bash
cd edms-frontend
npm install
VITE_API_BASE=http://127.0.0.1:8001 npm run dev -- --host 127.0.0.1 --port 5173
```

### 3. Open
- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8001`

## Production Stack
Use this stack for a real deployment:
- Frontend: Vercel
- Backend API: Render Web Service (Docker)
- Worker: Render Background Worker (Celery)
- Database: Neon Postgres
- Cache and queue: Upstash Redis
- Vector store: Pinecone
- Object storage: Cloudflare R2
- Error monitoring: Sentry
- Runtime logs: Render Logs (structured JSON)

The repo already includes:
- Docker Compose for local production-style services
- NGINX config
- Monitoring configs
- CI pipeline

## Environment Variables
Important backend variables:
- `APP_ENV`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `COHERE_API_KEY`
- `PINECONE_API_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `ELASTICSEARCH_URL`
- `OBJECT_STORAGE_BACKEND`
- `S3_BUCKET`
- `GLITCHTIP_DSN`

See [edms/.env.example](edms/.env.example) for the full template.

## Monitoring
Available endpoints and services:
- API metrics: `/metrics`
- Liveness: `/live`
- Readiness: `/ready`
- Grafana
- Prometheus
- Loki
- Flower
- Uptime Kuma

## Development
Useful checks:
```bash
cd edms-frontend && npm run lint
cd edms-frontend && npm run build
cd edms && ./.venv/bin/python -m py_compile $(find src -name '*.py' -print)
```

GitHub Actions runs:
- frontend lint
- frontend build
- backend syntax validation
- backend import validation
- backend Docker build

## Deployment Order
Use this sequence:

1. Push to GitHub (`main` protected, PR required)
2. Create Neon Postgres
3. Create Upstash Redis
4. Create Pinecone index
5. Create Cloudflare R2 bucket
6. Deploy backend API on Render
7. Deploy Celery worker on Render
8. Deploy frontend on Vercel
9. Attach Sentry (frontend + backend)
10. Run end-to-end smoke test

Recommended GitHub/Cloud secrets:
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `COHERE_API_KEY`
- `PINECONE_API_KEY`
- `SENTRY_DSN`
- `DATABASE_URL`
- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `R2_BUCKET`
- `R2_REGION`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT_URL`

## Notes
- The codebase is production-shaped, but real production confidence still depends on live infra validation.
- For a public GitHub repo, do not commit real secrets or runtime data.
- Start with one clean deploy path instead of overcomplicating infra on day one.

## License
Add your preferred license before publishing publicly.

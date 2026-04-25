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
- Evaluation, monitoring, and CI wiring

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
p1/
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
│       ├── eval/
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
- Backend API: EC2, Render, Railway, or Fly.io
- Worker: Celery worker on the same cloud stack
- Database: Postgres
- Cache and queue: Redis
- Vector store: Pinecone
- Lexical retrieval: Elasticsearch/OpenSearch
- Object storage: S3 or MinIO
- Reverse proxy: NGINX

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

## GitHub First
If you are moving this repo to GitHub first, do it in this order:

1. Initialize the repository locally and push to a new GitHub repo
2. Add GitHub Actions secrets before enabling production deploy jobs
3. Keep `main` as the protected deployment branch
4. Run CI on every push and PR before any cloud deployment

Recommended GitHub secrets for later production deployment:
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `COHERE_API_KEY`
- `PINECONE_API_KEY`
- `GLITCHTIP_DSN`
- `DATABASE_URL`
- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `ELASTICSEARCH_URL`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`

## Production Move
For a simple 1 YOE-friendly production path:

- Frontend: `Vercel`
- Backend + worker: `AWS EC2`
- Database: `Postgres`
- Cache and queue: `Redis`
- Files: `S3`
- Vector search: `Pinecone`
- Lexical search: `Elasticsearch`
- Error tracking: `GlitchTip`
- Metrics: `Prometheus + Grafana`
- Worker visibility: `Flower`
- Uptime: `Uptime Kuma`

Best rollout order:
1. GitHub
2. CI
3. AWS infra
4. backend + worker deploy
5. frontend deploy
6. monitoring
7. smoke test

## Notes
- The codebase is production-shaped, but real production confidence still depends on live infra validation.
- For a public GitHub repo, do not commit real secrets or runtime data.
- Start with one clean deploy path instead of overcomplicating infra on day one.

## License
Add your preferred license before publishing publicly.

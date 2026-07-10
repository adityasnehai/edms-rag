# EDMS Deploy Checklist (Vercel + Render)

## 1) Repo
- [ ] Push latest code to `main`
- [ ] Enable branch protection on `main`
- [ ] Keep GitHub Actions CI green

## 2) Managed Services
- [ ] Neon Postgres created
- [ ] Upstash Redis created
- [ ] Pinecone index created
- [ ] Cloudflare R2 bucket created
- [ ] Sentry project created
- [ ] Prometheus + Grafana + Loki + Alertmanager ready

## 3) Backend (Render Web Service)
- [ ] Root directory: `edms`
- [ ] Build: `pip install -r requirements.txt`
- [ ] Start: `uvicorn src.api.main:app --host 0.0.0.0 --port $PORT`
- [ ] Health check path: `/ready`
- [ ] Env vars set (all required)

## 4) Worker (Render Background Worker)
- [ ] Root directory: `edms`
- [ ] Start: `celery -A src.celery_app.celery worker --loglevel=info`
- [ ] Same env vars as backend

## 5) Frontend (Vercel)
- [ ] Root directory: `edms-frontend`
- [ ] Framework: `Vite`
- [ ] `VITE_API_BASE_URL` points to Render backend URL

## 6) Minimum Required Env Vars
- [ ] `APP_ENV=production`
- [ ] `ALLOW_DOTENV=0`
- [ ] `JWT_SECRET`
- [ ] `OPENAI_API_KEY`
- [ ] `RERANKER_MODEL`
- [ ] `RERANKER_WARMUP_ON_STARTUP=1`
- [ ] `RERANKER_SLOW_THRESHOLD_SECONDS`
- [ ] `RERANKER_DEGRADE_TTL_SECONDS`
- [ ] `INGESTION_BATCH_JOB_LIMIT`
- [ ] `WORKSPACE_INSIGHTS_CACHE_TTL_SECONDS`
- [ ] `MAX_REQUEST_BODY_SIZE_BYTES`
- [ ] `LOGIN_FAILURE_LOCKOUT_THRESHOLD`
- [ ] `LOGIN_FAILURE_LOCKOUT_SECONDS`
- [ ] `PINECONE_API_KEY`
- [ ] `DATABASE_URL`
- [ ] `REDIS_URL`
- [ ] `CELERY_BROKER_URL`
- [ ] `CELERY_RESULT_BACKEND`
- [ ] `VECTOR_BACKEND=pinecone`
- [ ] `OBJECT_STORAGE_BACKEND=s3`
- [ ] `S3_BUCKET` (R2 bucket name)
- [ ] `S3_ENDPOINT_URL` (R2 endpoint)
- [ ] `S3_REGION=auto`
- [ ] `S3_ACCESS_KEY_ID`
- [ ] `S3_SECRET_ACCESS_KEY`
- [ ] `CORS_ALLOW_ORIGINS` (frontend URL)
- [ ] `SENTRY_DSN` (optional but recommended)
- [ ] `METRICS_API_KEY` (recommended for protected metrics access)

## 7) Smoke Test
- [ ] Admin signup works
- [ ] Invite-code user signup works
- [ ] Upload markdown + image works
- [ ] Ingestion job completes
- [ ] Search answer returns evidence
- [ ] Chat returns grounded answer
- [ ] Data manager replace/delete works
- [ ] `/metrics` exposes Prometheus counters and histograms
- [ ] Alertmanager loads rules without errors

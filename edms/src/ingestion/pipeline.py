from datetime import datetime
from queue import Empty, Queue
from threading import Lock, Thread

from src.api.index_manager import mark_ingestion_job_state, rebuild_vector_store
from src.celery_app import celery_app
from src.ingestion.image_extraction import process_org_images
from src.ingestion.job_store import (
    claim_ingestion_job,
    claim_queued_ingestion_jobs,
    create_ingestion_job,
    init_ingestion_tables,
    requeue_unfinished_jobs,
    update_ingestion_job,
)
from src.runtime_config import INGESTION_BATCH_JOB_LIMIT, PRODUCTION_MODE
from src.telemetry import INGESTION_JOBS_TOTAL, QUEUE_DEPTH, log_event, stage_timer

_job_queue: Queue[str] = Queue()
_worker_lock = Lock()
_worker_thread: Thread | None = None


def _dispatch_job(job_id: str) -> None:
    if celery_app is not None:
        run_ingestion_job.delay(job_id)
        if QUEUE_DEPTH:
            QUEUE_DEPTH.labels(queue_name="ingestion").inc()
        return

    _job_queue.put(job_id)
    if QUEUE_DEPTH:
        QUEUE_DEPTH.labels(queue_name="ingestion").set(_job_queue.qsize())


def start_ingestion_worker() -> None:
    global _worker_thread

    init_ingestion_tables()

    with _worker_lock:
        if celery_app is not None:
            for job in requeue_unfinished_jobs():
                _dispatch_job(job["id"])
            return

        if _worker_thread and _worker_thread.is_alive():
            return

        for job in requeue_unfinished_jobs():
            _dispatch_job(job["id"])

        _worker_thread = Thread(
            target=_worker_loop,
            name="edms-ingestion-worker",
            daemon=True,
        )
        _worker_thread.start()


def enqueue_ingestion_job(
    *,
    org_id: int,
    org_slug: str,
    trigger_source: str,
    data_type: str | None,
    uploaded_files: list[str],
):
    job = create_ingestion_job(
        org_id=org_id,
        org_slug=org_slug,
        trigger_source=trigger_source,
        data_type=data_type,
        uploaded_files=uploaded_files,
    )
    mark_ingestion_job_state(
        org_slug,
        job["id"],
        pipeline_status="queued",
    )
    _dispatch_job(job["id"])
    return job


def _worker_loop():
    while True:
        try:
            job_id = _job_queue.get(timeout=0.5)
        except Empty:
            continue

        try:
            _process_job(job_id)
        finally:
            _job_queue.task_done()
            if QUEUE_DEPTH:
                QUEUE_DEPTH.labels(queue_name="ingestion").set(_job_queue.qsize())


def _process_job(job_id: str) -> None:
    job = claim_ingestion_job(job_id)
    if not job:
        return

    batch_jobs = [job]
    batch_jobs.extend(
        claim_queued_ingestion_jobs(
            job["org_id"],
            limit=INGESTION_BATCH_JOB_LIMIT - 1,
            exclude_job_id=job_id,
        )
    )

    batch_job_ids = [item["id"] for item in batch_jobs]
    batch_trigger_sources = sorted({item.get("trigger_source") or "unknown" for item in batch_jobs})
    batch_data_types = sorted({item.get("data_type") or "unknown" for item in batch_jobs})
    batch_uploaded_files = sum((len(item.get("uploaded_files") or []) for item in batch_jobs), 0)

    mark_ingestion_job_state(
        job["org_slug"],
        job_id,
        pipeline_status="running",
    )
    for extra_job in batch_jobs[1:]:
        mark_ingestion_job_state(
            extra_job["org_slug"],
            extra_job["id"],
            pipeline_status="running",
        )

    try:
        with stage_timer("ingestion_image_extraction", org_slug=job["org_slug"], job_id=job_id):
            image_stats = process_org_images(job["org_slug"])
        if image_stats.get("failed", 0) > 0 and any(item.get("data_type") == "images" for item in batch_jobs):
            first_error = (image_stats.get("errors") or [{}])[0].get("error")
            raise RuntimeError(first_error or "Image extraction failed")
        with stage_timer("ingestion_rebuild", org_slug=job["org_slug"], job_id=job_id):
            meta = rebuild_vector_store(
                org_slug=job["org_slug"],
                org_id=job["org_id"],
                job_id=job_id,
                trigger_source=job.get("trigger_source"),
            )
        meta["image_extraction"] = image_stats
        meta["batch"] = {
            "job_count": len(batch_jobs),
            "job_ids": batch_job_ids,
            "trigger_sources": batch_trigger_sources,
            "data_types": batch_data_types,
            "uploaded_files": batch_uploaded_files,
        }
        completed_at = datetime.utcnow().isoformat()
        if meta.get("status") == "error":
            for item in batch_jobs:
                update_ingestion_job(
                    item["id"],
                    status="failed",
                    completed_at=completed_at,
                    error_text=meta.get("last_error") or "Index rebuild failed",
                    result=meta,
                )
                mark_ingestion_job_state(
                    item["org_slug"],
                    item["id"],
                    pipeline_status="failed",
                )
            if INGESTION_JOBS_TOTAL:
                for item in batch_jobs:
                    INGESTION_JOBS_TOTAL.labels(
                        status="failed",
                        trigger_source=item.get("trigger_source") or "unknown",
                        data_type=item.get("data_type") or "unknown",
                    ).inc()
            return

        for item in batch_jobs:
            update_ingestion_job(
                item["id"],
                status="completed",
                completed_at=completed_at,
                error_text="",
                result=meta,
            )
            mark_ingestion_job_state(
                item["org_slug"],
                item["id"],
                pipeline_status="completed",
            )
        if INGESTION_JOBS_TOTAL:
            for item in batch_jobs:
                INGESTION_JOBS_TOTAL.labels(
                    status="completed",
                    trigger_source=item.get("trigger_source") or "unknown",
                    data_type=item.get("data_type") or "unknown",
                ).inc()
        log_event(
            20,
            "ingestion_completed",
            org_slug=job["org_slug"],
            job_id=job_id,
            batch_job_count=len(batch_jobs),
        )
    except Exception as exc:
        completed_at = datetime.utcnow().isoformat()
        for item in batch_jobs:
            update_ingestion_job(
                item["id"],
                status="failed",
                completed_at=completed_at,
                error_text=str(exc),
            )
            mark_ingestion_job_state(
                item["org_slug"],
                item["id"],
                pipeline_status="failed",
            )
        if INGESTION_JOBS_TOTAL:
            for item in batch_jobs:
                INGESTION_JOBS_TOTAL.labels(
                    status="failed",
                    trigger_source=item.get("trigger_source") or "unknown",
                    data_type=item.get("data_type") or "unknown",
                ).inc()
        log_event(40, "ingestion_failed", org_slug=job["org_slug"], job_id=job_id, error_type=exc.__class__.__name__, batch_job_count=len(batch_jobs))


if celery_app is not None:
    @celery_app.task(name="edms.run_ingestion_job")
    def run_ingestion_job(job_id: str) -> None:
        _process_job(job_id)

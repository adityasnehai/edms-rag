from src.runtime_config import (
    CELERY_BROKER_URL,
    CELERY_RESULT_BACKEND,
    CELERY_TASK_ALWAYS_EAGER,
)

celery_app = None

if CELERY_BROKER_URL:
    try:
        from celery import Celery

        celery_app = Celery(
            "edms",
            broker=CELERY_BROKER_URL,
            backend=CELERY_RESULT_BACKEND or None,
            include=["src.ingestion.pipeline"],
        )
        celery_app.conf.task_always_eager = CELERY_TASK_ALWAYS_EAGER
        celery_app.conf.task_ignore_result = not bool(CELERY_RESULT_BACKEND)
    except Exception:
        celery_app = None

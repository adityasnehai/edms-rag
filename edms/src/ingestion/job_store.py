import json
from typing import Dict, List, Optional
from uuid import uuid4

from src.db import connect, execute, fetchall, fetchone, utcnow_iso

VALID_JOB_STATUSES = {"queued", "running", "completed", "failed"}


def _row_to_job(row) -> Optional[Dict]:
    if row is None:
        return None
    return {
        "id": row["id"],
        "org_id": row["org_id"],
        "org_slug": row["org_slug"],
        "trigger_source": row["trigger_source"],
        "data_type": row["data_type"],
        "status": row["status"],
        "uploaded_files": json.loads(row["uploaded_files"]) if row.get("uploaded_files") else [],
        "error_text": row.get("error_text"),
        "created_at": row["created_at"],
        "started_at": row.get("started_at"),
        "completed_at": row.get("completed_at"),
        "result": json.loads(row["result_payload"]) if row.get("result_payload") else None,
    }


def init_ingestion_tables() -> None:
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(
            cursor,
            """
            CREATE TABLE IF NOT EXISTS ingestion_jobs (
                id TEXT PRIMARY KEY,
                org_id INTEGER NOT NULL,
                org_slug TEXT NOT NULL,
                trigger_source TEXT NOT NULL,
                data_type TEXT,
                status TEXT NOT NULL,
                uploaded_files TEXT,
                error_text TEXT,
                result_payload TEXT,
                created_at TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT
            )
            """,
        )
        execute(cursor, "CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_org ON ingestion_jobs(org_id, created_at DESC)")
        execute(cursor, "CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_status ON ingestion_jobs(status, created_at ASC)")
        conn.commit()
    finally:
        conn.close()


def create_ingestion_job(org_id: int, org_slug: str, trigger_source: str, data_type: Optional[str], uploaded_files: List[str]) -> Dict:
    conn = connect()
    try:
        cursor = conn.cursor()
        job = {
            "id": uuid4().hex,
            "org_id": org_id,
            "org_slug": org_slug,
            "trigger_source": trigger_source,
            "data_type": data_type,
            "status": "queued",
            "uploaded_files": uploaded_files,
            "created_at": utcnow_iso(),
            "started_at": None,
            "completed_at": None,
            "error_text": None,
            "result": None,
        }
        execute(
            cursor,
            """
            INSERT INTO ingestion_jobs (
                id, org_id, org_slug, trigger_source, data_type,
                status, uploaded_files, error_text, result_payload,
                created_at, started_at, completed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job["id"],
                job["org_id"],
                job["org_slug"],
                job["trigger_source"],
                job["data_type"],
                job["status"],
                json.dumps(job["uploaded_files"], ensure_ascii=True),
                None,
                None,
                job["created_at"],
                None,
                None,
            ),
        )
        conn.commit()
        return job
    finally:
        conn.close()


def update_ingestion_job(job_id: str, *, status: Optional[str] = None, started_at: Optional[str] = None, completed_at: Optional[str] = None, error_text: Optional[str] = None, result: Optional[Dict] = None) -> Optional[Dict]:
    conn = connect()
    try:
        cursor = conn.cursor()
        assignments = []
        values = []
        if status is not None:
            if status not in VALID_JOB_STATUSES:
                raise ValueError(f"Invalid job status: {status}")
            assignments.append("status = ?")
            values.append(status)
        if started_at is not None:
            assignments.append("started_at = ?")
            values.append(started_at)
        if completed_at is not None:
            assignments.append("completed_at = ?")
            values.append(completed_at)
        if error_text is not None:
            assignments.append("error_text = ?")
            values.append(error_text)
        if result is not None:
            assignments.append("result_payload = ?")
            values.append(json.dumps(result, ensure_ascii=True))
        if assignments:
            values.append(job_id)
            execute(cursor, f"UPDATE ingestion_jobs SET {', '.join(assignments)} WHERE id = ?", tuple(values))
            conn.commit()
        return get_ingestion_job(job_id)
    finally:
        conn.close()


def claim_ingestion_job(job_id: str) -> Optional[Dict]:
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(
            cursor,
            """
            UPDATE ingestion_jobs
            SET status = 'running',
                started_at = ?,
                error_text = NULL
            WHERE id = ?
              AND status = 'queued'
            """,
            (utcnow_iso(), job_id),
        )
        if cursor.rowcount == 0:
            conn.commit()
            return None
        conn.commit()
        execute(cursor, "SELECT * FROM ingestion_jobs WHERE id = ?", (job_id,))
        return _row_to_job(fetchone(cursor))
    finally:
        conn.close()


def get_ingestion_job(job_id: str, org_id: Optional[int] = None) -> Optional[Dict]:
    conn = connect()
    try:
        cursor = conn.cursor()
        if org_id is None:
            execute(cursor, "SELECT * FROM ingestion_jobs WHERE id = ?", (job_id,))
        else:
            execute(cursor, "SELECT * FROM ingestion_jobs WHERE id = ? AND org_id = ?", (job_id, org_id))
        return _row_to_job(fetchone(cursor))
    finally:
        conn.close()


def list_ingestion_jobs(org_id: int, limit: int = 10) -> List[Dict]:
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(
            cursor,
            """
            SELECT *
            FROM ingestion_jobs
            WHERE org_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT ?
            """,
            (org_id, limit),
        )
        return [_row_to_job(row) for row in fetchall(cursor)]
    finally:
        conn.close()


def requeue_unfinished_jobs() -> List[Dict]:
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(
            cursor,
            """
            UPDATE ingestion_jobs
            SET status = 'queued',
                error_text = NULL,
                started_at = NULL,
                completed_at = NULL
            WHERE status IN ('queued', 'running')
            """,
        )
        conn.commit()
        execute(cursor, "SELECT * FROM ingestion_jobs WHERE status = 'queued' ORDER BY created_at ASC, id ASC")
        return [_row_to_job(row) for row in fetchall(cursor)]
    finally:
        conn.close()

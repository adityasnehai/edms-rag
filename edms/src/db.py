import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterable
from urllib.parse import urlparse


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///data/edms_auth.db").strip()


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def is_postgres_url(url: str | None = None) -> bool:
    return (url or DATABASE_URL).startswith(("postgres://", "postgresql://"))


def is_sqlite_url(url: str | None = None) -> bool:
    return (url or DATABASE_URL).startswith("sqlite://")


def _sqlite_path(url: str) -> str:
    if url == "sqlite://":
        return "data/edms_auth.db"
    return url.replace("sqlite:///", "", 1).replace("sqlite://", "", 1)


def _convert_params(query: str, params: Iterable[Any] | None) -> tuple[str, tuple[Any, ...]]:
    bound = tuple(params or ())
    if not is_postgres_url():
        return query, bound
    return query.replace("?", "%s"), bound


def connect():
    if is_postgres_url():
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as exc:
            raise RuntimeError("psycopg is required for PostgreSQL") from exc

        conn = psycopg.connect(DATABASE_URL, row_factory=dict_row)
        conn.autocommit = False
        return conn

    path = _sqlite_path(DATABASE_URL)
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def dict_from_row(row) -> dict | None:
    if row is None:
        return None
    if isinstance(row, dict):
        return row
    if isinstance(row, sqlite3.Row):
        return dict(row)
    return dict(row)


def execute(cursor, query: str, params: Iterable[Any] | None = None):
    sql, bound = _convert_params(query, params)
    return cursor.execute(sql, bound)


def executemany(cursor, query: str, rows: Iterable[Iterable[Any]]):
    if is_postgres_url():
        sql = query.replace("?", "%s")
        return cursor.executemany(sql, list(rows))
    return cursor.executemany(query, list(rows))


def fetchone(cursor):
    return dict_from_row(cursor.fetchone())


def fetchall(cursor):
    return [dict_from_row(row) for row in cursor.fetchall()]


@contextmanager
def transaction():
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def database_backend_name() -> str:
    if is_postgres_url():
        parsed = urlparse(DATABASE_URL)
        return f"postgres:{parsed.hostname or 'localhost'}"
    return "sqlite"

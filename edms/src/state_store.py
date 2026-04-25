import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from src.db import connect, execute, fetchall, fetchone, is_postgres_url, utcnow_iso
from src.runtime_config import (
    EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS,
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS,
)


def _hash_secret(value: str) -> str:
    return hashlib.sha256((value or "").encode("utf-8")).hexdigest()


def _expires_at(days: int = 0, minutes: int = 0, hours: int = 0) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=days, minutes=minutes, hours=hours)).isoformat()


def _json_load(value):
    if not value:
        return None
    if isinstance(value, (dict, list)):
        return value
    return json.loads(value)


def init_state_tables() -> None:
    conn = connect()
    try:
        cursor = conn.cursor()
        if is_postgres_url():
            execute(
                cursor,
                """
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    id TEXT PRIMARY KEY,
                    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                    refresh_token_hash TEXT UNIQUE NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    revoked_at TEXT,
                    user_agent TEXT,
                    client_ip TEXT
                )
                """,
            )
        else:
            execute(
                cursor,
                """
                CREATE TABLE IF NOT EXISTS auth_sessions (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    org_id INTEGER NOT NULL,
                    refresh_token_hash TEXT UNIQUE NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    revoked_at TEXT,
                    user_agent TEXT,
                    client_ip TEXT,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE
                )
                """,
            )
        execute(cursor, "CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id, created_at DESC)")

        execute(
            cursor,
            """
            CREATE TABLE IF NOT EXISTS email_verification_tokens (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                token_hash TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                consumed_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """,
        )
        execute(
            cursor,
            """
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                token_hash TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                consumed_at TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """,
        )
        execute(
            cursor,
            """
            CREATE TABLE IF NOT EXISTS chat_threads (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                org_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                messages_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE
            )
            """,
        )
        execute(cursor, "CREATE INDEX IF NOT EXISTS idx_chat_threads_user ON chat_threads(user_id, updated_at DESC)")
        execute(
            cursor,
            """
            CREATE TABLE IF NOT EXISTS recent_searches (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                org_id INTEGER NOT NULL,
                query TEXT NOT NULL,
                result_json TEXT,
                saved_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE
            )
            """,
        )
        execute(cursor, "CREATE INDEX IF NOT EXISTS idx_recent_searches_user ON recent_searches(user_id, saved_at DESC)")
        execute(
            cursor,
            """
            CREATE TABLE IF NOT EXISTS evaluation_results (
                org_slug TEXT PRIMARY KEY,
                result_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """,
        )
        conn.commit()
    finally:
        conn.close()


def create_refresh_session(user_id: int, org_id: int, *, user_agent: str | None, client_ip: str | None) -> Dict:
    conn = connect()
    try:
        cursor = conn.cursor()
        session_id = secrets.token_hex(16)
        refresh_token = secrets.token_urlsafe(48)
        payload = {
            "id": session_id,
            "user_id": user_id,
            "org_id": org_id,
            "refresh_token_hash": _hash_secret(refresh_token),
            "created_at": utcnow_iso(),
            "expires_at": _expires_at(days=REFRESH_TOKEN_EXPIRE_DAYS),
            "revoked_at": None,
            "user_agent": user_agent or "",
            "client_ip": client_ip or "",
        }
        execute(
            cursor,
            """
            INSERT INTO auth_sessions (
                id, user_id, org_id, refresh_token_hash, created_at, expires_at, revoked_at, user_agent, client_ip
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload["id"],
                payload["user_id"],
                payload["org_id"],
                payload["refresh_token_hash"],
                payload["created_at"],
                payload["expires_at"],
                payload["revoked_at"],
                payload["user_agent"],
                payload["client_ip"],
            ),
        )
        conn.commit()
        payload["refresh_token"] = refresh_token
        return payload
    finally:
        conn.close()


def get_session_by_refresh_token(refresh_token: str) -> Optional[Dict]:
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(
            cursor,
            """
            SELECT * FROM auth_sessions
            WHERE refresh_token_hash = ?
              AND revoked_at IS NULL
            LIMIT 1
            """,
            (_hash_secret(refresh_token),),
        )
        row = fetchone(cursor)
        if not row:
            return None
        if row["expires_at"] <= utcnow_iso():
            return None
        return row
    finally:
        conn.close()


def revoke_session(session_id: str) -> None:
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(cursor, "UPDATE auth_sessions SET revoked_at = ? WHERE id = ?", (utcnow_iso(), session_id))
        conn.commit()
    finally:
        conn.close()


def revoke_all_user_sessions(user_id: int) -> None:
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(cursor, "UPDATE auth_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL", (utcnow_iso(), user_id))
        conn.commit()
    finally:
        conn.close()


def create_one_time_token(table_name: str, user_id: int, *, expires_at: str) -> str:
    token = secrets.token_urlsafe(32)
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(
            cursor,
            f"""
            INSERT INTO {table_name} (id, user_id, token_hash, created_at, expires_at, consumed_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (secrets.token_hex(16), user_id, _hash_secret(token), utcnow_iso(), expires_at, None),
        )
        conn.commit()
        return token
    finally:
        conn.close()


def consume_one_time_token(table_name: str, token: str) -> Optional[Dict]:
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(
            cursor,
            f"""
            SELECT * FROM {table_name}
            WHERE token_hash = ?
              AND consumed_at IS NULL
            LIMIT 1
            """,
            (_hash_secret(token),),
        )
        row = fetchone(cursor)
        if not row:
            return None
        if row["expires_at"] <= utcnow_iso():
            return None
        execute(cursor, f"UPDATE {table_name} SET consumed_at = ? WHERE id = ?", (utcnow_iso(), row["id"]))
        conn.commit()
        return row
    finally:
        conn.close()


def create_email_verification_token(user_id: int) -> str:
    return create_one_time_token(
        "email_verification_tokens",
        user_id,
        expires_at=_expires_at(hours=EMAIL_VERIFICATION_TOKEN_EXPIRE_HOURS),
    )


def create_password_reset_token(user_id: int) -> str:
    return create_one_time_token(
        "password_reset_tokens",
        user_id,
        expires_at=_expires_at(minutes=PASSWORD_RESET_TOKEN_EXPIRE_MINUTES),
    )


def consume_email_verification_token(token: str) -> Optional[Dict]:
    return consume_one_time_token("email_verification_tokens", token)


def consume_password_reset_token(token: str) -> Optional[Dict]:
    return consume_one_time_token("password_reset_tokens", token)


def list_chat_threads(user_id: int, org_id: int) -> List[Dict]:
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(
            cursor,
            """
            SELECT * FROM chat_threads
            WHERE user_id = ? AND org_id = ?
            ORDER BY updated_at DESC, created_at DESC
            """,
            (user_id, org_id),
        )
        rows = fetchall(cursor)
        return [
            {
                "id": row["id"],
                "title": row["title"],
                "messages": _json_load(row["messages_json"]) or [],
                "createdAt": row["created_at"],
                "updatedAt": row["updated_at"],
            }
            for row in rows
        ]
    finally:
        conn.close()


def upsert_chat_thread(user_id: int, org_id: int, thread: Dict) -> Dict:
    payload = {
        "id": thread["id"],
        "title": thread["title"],
        "messages_json": json.dumps(thread.get("messages") or [], ensure_ascii=True),
        "created_at": thread.get("createdAt") or utcnow_iso(),
        "updated_at": thread.get("updatedAt") or utcnow_iso(),
    }
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(cursor, "DELETE FROM chat_threads WHERE id = ? AND (user_id != ? OR org_id != ?)", (payload["id"], user_id, org_id))
        if is_postgres_url():
            execute(
                cursor,
                """
                INSERT INTO chat_threads (id, user_id, org_id, title, messages_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    messages_json = EXCLUDED.messages_json,
                    updated_at = EXCLUDED.updated_at
                """,
                (payload["id"], user_id, org_id, payload["title"], payload["messages_json"], payload["created_at"], payload["updated_at"]),
            )
        else:
            execute(
                cursor,
                """
                INSERT INTO chat_threads (id, user_id, org_id, title, messages_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    messages_json = excluded.messages_json,
                    updated_at = excluded.updated_at
                """,
                (payload["id"], user_id, org_id, payload["title"], payload["messages_json"], payload["created_at"], payload["updated_at"]),
            )
        conn.commit()
        return thread
    finally:
        conn.close()


def delete_chat_thread(user_id: int, org_id: int, thread_id: str) -> None:
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(cursor, "DELETE FROM chat_threads WHERE id = ? AND user_id = ? AND org_id = ?", (thread_id, user_id, org_id))
        conn.commit()
    finally:
        conn.close()


def list_recent_searches(user_id: int, org_id: int, limit: int = 5) -> List[Dict]:
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(
            cursor,
            """
            SELECT * FROM recent_searches
            WHERE user_id = ? AND org_id = ?
            ORDER BY saved_at DESC, id DESC
            LIMIT ?
            """,
            (user_id, org_id, limit),
        )
        rows = fetchall(cursor)
        return [
            {
                "id": row["id"],
                "query": row["query"],
                "result": _json_load(row["result_json"]),
                "savedAt": row["saved_at"],
            }
            for row in rows
        ]
    finally:
        conn.close()


def save_recent_search(user_id: int, org_id: int, query: str, result: Dict | None, limit: int = 5) -> None:
    saved_at = utcnow_iso()
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(cursor, "DELETE FROM recent_searches WHERE user_id = ? AND org_id = ? AND query = ?", (user_id, org_id, query))
        execute(
            cursor,
            """
            INSERT INTO recent_searches (id, user_id, org_id, query, result_json, saved_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (secrets.token_hex(12), user_id, org_id, query, json.dumps(result, ensure_ascii=True) if result is not None else None, saved_at),
        )
        execute(
            cursor,
            """
            DELETE FROM recent_searches
            WHERE user_id = ? AND org_id = ? AND id NOT IN (
                SELECT id FROM recent_searches
                WHERE user_id = ? AND org_id = ?
                ORDER BY saved_at DESC, id DESC
                LIMIT ?
            )
            """,
            (user_id, org_id, user_id, org_id, limit),
        )
        conn.commit()
    finally:
        conn.close()


def clear_recent_searches(user_id: int, org_id: int) -> None:
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(cursor, "DELETE FROM recent_searches WHERE user_id = ? AND org_id = ?", (user_id, org_id))
        conn.commit()
    finally:
        conn.close()


def save_eval_result(org_slug: str, result: Dict):
    conn = connect()
    try:
        cursor = conn.cursor()
        payload = json.dumps(result, ensure_ascii=True)
        if is_postgres_url():
            execute(
                cursor,
                """
                INSERT INTO evaluation_results (org_slug, result_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT (org_slug) DO UPDATE SET
                    result_json = EXCLUDED.result_json,
                    updated_at = EXCLUDED.updated_at
                """,
                (org_slug, payload, utcnow_iso()),
            )
        else:
            execute(
                cursor,
                """
                INSERT INTO evaluation_results (org_slug, result_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(org_slug) DO UPDATE SET
                    result_json = excluded.result_json,
                    updated_at = excluded.updated_at
                """,
                (org_slug, payload, utcnow_iso()),
            )
        conn.commit()
    finally:
        conn.close()


def get_eval_result(org_slug: str) -> Optional[Dict]:
    conn = connect()
    try:
        cursor = conn.cursor()
        execute(cursor, "SELECT result_json FROM evaluation_results WHERE org_slug = ?", (org_slug,))
        row = fetchone(cursor)
        if not row:
            return None
        return _json_load(row["result_json"])
    finally:
        conn.close()

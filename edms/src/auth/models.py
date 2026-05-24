import secrets
from typing import Dict, Optional

from src.db import connect, execute, fetchall, fetchone, is_postgres_url, utcnow_iso
from src.tenancy import ensure_org_directories, slugify_org_name

VALID_ROLES = {"admin", "user"}
LEGACY_ROLE_MAP = {"employee": "user"}


def get_connection():
    return connect()


def normalize_role(role: str) -> str:
    normalized = (role or "").strip().lower()
    return LEGACY_ROLE_MAP.get(normalized, normalized)


def _organization_from_row(row: dict | None) -> Optional[Dict]:
    if row is None:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "slug": row["slug"],
        "invite_code": row["invite_code"],
        "created_at": row["created_at"],
    }


def _user_from_row(row: dict | None) -> Optional[Dict]:
    if row is None:
        return None
    return {
        "id": row["id"],
        "email": row["email"],
        "hashed_password": row["hashed_password"],
        "role": normalize_role(row["role"]),
        "org_id": row["org_id"],
        "org_name": row["org_name"],
        "org_slug": row["org_slug"],
        "invite_code": row.get("invite_code"),
        "email_verified_at": row.get("email_verified_at"),
    }


def _create_organizations_table(cursor):
    if is_postgres_url():
        execute(
            cursor,
            """
            CREATE TABLE IF NOT EXISTS organizations (
                id BIGSERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                invite_code TEXT UNIQUE NOT NULL,
                created_at TEXT NOT NULL
            )
            """,
        )
        return

    execute(
        cursor,
        """
        CREATE TABLE IF NOT EXISTS organizations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            slug TEXT UNIQUE NOT NULL,
            invite_code TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL
        )
        """,
    )


def _create_users_table(cursor):
    if is_postgres_url():
        execute(
            cursor,
            """
            CREATE TABLE IF NOT EXISTS users (
                id BIGSERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
                org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                email_verified_at TEXT
            )
            """,
        )
    else:
        execute(
            cursor,
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
                org_id INTEGER NOT NULL,
                email_verified_at TEXT,
                FOREIGN KEY(org_id) REFERENCES organizations(id) ON DELETE CASCADE
            )
            """,
        )
    execute(cursor, "CREATE INDEX IF NOT EXISTS idx_users_org_id ON users(org_id)")


def _ensure_users_schema(cursor):
    if is_postgres_url():
        execute(cursor, "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TEXT")
        return

    execute(cursor, "PRAGMA table_info(users)")
    existing_columns = {row["name"] for row in fetchall(cursor)}
    if "email_verified_at" not in existing_columns:
        execute(cursor, "ALTER TABLE users ADD COLUMN email_verified_at TEXT")


_ORG_FETCH_COLUMNS = {"id", "slug", "invite_code"}


def _fetch_organization(cursor, clause: str, value) -> Optional[Dict]:
    if clause not in _ORG_FETCH_COLUMNS:
        raise ValueError(f"Invalid column: {clause}")
    execute(
        cursor,
        f"""
        SELECT id, name, slug, invite_code, created_at
        FROM organizations
        WHERE {clause} = ?
        """,
        (value,),
    )
    return _organization_from_row(fetchone(cursor))


def _fetch_user_by_email(cursor, email: str) -> Optional[Dict]:
    execute(
        cursor,
        """
        SELECT
            users.id,
            users.email,
            users.hashed_password,
            users.role,
            users.org_id,
            users.email_verified_at,
            organizations.name AS org_name,
            organizations.slug AS org_slug,
            organizations.invite_code AS invite_code
        FROM users
        JOIN organizations ON organizations.id = users.org_id
        WHERE users.email = ?
        """,
        ((email or "").strip().lower(),),
    )
    return _user_from_row(fetchone(cursor))


def _insert_user(cursor, email: str, hashed_password: str, role: str, org_id: int) -> int:
    normalized_role = normalize_role(role)
    if normalized_role not in VALID_ROLES:
        raise ValueError(f"Invalid role: {role}")
    if is_postgres_url():
        execute(
            cursor,
            """
            INSERT INTO users (email, hashed_password, role, org_id)
            VALUES (?, ?, ?, ?)
            RETURNING id
            """,
            (email.strip().lower(), hashed_password, normalized_role, org_id),
        )
        row = fetchone(cursor)
        return int(row["id"])

    execute(
        cursor,
        """
        INSERT INTO users (email, hashed_password, role, org_id)
        VALUES (?, ?, ?, ?)
        """,
        (email.strip().lower(), hashed_password, normalized_role, org_id),
    )
    return int(cursor.lastrowid)


def _generate_invite_code(cursor) -> str:
    while True:
        raw = secrets.token_hex(8).upper()
        code = f"{raw[:4]}-{raw[4:8]}-{raw[8:12]}-{raw[12:]}"
        execute(cursor, "SELECT 1 FROM organizations WHERE invite_code = ?", (code,))
        if fetchone(cursor) is None:
            return code


def _generate_unique_slug(cursor, organization_name: str) -> str:
    base_slug = slugify_org_name(organization_name)
    slug = base_slug
    suffix = 2
    while True:
        execute(cursor, "SELECT 1 FROM organizations WHERE slug = ?", (slug,))
        if fetchone(cursor) is None:
            return slug
        slug = f"{base_slug}-{suffix}"
        suffix += 1


def _insert_organization(cursor, organization_name: str, preferred_slug: str | None = None) -> Dict:
    clean_name = (organization_name or "").strip() or "Organization"
    slug = preferred_slug or _generate_unique_slug(cursor, clean_name)
    invite_code = _generate_invite_code(cursor)
    created_at = utcnow_iso()
    if is_postgres_url():
        execute(
            cursor,
            """
            INSERT INTO organizations (name, slug, invite_code, created_at)
            VALUES (?, ?, ?, ?)
            RETURNING id
            """,
            (clean_name, slug, invite_code, created_at),
        )
        row = fetchone(cursor)
        org_id = int(row["id"])
    else:
        execute(
            cursor,
            """
            INSERT INTO organizations (name, slug, invite_code, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (clean_name, slug, invite_code, created_at),
        )
        org_id = int(cursor.lastrowid)
    ensure_org_directories(slug)
    return {
        "id": org_id,
        "name": clean_name,
        "slug": slug,
        "invite_code": invite_code,
        "created_at": created_at,
    }


def init_db():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _create_organizations_table(cursor)
        _create_users_table(cursor)
        _ensure_users_schema(cursor)
        conn.commit()
    finally:
        conn.close()


def list_organizations() -> list[Dict]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        execute(
            cursor,
            """
            SELECT id, name, slug, invite_code, created_at
            FROM organizations
            ORDER BY created_at ASC, id ASC
            """,
        )
        return [_organization_from_row(row) for row in fetchall(cursor)]
    finally:
        conn.close()


def get_organization_by_id(org_id: int) -> Optional[Dict]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        return _fetch_organization(cursor, "id", org_id)
    finally:
        conn.close()


def get_organization_by_name(name: str) -> Optional[Dict]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        execute(
            cursor,
            """
            SELECT id, name, slug, invite_code, created_at
            FROM organizations
            WHERE lower(name) = ?
            ORDER BY id ASC
            LIMIT 1
            """,
            ((name or "").strip().lower(),),
        )
        return _organization_from_row(fetchone(cursor))
    finally:
        conn.close()


def get_organization_by_invite_code(invite_code: str) -> Optional[Dict]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        return _fetch_organization(cursor, "invite_code", (invite_code or "").strip().upper())
    finally:
        conn.close()


def create_organization(organization_name: str) -> Dict:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        organization = _insert_organization(cursor, organization_name)
        conn.commit()
        return organization
    finally:
        conn.close()


def get_or_create_organization(organization_name: str) -> Dict:
    existing = get_organization_by_name(organization_name)
    if existing:
        return existing
    return create_organization(organization_name)


def rotate_invite_code(org_id: int) -> Dict:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        code = _generate_invite_code(cursor)
        execute(cursor, "UPDATE organizations SET invite_code = ? WHERE id = ?", (code, org_id))
        organization = _fetch_organization(cursor, "id", org_id)
        conn.commit()
        if not organization:
            raise ValueError("Organization not found")
        organization["invite_code"] = code
        return organization
    finally:
        conn.close()


def create_user(email: str, hashed_password: str, role: str, org_id: int) -> bool:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        _insert_user(cursor, email, hashed_password, role, org_id)
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return False
    finally:
        conn.close()


def register_admin_account(email: str, hashed_password: str, organization_name: str) -> Dict:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        if _fetch_user_by_email(cursor, email):
            raise ValueError("Account already exists")
        execute(cursor, "SELECT 1 FROM organizations WHERE lower(name) = ?", ((organization_name or "").strip().lower(),))
        if fetchone(cursor):
            raise ValueError("Company already exists")
        organization = _insert_organization(cursor, organization_name)
        _insert_user(cursor, email, hashed_password, "admin", organization["id"])
        conn.commit()
        return _fetch_user_by_email(cursor, email)
    finally:
        conn.close()


def register_user_with_invite(email: str, hashed_password: str, invite_code: str) -> Dict:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        if _fetch_user_by_email(cursor, email):
            raise ValueError("Account already exists")
        organization = _fetch_organization(cursor, "invite_code", (invite_code or "").strip().upper())
        if not organization:
            raise LookupError("Invalid invite code")
        _insert_user(cursor, email, hashed_password, "user", organization["id"])
        conn.commit()
        return _fetch_user_by_email(cursor, email)
    finally:
        conn.close()


def get_user_by_email(email: str) -> Optional[Dict]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        return _fetch_user_by_email(cursor, email)
    finally:
        conn.close()


def get_user_by_id(user_id: int) -> Optional[Dict]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        execute(
            cursor,
            """
            SELECT
                users.id,
                users.email,
                users.hashed_password,
                users.role,
                users.org_id,
                users.email_verified_at,
                organizations.name AS org_name,
                organizations.slug AS org_slug,
                organizations.invite_code AS invite_code
            FROM users
            JOIN organizations ON organizations.id = users.org_id
            WHERE users.id = ?
            """,
            (user_id,),
        )
        return _user_from_row(fetchone(cursor))
    finally:
        conn.close()


def mark_email_verified(user_id: int) -> Optional[Dict]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        execute(cursor, "UPDATE users SET email_verified_at = ? WHERE id = ?", (utcnow_iso(), user_id))
        conn.commit()
        return get_user_by_id(user_id)
    finally:
        conn.close()


def update_user_password(user_id: int, hashed_password: str) -> Optional[Dict]:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        execute(cursor, "UPDATE users SET hashed_password = ? WHERE id = ?", (hashed_password, user_id))
        conn.commit()
        return get_user_by_id(user_id)
    finally:
        conn.close()

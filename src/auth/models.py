import sqlite3
from typing import Optional, Dict

DB_PATH = "data/edms_auth.db"


# ------------------
# Database setup
# ------------------

def get_connection():
    return sqlite3.connect(DB_PATH)


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('admin', 'employee'))
        )
        """
    )

    conn.commit()
    conn.close()


# ------------------
# User operations
# ------------------

def create_user(
    email: str,
    hashed_password: str,
    role: str
) -> bool:
    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            INSERT INTO users (email, hashed_password, role)
            VALUES (?, ?, ?)
            """,
            (email, hashed_password, role),
        )

        conn.commit()
        conn.close()
        return True

    except sqlite3.IntegrityError:
        # Email already exists
        return False


def get_user_by_email(email: str) -> Optional[Dict]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, email, hashed_password, role
        FROM users
        WHERE email = ?
        """,
        (email,),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row[0],
        "email": row[1],
        "hashed_password": row[2],
        "role": row[3],
    }

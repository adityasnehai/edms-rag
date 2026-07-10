from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

import logging
import os

from jose import JWTError, jwt
from passlib.context import CryptContext

# ------------------
# Configuration
# ------------------

SECRET_KEY = (os.getenv("JWT_SECRET") or "").strip()
if not SECRET_KEY:
    SECRET_KEY = os.getenv("JWT_SECRET_FALLBACK", "edms-unsafe-dev-secret")
    logging.getLogger(__name__).warning("JWT_SECRET is not set; using an ephemeral fallback secret")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto"
)



# ------------------
# Password helpers
# ------------------

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


# ------------------
# JWT helpers
# ------------------

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    to_encode = data.copy()

    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta
        if expires_delta
        else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update(
        {
            "exp": expire,
            "iat": now,
            "nbf": now,
            "jti": uuid4().hex,
            "token_type": "access",
        }
    )

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return {}

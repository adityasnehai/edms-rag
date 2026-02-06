from datetime import datetime, timedelta
from typing import Optional

from jose import jwt, JWTError
from passlib.context import CryptContext

# ------------------
# Configuration
# ------------------

import os

SECRET_KEY = os.getenv("JWT_SECRET")

if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET is not set")

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

    expire = datetime.utcnow() + (
        expires_delta
        if expires_delta
        else timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({"exp": expire})

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return {}


# (venv) aditya@Sneh:~/projects/p1/edms$ python
# Python 3.12.3 (main, Nov  6 2025, 13:44:16) [GCC 13.3.0] on linux
# Type "help", "copyright", "credits" or "license" for more information.
# Ctrl click to launch VS Code Native REPL
# >>> from src.auth.auth import (
# ...     hash_password,
# ...     verify_password,
# ...     create_access_token,
# ...     decode_access_token
# ... )
# >>> 
# >>> pw = hash_password("admin123")
# >>> verify_password("admin123", pw)
# True
# >>> verify_password("wrongpass", pw)
# False
# >>> 
# >>> token = create_access_token({
# ...     "sub": "admin@example.com",
# ...     "role": "admin"
# ... })
# >>> 
# >>> decode_access_token(token)
# {'sub': 'admin@example.com', 'role': 'admin', 'exp': 1768588973}
# >>> 
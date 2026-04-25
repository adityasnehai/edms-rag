from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from src.auth.auth import decode_access_token
from src.auth.models import get_user_by_id

security = HTTPBearer(auto_error=False)


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    # Allow CORS preflight
    if request.method == "OPTIONS":
        return None

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    required_fields = {"id", "sub", "role", "org_id", "org_slug", "org_name", "token_type"}
    if not required_fields.issubset(payload):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token",
        )

    if payload.get("token_type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user = get_user_by_id(int(payload["id"]))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    if (
        user["email"] != payload.get("sub")
        or user["role"] != payload.get("role")
        or user["org_id"] != payload.get("org_id")
        or user["org_slug"] != payload.get("org_slug")
        or user["org_name"] != payload.get("org_name")
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session is no longer valid",
        )

    return {
        "id": user["id"],
        "sub": user["email"],
        "role": user["role"],
        "org_id": user["org_id"],
        "org_slug": user["org_slug"],
        "org_name": user["org_name"],
    }


def require_admin(user=Depends(get_current_user)):
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return user

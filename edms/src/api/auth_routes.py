import re

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.auth.auth import create_access_token, hash_password, verify_password
from src.auth.models import (
    VALID_ROLES,
    get_user_by_email,
    get_user_by_id,
    mark_email_verified,
    normalize_role,
    register_admin_account,
    register_user_with_invite,
    update_user_password,
)
from src.runtime_config import PASSWORD_MIN_LENGTH
from src.state_store import (
    consume_email_verification_token,
    consume_password_reset_token,
    create_email_verification_token,
    create_password_reset_token,
    create_refresh_session,
    get_session_by_refresh_token,
    revoke_all_user_sessions,
    revoke_session,
)
from src.traffic_control import enforce_rate_limit

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
    include_in_schema=True,
)


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    email: str
    password: str
    role: str = "user"
    organization_name: str | None = None
    invite_code: str | None = None


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    invite_code: str | None = None
    organization_name: str | None = None
    email_verification_required: bool = False


class RefreshRequest(BaseModel):
    refresh_token: str


class EmailRequest(BaseModel):
    email: str


class PasswordResetRequest(BaseModel):
    token: str
    password: str


class VerifyEmailRequest(BaseModel):
    token: str


def _clean_email(email: str) -> str:
    return email.strip().lower()


def _clean_invite_code(invite_code: str | None) -> str:
    return (invite_code or "").strip().upper()


def _validate_email(email: str) -> bool:
    if not email or "@" not in email:
        return False

    local_part, _, domain = email.partition("@")
    return bool(local_part and domain and "." in domain)


def _validate_password_strength(password: str) -> str | None:
    if len(password) < PASSWORD_MIN_LENGTH:
        return f"Password must be at least {PASSWORD_MIN_LENGTH} characters"
    if not re.search(r"[A-Za-z]", password):
        return "Password must include at least one letter"
    if not re.search(r"\d", password):
        return "Password must include at least one number"
    return None


def _rate_limit_identity(request: Request, email: str) -> str:
    client_host = getattr(request.client, "host", "unknown") or "unknown"
    safe_email = _clean_email(email) if email else "unknown"
    return f"ip:{client_host}:email:{safe_email}"


def _issue_token(user: dict, request: Request, *, include_invite_code: bool = False) -> AuthResponse:
    token = create_access_token(
        {
            "id": user["id"],
            "sub": user["email"],
            "role": user["role"],
            "org_id": user["org_id"],
            "org_slug": user["org_slug"],
            "org_name": user["org_name"],
        }
    )
    session = create_refresh_session(
        user_id=user["id"],
        org_id=user["org_id"],
        user_agent=request.headers.get("user-agent"),
        client_ip=getattr(request.client, "host", "") or "",
    )
    response = {
        "access_token": token,
        "refresh_token": session["refresh_token"],
        "email_verification_required": not bool(user.get("email_verified_at")),
    }
    if include_invite_code:
        response["invite_code"] = user.get("invite_code")
        response["organization_name"] = user.get("org_name")
    return response


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, request: Request):
    email = _clean_email(data.email)
    if not email or not data.password.strip():
        raise HTTPException(status_code=400, detail="Email and password are required")
    enforce_rate_limit(_rate_limit_identity(request, email), "login")
    user = get_user_by_email(email)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return _issue_token(user, request)


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(data: RegisterRequest, request: Request):
    email = _clean_email(data.email)
    role = normalize_role(data.role)
    organization_name = (data.organization_name or "").strip()
    invite_code = _clean_invite_code(data.invite_code)
    enforce_rate_limit(_rate_limit_identity(request, email), "register")

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")

    if not _validate_email(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address")

    if not data.password.strip():
        raise HTTPException(status_code=400, detail="Password is required")

    password_error = _validate_password_strength(data.password)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)

    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role selected")

    if get_user_by_email(email):
        raise HTTPException(status_code=409, detail="Account already exists")

    try:
        if role == "admin":
            if not organization_name:
                raise HTTPException(
                    status_code=400,
                    detail="Company name is required for admin signup",
                )

            user = register_admin_account(
                email=email,
                hashed_password=hash_password(data.password),
                organization_name=organization_name,
            )
        else:
            if not invite_code:
                raise HTTPException(
                    status_code=400,
                    detail="Invite code is required for user signup",
                )

            user = register_user_with_invite(
                email=email,
                hashed_password=hash_password(data.password),
                invite_code=invite_code,
            )
    except LookupError:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    except ValueError as exc:
        detail = str(exc) or "Unable to create account"
        status_code = 409 if "exists" in detail.lower() else 400
        raise HTTPException(status_code=status_code, detail=detail)

    return _issue_token(user, request, include_invite_code=role == "admin")


@router.post("/refresh", response_model=AuthResponse)
def refresh_access_token(data: RefreshRequest, request: Request):
    session = get_session_by_refresh_token(data.refresh_token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    revoke_session(session["id"])
    user = get_user_by_id(session["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    return _issue_token(user, request, include_invite_code=user["role"] == "admin")


@router.post("/logout")
def logout(data: RefreshRequest):
    session = get_session_by_refresh_token(data.refresh_token)
    if session:
        revoke_session(session["id"])
    return {"status": "ok"}


@router.post("/logout-all")
def logout_all(data: RefreshRequest):
    session = get_session_by_refresh_token(data.refresh_token)
    if session:
        revoke_all_user_sessions(session["user_id"])
    return {"status": "ok"}


@router.post("/password-reset/request")
def request_password_reset(data: EmailRequest):
    user = get_user_by_email(_clean_email(data.email))
    if user:
        token = create_password_reset_token(user["id"])
        return {"status": "ok", "reset_token": token}
    return {"status": "ok"}


@router.post("/password-reset/confirm")
def confirm_password_reset(data: PasswordResetRequest):
    password_error = _validate_password_strength(data.password)
    if password_error:
        raise HTTPException(status_code=400, detail=password_error)
    token_row = consume_password_reset_token(data.token)
    if not token_row:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    update_user_password(token_row["user_id"], hash_password(data.password))
    revoke_all_user_sessions(token_row["user_id"])
    return {"status": "ok"}


@router.post("/email-verification/request")
def request_email_verification(data: EmailRequest):
    user = get_user_by_email(_clean_email(data.email))
    if user and not user.get("email_verified_at"):
        token = create_email_verification_token(user["id"])
        return {"status": "ok", "verification_token": token}
    return {"status": "ok"}


@router.post("/email-verification/confirm")
def confirm_email_verification(data: VerifyEmailRequest):
    token_row = consume_email_verification_token(data.token)
    if not token_row:
        raise HTTPException(status_code=400, detail="Invalid or expired verification token")
    mark_email_verified(token_row["user_id"])
    return {"status": "ok"}

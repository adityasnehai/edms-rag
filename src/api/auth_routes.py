from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from src.auth.models import get_user_by_email

from src.auth.auth import verify_password, create_access_token

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
    include_in_schema=True
)



# ------------------
# Request schemas
# ------------------

class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ------------------
# Routes
# ------------------

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest):
    user = get_user_by_email(data.email)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        {
            "sub": user["email"],
            "role": user["role"],
        }
    )

    return {"access_token": token}

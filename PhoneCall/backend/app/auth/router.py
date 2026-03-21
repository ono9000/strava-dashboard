from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth.jwt import create_token
from app.auth.middleware import get_current_operator
from app.db.session import get_db
from app.db.models import Operator

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/auth/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Operator).where(Operator.email == body.email))
    operator = result.scalar_one_or_none()
    if operator is None or not pwd_context.verify(body.password, operator.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    token = create_token(subject=str(operator.id), email=operator.email)
    return TokenResponse(access_token=token)


@router.get("/api/v1/me")
async def get_me(operator: Operator = Depends(get_current_operator)):
    return {"id": str(operator.id), "email": operator.email, "name": operator.name}

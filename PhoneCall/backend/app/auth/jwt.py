from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from app.config import settings

ALGORITHM = "HS256"


def create_token(
    subject: str,
    email: str,
    expires_delta: timedelta | None = None,
) -> str:
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.jwt_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": subject, "email": email, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    # Raises jose.JWTError if the token is invalid or expired
    return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])

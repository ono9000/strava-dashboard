from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth.jwt import decode_token
from app.db.session import get_db
from app.db.models import Operator

_bearer = HTTPBearer(auto_error=False)


async def _get_credentials(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> HTTPAuthorizationCredentials:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials


async def get_current_operator(
    credentials: HTTPAuthorizationCredentials = Depends(_get_credentials),
    db: AsyncSession = Depends(get_db),
) -> Operator:
    try:
        payload = decode_token(credentials.credentials)
        operator_id = payload.get("sub")
        if operator_id is None:
            raise JWTError("no sub in token")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    result = await db.execute(select(Operator).where(Operator.id == operator_id))
    operator = result.scalar_one_or_none()
    if operator is None or not operator.active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Operator not found",
        )
    return operator

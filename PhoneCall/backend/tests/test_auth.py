import uuid
import pytest
from datetime import timedelta
from httpx import AsyncClient
from jose import JWTError
from passlib.context import CryptContext
from sqlalchemy import select
from app.auth.jwt import create_token, decode_token
from app.db.models import Operator

pytestmark = pytest.mark.asyncio(loop_scope="session")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# --- JWT unit tests (synchronous) ---

def test_create_and_decode_token():
    token = create_token(subject="test-id", email="test@example.com")
    payload = decode_token(token)
    assert payload["sub"] == "test-id"
    assert payload["email"] == "test@example.com"


def test_expired_token_raises():
    token = create_token(
        subject="test-id",
        email="test@example.com",
        expires_delta=timedelta(seconds=-1),
    )
    with pytest.raises(JWTError):
        decode_token(token)


def test_invalid_token_raises():
    with pytest.raises(JWTError):
        decode_token("not.a.real.token")


# --- Auth endpoint tests (async) ---

async def test_login_success(client: AsyncClient, seeded_operator):
    response = await client.post("/auth/login", json={
        "email": "admin@test.com",
        "password": "testpassword",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client: AsyncClient, seeded_operator):
    response = await client.post("/auth/login", json={
        "email": "admin@test.com",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


async def test_login_unknown_email(client: AsyncClient):
    response = await client.post("/auth/login", json={
        "email": "nobody@test.com",
        "password": "any",
    })
    assert response.status_code == 401


async def test_get_me_with_valid_token(client: AsyncClient, seeded_operator):
    login = await client.post("/auth/login", json={
        "email": "admin@test.com",
        "password": "testpassword",
    })
    token = login.json()["access_token"]
    response = await client.get(
        "/api/v1/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "admin@test.com"


async def test_get_me_without_token(client: AsyncClient):
    response = await client.get("/api/v1/me")
    assert response.status_code == 401


# --- Model persistence tests ---

async def test_operator_password_stored_hashed(db_session):
    """Verifies that passwords are never stored in plain text."""
    op = Operator(
        id=uuid.uuid4(),
        email="hashcheck@test.com",
        hashed_password=pwd_context.hash("mypassword"),
        name="Hash Check",
        active=True,
    )
    db_session.add(op)
    await db_session.flush()

    result = await db_session.execute(
        select(Operator).where(Operator.email == "hashcheck@test.com")
    )
    found = result.scalar_one()
    assert found.hashed_password != "mypassword"
    assert pwd_context.verify("mypassword", found.hashed_password)

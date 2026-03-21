# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the PhoneCall project with Docker Compose, PostgreSQL, async SQLAlchemy models, Alembic migrations, JWT auth, and a running FastAPI server with a passing test suite.

**Architecture:** Single FastAPI app structured as a modular monolith. All DB access via SQLAlchemy 2.x async + asyncpg. Configuration via pydantic-settings. Auth via JWT (python-jose). Tests use pytest-asyncio (auto mode) + httpx AsyncClient against a dedicated test PostgreSQL database.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2.x, asyncpg, Alembic, pydantic-settings, python-jose[cryptography], passlib[bcrypt], ARQ, pytest, pytest-asyncio, httpx

**Spec:** `docs/superpowers/specs/2026-03-21-phonecall-design.md`

---

## File Map

```
phonecall/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # FastAPI app, lifespan, router registration
│   │   ├── config.py                 # All env vars via pydantic-settings
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── session.py            # Async engine + session factory
│   │   │   └── models.py             # All SQLAlchemy ORM models
│   │   └── auth/
│   │       ├── __init__.py
│   │       ├── jwt.py                # Token issue + validate
│   │       ├── middleware.py         # FastAPI dependency: get_current_operator
│   │       └── router.py             # POST /auth/login, GET /api/v1/me
│   ├── workers/
│   │   ├── __init__.py
│   │   └── settings.py               # ARQ WorkerSettings stub
│   ├── tests/
│   │   ├── conftest.py               # Fixtures: engine, db_session, client, simple_client, seeded_operator
│   │   ├── test_health.py            # Uses simple_client (no DB dependency)
│   │   ├── test_models.py            # Uses db_session
│   │   └── test_auth.py              # Uses client (with DB override) + seeded_operator
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       └── {hash}_initial.py     # All four tables (filename set by Alembic)
│   ├── alembic.ini
│   ├── pytest.ini                    # asyncio_mode = auto
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## Task 1: Project scaffold

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/Dockerfile`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `backend/app/__init__.py` (empty)
- Create: `backend/app/db/__init__.py` (empty)
- Create: `backend/app/auth/__init__.py` (empty)
- Create: `backend/workers/__init__.py` (empty)
- Create: `backend/tests/__init__.py` (empty)

- [ ] **Step 1: Create `backend/requirements.txt`**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
alembic==1.13.3
pydantic-settings==2.5.2
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
arq==0.26.1
httpx==0.27.2
pytest==8.3.3
pytest-asyncio==0.24.0
```

- [ ] **Step 2: Create `backend/pytest.ini`**

This is required for pytest-asyncio 0.24 to run async tests without `@pytest.mark.asyncio` on every function, and to allow session-scoped async fixtures to work correctly.

```ini
[pytest]
asyncio_mode = auto
asyncio_default_fixture_loop_scope = session
testpaths = tests
```

- [ ] **Step 3: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 4: Create `docker-compose.yml`**

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./backend:/app

  worker:
    build: ./backend
    command: python -m arq workers.settings.WorkerSettings
    env_file: .env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started
    volumes:
      - ./backend:/app

  db:
    image: postgres:16
    environment:
      POSTGRES_USER: phonecall
      POSTGRES_PASSWORD: phonecall
      POSTGRES_DB: phonecall
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U phonecall"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  dashboard:
    image: node:20-alpine
    working_dir: /app
    command: sh -c "echo 'Dashboard not yet implemented' && sleep infinity"
    profiles:
      - dashboard  # opt-in: run with --profile dashboard when ready

volumes:
  postgres_data:
```

- [ ] **Step 5: Create `.env.example`**

```
# Database
DATABASE_URL=postgresql+asyncpg://phonecall:phonecall@db:5432/phonecall
REDIS_URL=redis://redis:6379

# OpenAI
OPENAI_API_KEY=

# Twilio (add when available)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Google Maps (add when available)
GOOGLE_MAPS_API_KEY=

# Auth
JWT_SECRET=change-this-secret-in-production
JWT_EXPIRE_MINUTES=480

# Operator seed (created on first run)
OPERATOR_DEFAULT_EMAIL=admin@phonecall.com
OPERATOR_DEFAULT_PASSWORD=change-this-password

# OpenAI Realtime
OPENAI_REALTIME_VOICE=alloy

# Operator call transfer
OPERATOR_TRANSFER_TARGET=

# Base URL (for Twilio callbacks)
BASE_URL=http://localhost:8000

# Config
MAX_WORKSHOP_ATTEMPTS=3
WORKSHOP_ANSWER_TIMEOUT_SECONDS=45
STALE_SESSION_CLEANUP_INTERVAL_MINUTES=15
```

- [ ] **Step 6: Create empty `__init__.py` files**

```bash
touch backend/app/__init__.py
touch backend/app/db/__init__.py
touch backend/app/auth/__init__.py
touch backend/workers/__init__.py
touch backend/tests/__init__.py
```

- [ ] **Step 7: Copy `.env.example` to `.env` and fill in `JWT_SECRET`**

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET to any random string, e.g. JWT_SECRET=devkey123
# For local test runs, also make sure DATABASE_URL points to localhost:5432, not db:5432
```

- [ ] **Step 8: Commit**

```bash
git add backend/ docker-compose.yml .env.example
git commit -m "feat: scaffold project structure with Docker Compose"
```

---

## Task 2: Config + FastAPI app + health check

**Files:**
- Create: `backend/app/config.py`
- Create: `backend/app/main.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/conftest.py` with only the `simple_client` fixture for now. The `client` fixture (with DB) is added in Task 6.

```python
import pytest_asyncio
from httpx import AsyncClient, ASGITransport


@pytest_asyncio.fixture
async def simple_client():
    """HTTP client with no DB override — use for endpoints that do not touch the database."""
    from app.main import app
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
```

Create `backend/tests/test_health.py`:

```python
async def test_health_check(simple_client: AsyncClient):
    response = await simple_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

Note: no `@pytest.mark.asyncio` needed — `asyncio_mode = auto` in `pytest.ini` handles this.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
pytest tests/test_health.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 3: Create `backend/app/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://phonecall:phonecall@localhost:5432/phonecall"
    redis_url: str = "redis://localhost:6379"

    openai_api_key: str = ""
    openai_realtime_voice: str = "alloy"

    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    google_maps_api_key: str = ""

    jwt_secret: str = "dev-secret-change-in-production"
    jwt_expire_minutes: int = 480

    operator_default_email: str = "admin@phonecall.com"
    operator_default_password: str = "changeme"

    operator_transfer_target: str = ""
    base_url: str = "http://localhost:8000"

    max_workshop_attempts: int = 3
    workshop_answer_timeout_seconds: int = 45
    stale_session_cleanup_interval_minutes: int = 15


settings = Settings()
```

- [ ] **Step 4: Create `backend/app/main.py`**

```python
from fastapi import FastAPI


app = FastAPI(title="PhoneCall", version="1.0.0")


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd backend
pytest tests/test_health.py -v
```

Expected: `PASSED`

- [ ] **Step 6: Commit**

```bash
git add backend/app/config.py backend/app/main.py backend/tests/
git commit -m "feat: add FastAPI app with health check"
```

---

## Task 3: Database models

**Files:**
- Create: `backend/app/db/session.py`
- Create: `backend/app/db/models.py`
- Modify: `backend/tests/conftest.py` (add `engine` and `db_session` fixtures)
- Create: `backend/tests/test_models.py`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/conftest.py`:

```python
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

TEST_DATABASE_URL = "postgresql+asyncpg://phonecall:phonecall@localhost:5432/phonecall_test"


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def engine():
    from app.db.models import Base
    eng = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        await session.begin()
        yield session
        await session.rollback()
```

Create `backend/tests/test_models.py`:

```python
from sqlalchemy import text


async def test_tables_exist(db_session):
    result = await db_session.execute(
        text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
    )
    tables = {row[0] for row in result}
    assert "operators" in tables
    assert "incidents" in tables
    assert "workshops" in tables
    assert "call_logs" in tables
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend
pytest tests/test_models.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.db.models'`

- [ ] **Step 3: Create `backend/app/db/session.py`**

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.config import settings

engine = create_async_engine(settings.database_url, echo=False)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 4: Create `backend/app/db/models.py`**

```python
import uuid
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, ARRAY
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class Operator(Base):
    __tablename__ = "operators"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Workshop(Base):
    __tablename__ = "workshops"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    country = Column(String(2), nullable=False)
    language_codes = Column(ARRAY(String), nullable=False, default=list)
    services = Column(ARRAY(String), nullable=False, default=list)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    priority_score = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    incidents = relationship("Incident", back_populates="workshop")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    status = Column(String, nullable=False, default="NEW")

    driver_phone = Column(String, nullable=False)
    driver_language = Column(String(5), nullable=True)
    driver_name = Column(String, nullable=True)
    plate_number = Column(String, nullable=True)
    truck_company = Column(String, nullable=True)

    issue_type = Column(String, nullable=True)
    issue_description = Column(Text, nullable=True)
    risk_level = Column(String, default="low", nullable=False)

    location_text = Column(Text, nullable=True)
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)

    assigned_workshop_id = Column(UUID(as_uuid=True), ForeignKey("workshops.id"), nullable=True)
    eta_minutes = Column(Integer, nullable=True)

    escalation_required = Column(Boolean, default=False, nullable=False)
    escalation_reason = Column(Text, nullable=True)
    abrupt_end = Column(Boolean, default=False, nullable=False)
    driver_disconnected_mid_contact = Column(Boolean, default=False, nullable=False)

    claimed_by_operator_id = Column(UUID(as_uuid=True), ForeignKey("operators.id"), nullable=True)
    claimed_at = Column(DateTime(timezone=True), nullable=True)

    workshop = relationship("Workshop", back_populates="incidents")
    call_logs = relationship("CallLog", back_populates="incident")
    claimed_by = relationship("Operator", foreign_keys=[claimed_by_operator_id])


class CallLog(Base):
    __tablename__ = "call_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    incident_id = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=False)
    call_type = Column(String, nullable=False)  # driver | workshop | operator
    attempt_number = Column(Integer, nullable=False, default=1)
    twilio_call_sid = Column(String, nullable=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    transcript = Column(Text, nullable=True)
    structured_result = Column(JSONB, nullable=True)
    success = Column(Boolean, nullable=True)
    escalation_reason = Column(Text, nullable=True)

    incident = relationship("Incident", back_populates="call_logs")
```

- [ ] **Step 5: Create the test database**

```bash
docker compose up -d db
docker compose exec db psql -U phonecall -c "CREATE DATABASE phonecall_test;"
```

- [ ] **Step 6: Run test to verify it passes**

```bash
cd backend
pytest tests/test_models.py -v
```

Expected: `PASSED`

- [ ] **Step 7: Commit**

```bash
git add backend/app/db/ backend/tests/conftest.py backend/tests/test_models.py
git commit -m "feat: add SQLAlchemy async models for all four tables"
```

---

## Task 4: Alembic migrations

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/{hash}_initial.py` (generated by Alembic)

- [ ] **Step 1: Initialize Alembic**

```bash
cd backend
alembic init alembic
```

This creates `alembic.ini` and `alembic/` with a template `env.py`.

- [ ] **Step 2: Note on `alembic.ini`**

The generated `alembic.ini` contains a `sqlalchemy.url` line. You do NOT need to edit it — `env.py` (next step) overrides it at runtime using `settings.database_url` from your `.env` file. Leave `alembic.ini` as generated.

- [ ] **Step 3: Replace `backend/alembic/env.py`**

Replace the entire file content with:

```python
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
from app.db.models import Base
from app.config import settings

config = context.config

# Override sqlalchemy.url with the value from our settings (reads from .env)
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 4: Generate initial migration**

Make sure `DATABASE_URL` in `.env` points to `localhost:5432` (the dev DB, not the test DB), then:

```bash
cd backend
alembic revision --autogenerate -m "initial"
```

This creates `alembic/versions/{hash}_initial.py`. **Do not rename or modify the `revision` or `down_revision` variables inside the file** — Alembic uses those hashes to track the migration chain. The filename can be left as-is.

- [ ] **Step 5: Run the migration against the dev database**

```bash
cd backend
alembic upgrade head
```

Expected output:
```
INFO  [alembic.runtime.migration] Running upgrade  -> {hash}, initial
```

- [ ] **Step 6: Verify tables exist**

```bash
docker compose exec db psql -U phonecall -d phonecall -c "\dt"
```

Expected: `operators`, `incidents`, `workshops`, `call_logs` all listed.

- [ ] **Step 7: Commit**

```bash
git add backend/alembic/ backend/alembic.ini
git commit -m "feat: add Alembic async migrations with all four tables"
```

---

## Task 5: JWT utilities

**Files:**
- Create: `backend/app/auth/jwt.py`
- Create: `backend/tests/test_auth.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_auth.py`:

```python
from datetime import timedelta


def test_create_and_decode_token():
    from app.auth.jwt import create_token, decode_token
    token = create_token(subject="test-id", email="test@example.com")
    payload = decode_token(token)
    assert payload["sub"] == "test-id"
    assert payload["email"] == "test@example.com"


def test_expired_token_raises():
    from app.auth.jwt import create_token, decode_token
    from jose import JWTError
    token = create_token(
        subject="test-id",
        email="test@example.com",
        expires_delta=timedelta(seconds=-1),
    )
    import pytest
    with pytest.raises(JWTError):
        decode_token(token)


def test_invalid_token_raises():
    from app.auth.jwt import decode_token
    from jose import JWTError
    import pytest
    with pytest.raises(JWTError):
        decode_token("not.a.real.token")
```

These are synchronous tests (no `async`) — no special decorator needed.

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_auth.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.auth.jwt'`

- [ ] **Step 3: Create `backend/app/auth/jwt.py`**

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_auth.py -v
```

Expected: all 3 tests `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/app/auth/jwt.py backend/tests/test_auth.py
git commit -m "feat: add JWT token creation and validation"
```

---

## Task 6: Auth router (login + protected endpoint)

**Files:**
- Create: `backend/app/auth/middleware.py`
- Create: `backend/app/auth/router.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/conftest.py` (add `client` and `seeded_operator` fixtures)
- Modify: `backend/tests/test_auth.py`

- [ ] **Step 1: Write the failing tests**

Add to `backend/tests/test_auth.py`:

```python
from httpx import AsyncClient


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
```

Add the `client` and `seeded_operator` fixtures to `backend/tests/conftest.py`:

```python
import uuid
from passlib.context import CryptContext
from app.db.models import Operator

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest_asyncio.fixture
async def client(db_session):
    """HTTP client with get_db overridden to use the test transaction session."""
    from app.main import app
    from app.db.session import get_db

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seeded_operator(db_session):
    """Creates a test operator visible within the current test transaction."""
    op = Operator(
        id=uuid.uuid4(),
        email="admin@test.com",
        hashed_password=pwd_context.hash("testpassword"),
        name="Test Admin",
        active=True,
    )
    db_session.add(op)
    await db_session.flush()  # visible within same session; rolled back after test
    return op
```

- [ ] **Step 2: Run new tests to verify they fail**

```bash
cd backend
pytest tests/test_auth.py::test_login_success -v
```

Expected: `404 Not Found` (route not yet defined)

- [ ] **Step 3: Create `backend/app/auth/middleware.py`**

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.auth.jwt import decode_token
from app.db.session import get_db
from app.db.models import Operator

security = HTTPBearer()


async def get_current_operator(
    credentials: HTTPAuthorizationCredentials = Depends(security),
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
```

- [ ] **Step 4: Create `backend/app/auth/router.py`**

```python
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
```

- [ ] **Step 5: Register the auth router in `backend/app/main.py`**

```python
from fastapi import FastAPI
from app.auth.router import router as auth_router

app = FastAPI(title="PhoneCall", version="1.0.0")

app.include_router(auth_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
```

- [ ] **Step 6: Run the full test suite**

```bash
cd backend
pytest tests/ -v
```

Expected: all tests `PASSED`. The health check uses `simple_client` (no DB) and the auth tests use `client` (with DB override) — these are independent fixtures.

- [ ] **Step 7: Commit**

```bash
git add backend/app/auth/ backend/app/main.py backend/tests/
git commit -m "feat: add JWT auth with login endpoint and protected route"
```

---

## Task 7: ARQ worker stub + operator seed

**Files:**
- Create: `backend/workers/settings.py`
- Create: `backend/seed.py`

- [ ] **Step 1: Create `backend/workers/settings.py`**

```python
from arq.connections import RedisSettings
from app.config import settings


class WorkerSettings:
    # RedisSettings.from_dsn parses a redis:// URL into the ARQ-expected format
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = []
    cron_jobs = []
    max_jobs = 10
```

- [ ] **Step 2: Create `backend/seed.py`**

This script creates the default operator from env vars. Run it once after migrations.

```python
"""
Run with: python seed.py
Creates the default operator from OPERATOR_DEFAULT_EMAIL and OPERATOR_DEFAULT_PASSWORD.
Safe to run multiple times — skips if the operator already exists.
"""
import asyncio
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.config import settings
from app.db.models import Operator

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    engine = create_async_engine(settings.database_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(
            select(Operator).where(Operator.email == settings.operator_default_email)
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f"Operator {settings.operator_default_email} already exists. Skipping.")
            return

        op = Operator(
            email=settings.operator_default_email,
            hashed_password=pwd_context.hash(settings.operator_default_password),
            name="Default Admin",
            active=True,
        )
        session.add(op)
        await session.commit()
        print(f"Created operator: {settings.operator_default_email}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 3: Write a test for operator persistence**

The `test_auth.py` file has been built incrementally across tasks. Here is the **complete final state** of the file — replace its contents entirely at this point:

```python
import uuid
import pytest
from datetime import timedelta
from httpx import AsyncClient
from passlib.context import CryptContext
from sqlalchemy import select
from app.db.models import Operator

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# --- JWT unit tests (synchronous) ---

def test_create_and_decode_token():
    from app.auth.jwt import create_token, decode_token
    token = create_token(subject="test-id", email="test@example.com")
    payload = decode_token(token)
    assert payload["sub"] == "test-id"
    assert payload["email"] == "test@example.com"


def test_expired_token_raises():
    from app.auth.jwt import create_token, decode_token
    from jose import JWTError
    token = create_token(
        subject="test-id",
        email="test@example.com",
        expires_delta=timedelta(seconds=-1),
    )
    with pytest.raises(JWTError):
        decode_token(token)


def test_invalid_token_raises():
    from app.auth.jwt import decode_token
    from jose import JWTError
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
```

- [ ] **Step 4: Run all tests to verify everything still passes**

```bash
cd backend
pytest tests/ -v
```

Expected: all tests `PASSED`

- [ ] **Step 5: Commit**

```bash
git add backend/workers/settings.py backend/seed.py backend/tests/test_auth.py
git commit -m "feat: add ARQ worker stub and operator seed script"
```

---

## Task 8: End-to-end smoke test with Docker Compose

- [ ] **Step 1: Start all services**

```bash
docker compose up -d
```

Watch the logs to confirm all containers are healthy:

```bash
docker compose ps
```

Expected: `backend`, `worker`, `db`, `redis` all in `running` state. `db` should show `healthy`.

- [ ] **Step 2: Run migrations inside the backend container**

```bash
docker compose exec backend alembic upgrade head
```

Expected:
```
INFO  [alembic.runtime.migration] Running upgrade  -> {hash}, initial
```

- [ ] **Step 3: Seed the default operator**

```bash
docker compose exec backend python seed.py
```

Expected: `Created operator: admin@phonecall.com`

- [ ] **Step 4: Verify health endpoint**

```bash
curl http://localhost:8000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 5: Verify login endpoint**

```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@phonecall.com","password":"changeme"}' | python -m json.tool
```

Expected: JSON with `access_token` and `token_type` fields.

- [ ] **Step 6: Verify protected endpoint with token**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@phonecall.com","password":"changeme"}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

curl -s http://localhost:8000/api/v1/me \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool
```

Expected: JSON with `email`, `name`, `id` fields.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: foundation complete — Docker Compose, DB, auth, tests passing"
```

---

## Full test suite summary

```bash
cd backend
pytest tests/ -v --tb=short
```

Tests covered:

| Test | What it verifies |
|---|---|
| `test_health_check` | GET /health returns 200 (no DB required) |
| `test_tables_exist` | All four tables created by SQLAlchemy models |
| `test_create_and_decode_token` | JWT round-trip |
| `test_expired_token_raises` | Expired tokens are rejected |
| `test_invalid_token_raises` | Malformed tokens are rejected |
| `test_login_success` | Valid credentials return JWT |
| `test_login_wrong_password` | Wrong password returns 401 |
| `test_login_unknown_email` | Unknown email returns 401 |
| `test_get_me_with_valid_token` | Protected route returns operator data |
| `test_get_me_without_token` | Protected route rejects missing token |
| `test_operator_password_stored_hashed` | Passwords never stored in plain text |

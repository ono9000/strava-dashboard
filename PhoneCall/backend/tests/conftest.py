import asyncio
import os
import uuid

import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from app.db.models import Operator

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://phonecall:phonecall@localhost:5432/phonecall_test"
)


@pytest_asyncio.fixture(loop_scope="session")
async def simple_client():
    """HTTP client with no DB override — use for endpoints that do not touch the database."""
    from app.main import app
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def engine():
    from app.db.models import Base
    eng = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def db_session(engine):
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        await session.begin()
        yield session
        try:
            await session.rollback()
        except (asyncio.CancelledError, OSError, AttributeError):
            pass  # Windows ProactorEventLoop teardown noise


@pytest_asyncio.fixture(loop_scope="session")
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
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture(loop_scope="session")
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

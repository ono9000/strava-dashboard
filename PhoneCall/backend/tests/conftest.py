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

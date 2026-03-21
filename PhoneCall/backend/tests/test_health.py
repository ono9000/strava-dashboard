from httpx import AsyncClient


async def test_health_check(simple_client: AsyncClient):
    response = await simple_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

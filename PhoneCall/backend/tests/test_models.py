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

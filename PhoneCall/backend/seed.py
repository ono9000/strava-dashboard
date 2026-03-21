"""
Run with: python seed.py
Creates the default operator from OPERATOR_DEFAULT_EMAIL and OPERATOR_DEFAULT_PASSWORD.
Safe to run multiple times — skips if the operator already exists.
"""
import asyncio
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from app.config import settings
from app.db.models import Operator

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    engine = create_async_engine(settings.database_url)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

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

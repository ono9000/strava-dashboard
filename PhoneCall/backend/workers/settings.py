from arq.connections import RedisSettings
from app.config import settings


async def noop(ctx):
    """Placeholder task — ARQ requires at least one function to be registered."""
    pass


class WorkerSettings:
    # RedisSettings.from_dsn parses a redis:// URL into the ARQ-expected format
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = [noop]
    cron_jobs = []
    max_jobs = 10

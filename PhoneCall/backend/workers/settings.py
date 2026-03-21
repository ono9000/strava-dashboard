from arq.connections import RedisSettings
from app.config import settings


class WorkerSettings:
    # RedisSettings.from_dsn parses a redis:// URL into the ARQ-expected format
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = []
    cron_jobs = []
    max_jobs = 10

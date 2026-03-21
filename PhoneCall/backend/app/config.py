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

    jwt_secret: str
    jwt_expire_minutes: int = 480

    operator_default_email: str = "admin@phonecall.com"
    operator_default_password: str = "changeme"

    operator_transfer_target: str = ""
    base_url: str = "http://localhost:8000"

    max_workshop_attempts: int = 3
    workshop_answer_timeout_seconds: int = 45
    stale_session_cleanup_interval_minutes: int = 15


settings = Settings()

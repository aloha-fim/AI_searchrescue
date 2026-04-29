from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+psycopg2://sar:sar@db:5432/sar"
    SECRET_KEY: str = "dev-only-change-me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    ANTHROPIC_API_KEY: str = ""
    VISION_MODEL: str = "claude-opus-4-7"

    UPLOAD_DIR: str = "/app/uploads"
    MAX_UPLOAD_MB: int = 20

    FRONTEND_ORIGIN: str = "http://localhost:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

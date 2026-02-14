from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://campus:campus_dev@localhost:5432/campus_connect"
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    verification_code_expire_minutes: int = 10
    cors_origins: list[str] = ["http://localhost:5173"]
    upload_dir: str = "backend/uploads"
    max_file_size_bytes: int = 10 * 1024 * 1024  # 10MB
    file_max_age_hours: int = 24

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

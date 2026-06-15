import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Document Analysis API"
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "watch-mail-trial")
    GCP_LOCATION: str = os.getenv("GCP_LOCATION", "us-central1")

    class Config:
        env_file = ".env"

settings = Settings()

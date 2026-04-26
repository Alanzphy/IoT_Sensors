from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- App ---
    APP_NAME: str = "Sistema IoT Riego Agrícola"
    DEBUG: bool = False
    API_V1_PREFIX: str = "/api/v1"
    FRONTEND_PUBLIC_URL: str = "http://localhost:5173"

    # --- Database ---
    DB_HOST: str = "localhost"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = ""
    DB_NAME: str = "sensores_riego"

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    # --- JWT ---
    SECRET_KEY: str = "CHANGE-ME-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30
    PASSWORD_RESET_URL_BASE: str = "http://localhost:5173/restablecer-contrasena"
    PASSWORD_RESET_REQUEST_RATE_LIMIT_WINDOW_MINUTES: int = 15
    PASSWORD_RESET_REQUEST_MAX_PER_EMAIL: int = 3
    PASSWORD_RESET_REQUEST_MAX_PER_IP: int = 20
    PASSWORD_RESET_CONFIRM_RATE_LIMIT_WINDOW_MINUTES: int = 15
    PASSWORD_RESET_CONFIRM_MAX_PER_IP: int = 10

    # --- Pagination ---
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE: int = 200

    # --- Alert Notifications (Direct Backend Delivery) ---
    NOTIFICATIONS_ENABLED: bool = False

    # Email (SMTP)
    NOTIFICATIONS_EMAIL_ENABLED: bool = False
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    NOTIFICATION_EMAIL_SUBJECT_PREFIX: str = "[Sensores IoT]"

    # WhatsApp (Cloud API)
    NOTIFICATIONS_WHATSAPP_ENABLED: bool = False
    WHATSAPP_PROVIDER: str = "meta"
    WHATSAPP_MESSAGE_MODE: str = "text"
    WHATSAPP_API_BASE_URL: str = "https://graph.facebook.com/v20.0"
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_ACCESS_TOKEN: str = ""
    WHATSAPP_HTTP_TIMEOUT_SECONDS: int = 15
    WHATSAPP_TEMPLATE_NAME: str = "alerta_riego_critica_v1"
    WHATSAPP_TEMPLATE_LANGUAGE_CODE: str = "es_MX"

    # WhatsApp (Twilio Content API)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_FROM: str = ""
    TWILIO_MESSAGING_SERVICE_SID: str = ""
    TWILIO_CONTENT_SID: str = ""
    TWILIO_STATUS_CALLBACK_URL: str = ""
    TWILIO_API_BASE_URL: str = "https://api.twilio.com"

    # --- AI Reports ---
    AI_REPORTS_ENABLED: bool = False
    AI_REPORTS_DEFAULT_NOTIFY: bool = True
    AI_REPORTS_SCHEDULER_ENABLED: bool = False
    AI_REPORTS_SCHEDULER_POLL_SECONDS: int = 60
    AI_REPORTS_SCHEDULE_HOUR_UTC: int = 2
    AI_REPORTS_SCHEDULE_MINUTE_UTC: int = 0
    AI_REPORTS_HTTP_TIMEOUT_SECONDS: int = 30
    AI_ALERT_RECOMMENDATIONS_ENABLED: bool = True
    AI_ALERT_RECOMMENDATIONS_MAX_RECENT_READINGS: int = 48

    # --- Azure OpenAI ---
    AZURE_OPENAI_ENABLED: bool = False
    AZURE_OPENAI_ENDPOINT: str = ""
    AZURE_OPENAI_API_KEY: str = ""
    AZURE_OPENAI_API_VERSION: str = "2024-10-21"
    AZURE_OPENAI_DEPLOYMENT: str = ""
    AZURE_OPENAI_TEMPERATURE: float = 0.2
    AZURE_OPENAI_MAX_TOKENS: int = 900
    AZURE_OPENAI_TIMEOUT_SECONDS: int = 30

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug(cls, value: object) -> object:
        if not isinstance(value, str):
            return value

        normalized = value.strip().lower()
        if normalized in {"release", "prod", "production", "false", "0", "no", "off"}:
            return False
        if normalized in {"debug", "dev", "development", "local", "true", "1", "yes", "on"}:
            return True
        return value

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()

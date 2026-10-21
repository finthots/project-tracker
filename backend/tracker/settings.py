import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BASE_DIR.parent
FRONTEND_DIST_DIR = PROJECT_DIR / "frontend" / "dist"
env_file = BASE_DIR / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "development-only-change-before-deployment")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = [x.strip() for x in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if x.strip()]
CSRF_TRUSTED_ORIGINS = [x.strip() for x in os.environ.get(
    "DJANGO_CSRF_TRUSTED_ORIGINS", "http://127.0.0.1:5175,http://localhost:5175"
).split(",") if x.strip()]
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "trackerapp",
]
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "trackerapp.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
ROOT_URLCONF = "tracker.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [FRONTEND_DIST_DIR],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]
DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3",
                         "NAME": os.environ.get("TRACKER_DB_PATH", str(BASE_DIR / "data" / "tracker.db"))}}
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.environ.get("DJANGO_TIME_ZONE", "Asia/Kolkata")
USE_TZ = True
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [FRONTEND_DIST_DIR]
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedStaticFilesStorage"},
}
DEFAULT_AUTO_FIELD = "django.db.models.AutoField"
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_SECURE = not DEBUG
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = os.environ.get("DJANGO_SECURE_SSL_REDIRECT", "1" if not DEBUG else "0") == "1"
SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_SECURE_HSTS_SECONDS", "31536000" if not DEBUG else "0"))
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
CORS_ALLOWED_ORIGINS = [x.strip() for x in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if x.strip()]
EMAIL_DIGEST_ENABLED = os.environ.get("EMAIL_DIGEST_ENABLED", "false").lower() == "true"
EMAIL_HOST = os.environ.get("SMTP_HOST", "")
EMAIL_PORT = int(os.environ.get("SMTP_PORT", "587"))
EMAIL_HOST_USER = os.environ.get("SMTP_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
EMAIL_USE_TLS = True
DEFAULT_FROM_EMAIL = os.environ.get("SMTP_FROM", EMAIL_HOST_USER)

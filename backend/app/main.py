from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
try:
    from mangum import Mangum
except ImportError:
    Mangum = None
from app.core.config import settings
from app.api import (
    auth,
    ai_providers,
    datasets,
    analytics,
    conversations,
    dashboards,
    public_dashboards,
    data_sources,
    integrations_google,
    cloud_storage
)

# Initialize database schema on startup if running local SQLite
if not settings.USE_DYNAMODB:
    try:
        from app.core.database import engine, Base
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Production-quality AI-powered business analytics platform with BYOK architecture.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Configure CORS
cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://autoanalytix.vercel.app",
    "https://www.autoanalytix.vercel.app",
]
if hasattr(settings, "CORS_ORIGINS") and settings.CORS_ORIGINS:
    for origin in settings.CORS_ORIGINS:
        if origin and origin not in cors_origins:
            cors_origins.append(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router, prefix=settings.API_V1_PREFIX)
app.include_router(ai_providers.router, prefix=settings.API_V1_PREFIX)
app.include_router(datasets.router, prefix=settings.API_V1_PREFIX)
app.include_router(analytics.router, prefix=settings.API_V1_PREFIX)
app.include_router(conversations.router, prefix=settings.API_V1_PREFIX)
app.include_router(dashboards.router, prefix=settings.API_V1_PREFIX)
app.include_router(public_dashboards.router, prefix=settings.API_V1_PREFIX)
app.include_router(data_sources.router, prefix=settings.API_V1_PREFIX)
app.include_router(integrations_google.router, prefix=settings.API_V1_PREFIX)
app.include_router(cloud_storage.router, prefix=settings.API_V1_PREFIX)

@app.get("/health")
@app.get("/api/health")
def healthcheck():
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "environment": settings.APP_ENV
    }

@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API. Visit /api/docs for interactive OpenAPI specification."
    }

# Expose handler for AWS Lambda
handler = Mangum(app, lifespan="off") if Mangum else None

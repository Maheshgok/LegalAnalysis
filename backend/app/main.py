from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routers import extraction, analysis
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

# Setup CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Update for production
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(extraction.router, prefix="/api/extraction", tags=["Extraction"])
app.include_router(analysis.router, prefix="/api/analysis", tags=["Analysis"])

@app.get("/")
def read_root():
    return {"message": f"Welcome to the {settings.PROJECT_NAME}"}

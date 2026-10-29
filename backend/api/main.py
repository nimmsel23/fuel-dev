import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from backend.api.endpoints import food, supplements, journal, nutrition_query, frames, fasting, v3_proxy
from backend.db.database import SessionLocal
from backend.core.v3_backfill import backfill_from_v3_if_needed
from backend.migrate import migrate

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI):
    migrate()
    db = SessionLocal()
    try:
        result = backfill_from_v3_if_needed(db)
        if any(result.values()):
            logger.info(
                "v4 backfill dates=%s created=%s updated=%s",
                result["dates_seen"], result["rows_created"], result["rows_updated"],
            )
    finally:
        db.close()
    yield


app = FastAPI(
    title="Fuel Tracker API",
    description="NLP-powered macro and supplement tracker",
    lifespan=lifespan,
)

app.include_router(food.router, prefix="/nutrition", tags=["Food"])
app.include_router(supplements.router, prefix="/supplements", tags=["Supplements"])
app.include_router(journal.router, prefix="/journal", tags=["Journal"])
app.include_router(nutrition_query.router, prefix="/nutrition", tags=["Nutrition Query"])
app.include_router(frames.router, prefix="/nutrition", tags=["Frames"])
app.include_router(fasting.router, prefix="/nutrition", tags=["Fasting"])
app.include_router(v3_proxy.router, prefix="/v3", tags=["v3 Proxy"])  # v4 -> v3 Rückweg für Legacy-/Übergangsrouten

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Serve Frontend built assets
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist")

# Serve assets/ directly
@app.get("/assets/{file_path:path}")
def serve_assets(file_path: str):
    asset_file = os.path.join(FRONTEND_DIR, "assets", file_path)
    if os.path.exists(asset_file):
        return FileResponse(asset_file)
    raise HTTPException(status_code=404, detail="Asset not found")

# SPA catch-all route
@app.get("/{catchall:path}")
def serve_spa(catchall: str):
    # Check if the file exists in FRONTEND_DIR (e.g. favicon.ico, manifest.json)
    file_path = os.path.join(FRONTEND_DIR, catchall)
    if catchall and os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)
    
    # Fallback to index.html for SPA routing
    index_file = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"error": "Frontend build not found"}

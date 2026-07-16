#!/usr/bin/env python3
import asyncio
import json
import os
import yaml
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys

# Import fuel's Gemini logic
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))
from fuel.gemini import estimate_vision

NUTRITION_MEALS_DIR = BASE_DIR / "catalogs" / "nutrition" / "meals"
SUPPLEMENTS_CATALOG_PATH_YAML = BASE_DIR / "catalogs" / "supplements" / "catalog.yaml"
SUPPLEMENTS_CATALOG_PATH_JSON = BASE_DIR / "catalogs" / "supplements" / "catalog.json"

app = FastAPI(title="Fuel Catalog & AI Server")

# Allow CORS for local dev frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/catalogs/nutrition")
async def list_nutrition_meals():
    """List all nutrition meals."""
    meals = [f.stem for f in NUTRITION_MEALS_DIR.glob("*") if f.suffix in [".json", ".yaml", ".yml"]]
    return {"meals": sorted(list(set(meals)))}

@app.get("/catalogs/nutrition/{meal_id}")
async def get_nutrition_meal(meal_id: str):
    """Get a specific meal."""
    for ext in [".yaml", ".yml", ".json"]:
        file_path = NUTRITION_MEALS_DIR / f"{meal_id}{ext}"
        if file_path.exists():
            with open(file_path, 'r') as f:
                if ext == ".json":
                    return json.load(f)
                else:
                    return yaml.safe_load(f)
    raise HTTPException(status_code=404, detail=f"Meal {meal_id} not found")

@app.get("/catalogs/supplements")
async def get_supplements_catalog():
    """Get the supplements catalog."""
    if SUPPLEMENTS_CATALOG_PATH_YAML.exists():
        with open(SUPPLEMENTS_CATALOG_PATH_YAML, 'r') as f:
            return yaml.safe_load(f)
    if SUPPLEMENTS_CATALOG_PATH_JSON.exists():
        with open(SUPPLEMENTS_CATALOG_PATH_JSON, 'r') as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Supplements catalog not found")

class VisionRequest(BaseModel):
    image_b64: str
    mime_type: str = "image/jpeg"

@app.post("/nutrition/vision")
async def analyze_food_vision(req: VisionRequest):
    """Analyze a food photo, receipt, or barcode via Gemini Multimodal."""
    # Ensure it doesn't include the data URL prefix if sent from JS
    b64_data = req.image_b64
    if "," in b64_data:
        b64_data = b64_data.split(",")[1]
    
    result = estimate_vision(b64_data, mime_type=req.mime_type)
    if result.get("_error"):
        raise HTTPException(status_code=500, detail=result["_error"])
        
    return result

if __name__ == "__main__":
    import uvicorn
    # Start the server on port 9050 (matching the old aiohttp server port)
    uvicorn.run(app, host="127.0.0.1", port=9050)

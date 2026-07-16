#!/usr/bin/env python3
import asyncio
import json
import os
import yaml
from pathlib import Path
from aiohttp import web

# Resolve paths
BASE_DIR = Path(__file__).resolve().parent
NUTRITION_MEALS_DIR = BASE_DIR / "catalogs" / "nutrition" / "meals"
SUPPLEMENTS_CATALOG_PATH_YAML = BASE_DIR / "catalogs" / "supplements" / "catalog.yaml"
SUPPLEMENTS_CATALOG_PATH_JSON = BASE_DIR / "catalogs" / "supplements" / "catalog.json"

async def get_nutrition_meals(request):
    """List all nutrition meals or get a specific one."""
    meal_id = request.match_info.get('meal_id')
    
    if meal_id:
        # Try YAML first
        for ext in [".yaml", ".yml", ".json"]:
            file_path = NUTRITION_MEALS_DIR / f"{meal_id}{ext}"
            if file_path.exists():
                with open(file_path, 'r') as f:
                    if ext == ".json":
                        return web.json_response(json.load(f))
                    else:
                        return web.json_response(yaml.safe_load(f))
        return web.HTTPNotFound(text=f"Meal {meal_id} not found")
    
    # List all meals (support .json, .yaml, .yml)
    meals = [f.stem for f in NUTRITION_MEALS_DIR.glob("*") if f.suffix in [".json", ".yaml", ".yml"]]
    # Unique meals by stem
    meals = sorted(list(set(meals)))
    return web.json_response({"meals": meals})

async def get_supplements_catalog(request):
    """Get the supplements catalog."""
    if SUPPLEMENTS_CATALOG_PATH_YAML.exists():
        with open(SUPPLEMENTS_CATALOG_PATH_YAML, 'r') as f:
            return web.json_response(yaml.safe_load(f))
    if SUPPLEMENTS_CATALOG_PATH_JSON.exists():
        with open(SUPPLEMENTS_CATALOG_PATH_JSON, 'r') as f:
            return web.json_response(json.load(f))
    return web.HTTPNotFound(text="Supplements catalog not found")

from loguru import logger

async def cors_middleware(app, handler):
    async def middleware_handler(request):
        if request.method == "OPTIONS":
            response = web.Response()
        else:
            try:
                response = await handler(request)
            except web.HTTPException as ex:
                response = ex
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, DELETE, PUT, PATCH'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
        if isinstance(response, web.HTTPException):
            raise response
        return response
    return middleware_handler

async def logging_middleware(app, handler):
    async def middleware_handler(request):
        if request.method != "OPTIONS":
            logger.info(f"{request.method} {request.path}")
        response = await handler(request)
        if request.method != "OPTIONS":
            logger.info(f"-> {response.status}")
        return response
    return middleware_handler

async def init_app():
    app = web.Application(middlewares=[cors_middleware, logging_middleware])
    # Handle OPTIONS on all routes for CORS preflight
    app.router.add_options('/{tail:.*}', lambda r: web.Response())
    
    app.router.add_get('/catalogs/nutrition', get_nutrition_meals)
    app.router.add_get('/catalogs/nutrition/{meal_id}', get_nutrition_meals)
    app.router.add_get('/catalogs/supplements', get_supplements_catalog)
    return app

if __name__ == '__main__':
    logger.info("Starting fuel-catalog-server on port 9050...")
    app = asyncio.run(init_app())
    web.run_app(app, port=9050, print=lambda *args, **kwargs: None)

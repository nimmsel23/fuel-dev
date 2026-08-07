"""v4 (dieses FastAPI-Backend) -> v3 (Node-Server).

Reine Erreichbarkeits-Route fuer die Migration (Strangler-Fig) -- kein
gemeinsamer Datenlayer, v4 behaelt seine eigene Postgres-Anbindung fuer
alles was hier schon implementiert ist. v3 hat (anders als v4) eine
Cloud-Instanz auf Firebase -- Ziel ist per Env umschaltbar.
"""
import os
import httpx
from fastapi import APIRouter, Request, Response

router = APIRouter()

V3_TARGET = os.getenv("FUEL_V3_URL", "http://127.0.0.1:9000")


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
async def proxy_to_v3(path: str, request: Request):
    target_url = f"{V3_TARGET}/{path}"
    body = await request.body()

    async with httpx.AsyncClient() as client:
        try:
            upstream = await client.request(
                request.method,
                target_url,
                params=request.query_params,
                content=body,
                headers={"content-type": request.headers.get("content-type", "application/json")},
                timeout=15.0,
            )
        except httpx.RequestError as exc:
            return Response(
                content=f'{{"error": "v3 server nicht erreichbar", "detail": "{exc}"}}',
                status_code=502,
                media_type="application/json",
            )

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        media_type=upstream.headers.get("content-type"),
    )

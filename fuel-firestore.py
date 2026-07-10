#!/usr/bin/env python3
"""
fuel-firestore.py — Bidirektionaler Sync: fuel-dev (lokal) ↔ Firebase Firestore
MULTI-USER AWARE: Verwendet UID aus Header und speichert in ~/.aos/fuel/users/<uid>/
"""

from __future__ import annotations

import os
import sys
from datetime import date
from pathlib import Path
from typing import Any

from aiohttp import web
from loguru import logger

# Insert repo directory to sys.path to resolve imports cleanly
FUEL_REPO_DIR = Path(__file__).resolve().parent
if str(FUEL_REPO_DIR) not in sys.path:
    sys.path.insert(0, str(FUEL_REPO_DIR))

from fuel.firestore import (
    get_fs,
    data_dir_for,
    DEFAULT_UID,
    SA_PATH,
    FUEL_DATA_DIR,
    sync_nutrition,
    sync_supplements,
    sync_journal,
    sync_supplements_catalog,
    sync_nutrition_catalog,
    cli_push,
    cli_pull,
    _discover_uids,
    collect_dates
)

PREFIX = "/api/fuel-firestore"


def get_user_context(request: web.Request) -> tuple[str, Path]:
    """Extrahiert UID aus Header und bestimmt lokales Datenverzeichnis."""
    uid = request.headers.get("X-Fuel-UID", DEFAULT_UID)
    return uid, data_dir_for(uid)


def do_daily_sync(d: str, direction: str, uid: str, data_dir: Path) -> dict:
    results: dict[str, Any] = {}
    for name, fn in [
        ("nutrition", sync_nutrition),
        ("supplements", sync_supplements),
        ("journal", sync_journal),
    ]:
        try:
            results[name] = fn(d, direction, uid, data_dir)
        except Exception as e:
            logger.error(f"fuel-firestore: {name} sync fehlgeschlagen ({d}, {uid}): {e}")
            results[name] = {"error": str(e)}
    return results


def do_catalog_sync(direction: str, uid: str, data_dir: Path) -> dict:
    results: dict[str, Any] = {}
    for name, fn in [
        ("supplements_catalog", sync_supplements_catalog),
        ("nutrition_catalog", sync_nutrition_catalog),
    ]:
        try:
            results[name] = fn(direction, uid, data_dir)
        except Exception as e:
            logger.error(f"fuel-firestore: {name} sync fehlgeschlagen ({uid}): {e}")
            results[name] = {"error": str(e)}
    return results


# ── HTTP Handler ──────────────────────────────────────────────────────────────

def _get_date(request: web.Request) -> str:
    raw = request.rel_url.query.get("date", "").strip()
    if raw:
        try:
            date.fromisoformat(raw)
            return raw
        except ValueError:
            pass
    return date.today().isoformat()


async def handle_status(request: web.Request) -> web.Response:
    try:
        get_fs()
        uid, data_dir = get_user_context(request)
        return web.json_response({
            "ok": True,
            "firestore": "connected",
            "sa": str(SA_PATH),
            "uid": uid,
            "data_dir": str(data_dir),
        })
    except Exception as e:
        return web.json_response({"ok": False, "firestore": "disconnected", "error": str(e)}, status=503)


async def handle_ping(request: web.Request) -> web.Response:
    d = date.today().isoformat()
    uid, data_dir = get_user_context(request)
    logger.info(f"fuel-firestore: ping → bisync {d} (uid={uid})")
    try:
        daily_results = do_daily_sync(d, "bisync", uid, data_dir)
        catalog_results = do_catalog_sync("bisync", uid, data_dir)
        return web.json_response({"ok": True, "date": d, "uid": uid, "direction": "bisync", **daily_results, **catalog_results})
    except Exception as e:
        logger.error(f"fuel-firestore ping error: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_sync(request: web.Request) -> web.Response:
    d = _get_date(request)
    uid, data_dir = get_user_context(request)
    logger.info(f"fuel-firestore: bisync {d} (uid={uid})")
    try:
        daily_results = do_daily_sync(d, "bisync", uid, data_dir)
        catalog_results = do_catalog_sync("bisync", uid, data_dir)
        return web.json_response({"ok": True, "date": d, "uid": uid, "direction": "bisync", **daily_results, **catalog_results})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_push(request: web.Request) -> web.Response:
    d = _get_date(request)
    uid, data_dir = get_user_context(request)
    logger.info(f"fuel-firestore: push {d} → Firestore (uid={uid})")
    try:
        daily_results = do_daily_sync(d, "push", uid, data_dir)
        catalog_results = do_catalog_sync("push", uid, data_dir)
        return web.json_response({"ok": True, "date": d, "uid": uid, "direction": "push", **daily_results, **catalog_results})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_pull(request: web.Request) -> web.Response:
    d = _get_date(request)
    uid, data_dir = get_user_context(request)
    logger.info(f"fuel-firestore: pull {d} ← Firestore (uid={uid})")
    try:
        daily_results = do_daily_sync(d, "pull", uid, data_dir)
        catalog_results = do_catalog_sync("pull", uid, data_dir)
        return web.json_response({"ok": True, "date": d, "uid": uid, "direction": "pull", **daily_results, **catalog_results})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


# ── Bridge-Handler ────────────────────────────────────────────────────────────

def register_routes(app: web.Application) -> None:
    app.router.add_get(f"{PREFIX}/status", handle_status)
    app.router.add_post(f"{PREFIX}/ping", handle_ping)
    app.router.add_post(f"{PREFIX}/sync", handle_sync)
    app.router.add_post(f"{PREFIX}/push", handle_push)
    app.router.add_post(f"{PREFIX}/pull", handle_pull)
    logger.info(f"fuel-firestore: routes registered auf {PREFIX}/*")


# ── CLI (typer) ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import typer

    cli = typer.Typer(add_completion=False)

    @cli.command("push")
    def cmd_push(uid: str = typer.Option(None, "--uid", help="UID; ohne → alle in ~/.aos/fuel/users/")):
        """Push aller lokalen UIDs → Firestore (batched + idempotent)."""
        cli_push(uid)

    @cli.command("pull")
    def cmd_pull(uid: str = typer.Option(None, "--uid", help="UID; ohne → alle lokal vorhandenen")):
        """Pull: Firestore → lokale Fuel-Daten."""
        cli_pull(uid)

    @cli.command("discover")
    def cmd_discover():
        """Listet alle lokal vorhandenen UIDs auf."""
        uids = _discover_uids()
        if not uids:
            logger.warning(f"Keine UIDs unter {FUEL_DATA_DIR / 'users'}")
            return
        for u in uids:
            dd = data_dir_for(u)
            dates = collect_dates(dd)
            logger.info(f"  {u}  ({len(dates)} Tage, {dd})")

    @cli.command("status")
    def cmd_status():
        """Firestore-Verbindung prüfen."""
        try:
            get_fs()
            logger.success(f"Firestore verbunden — SA: {SA_PATH}")
        except Exception as e:
            logger.error(f"Verbindung fehlgeschlagen: {e}")
            raise typer.Exit(1)

    @cli.command("serve")
    def cmd_serve(
        host: str = typer.Option(os.getenv("FUEL_FIRESTORE_HOST", "127.0.0.1"), "--host"),
        port: int = typer.Option(int(os.getenv("FUEL_FIRESTORE_PORT", "9011")), "--port"),
    ):
        """Als HTTP-Server starten (:9011)."""
        app = web.Application()
        register_routes(app)
        logger.info(f"fuel-firestore standalone: http://{host}:{port}{PREFIX}/")
        web.run_app(app, host=host, port=port, print=None)

    cli()

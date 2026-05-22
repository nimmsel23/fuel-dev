#!/usr/bin/env python3
"""
fuel-firestore.py — Bidirektionaler Sync: fuel-dev (lokal) ↔ Firebase Firestore

Use Case: Laptop offline → fuel-dev läuft als lokaler API-Server.
Wenn Laptop wieder online: Sync mit Firestore, damit Mobile-PWA aktuell bleibt.

Firestore-Struktur (pwa/src/db.js):
  nutrition/default/logs/{date}    → {date, meals:[], water_ml:0}
  nutrition/default/journal/{date} → {date, content:""}
  supplements/default/logs/{date}  → {date, intakes:[]}

Lokal (AOS_FUEL_DATA_DIR, default ~/.aos/fuel/):
  nutrition/YYYY-MM-DD.json        → {date, meals:[...]}
  nutrition_journal/YYYY-MM-DD.md  → markdown text
  supplements/logs/YYYY-MM-DD.json → {date, intakes:[...]}

Endpoints:
  GET  /api/fuel-firestore/status          Verbindungsstatus
  POST /api/fuel-firestore/ping            Sync heute (Event-Trigger aus fuel-dev)
  POST /api/fuel-firestore/sync?date=      Bisync ein Datum
  POST /api/fuel-firestore/push?date=      Lokal → Firestore
  POST /api/fuel-firestore/pull?date=      Firestore → Lokal

Bridge-Handler: register_routes(app) aufrufen.
Standalone:     python fuel-firestore.py [--port 9011] [--host 127.0.0.1]

Service Account: ~/.config/fuel-pwa/service-account.json
                 (oder env FUEL_FIRESTORE_SA)
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any

from aiohttp import web
from loguru import logger

# ── Config ────────────────────────────────────────────────────────────────────

FUEL_DATA_DIR = Path(
    os.getenv("AOS_FUEL_DATA_DIR", str(Path.home() / ".aos" / "fuel"))
).expanduser()

SA_PATH = Path(
    os.getenv("FUEL_FIRESTORE_SA", str(Path.home() / ".config" / "fuel-pwa" / "service-account.json"))
).expanduser()

UID = "default"
PREFIX = "/api/fuel-firestore"

# ── Firestore (lazy init) ─────────────────────────────────────────────────────

_fs = None


def _get_fs():
    global _fs
    if _fs is not None:
        return _fs
    if not SA_PATH.exists():
        raise FileNotFoundError(
            f"Service Account nicht gefunden: {SA_PATH}\n"
            "Firebase Console → Projekteinstellungen → Service Accounts → Schlüssel generieren"
        )
    import firebase_admin
    from firebase_admin import credentials, firestore as fb_firestore

    if not firebase_admin._apps:
        cred = credentials.Certificate(str(SA_PATH))
        firebase_admin.initialize_app(cred)
    _fs = fb_firestore.client()
    logger.info("fuel-firestore: Firestore verbunden")
    return _fs


# ── Lokale Pfade ──────────────────────────────────────────────────────────────

def _nutrition_path(d: str) -> Path:
    return FUEL_DATA_DIR / "nutrition" / f"{d}.json"


def _journal_path(d: str) -> Path:
    return FUEL_DATA_DIR / "nutrition_journal" / f"{d}.md"


def _supplements_path(d: str) -> Path:
    return FUEL_DATA_DIR / "supplements" / "logs" / f"{d}.json"


# ── Datei-Helfer ──────────────────────────────────────────────────────────────

def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text())
    except Exception as e:
        logger.warning(f"Lesen fehlgeschlagen {path}: {e}")
        return default


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))


def _strip_firestore_fields(obj: dict) -> dict:
    """Entfernt Firestore-interne Felder (updated_at, Timestamps)."""
    return {k: v for k, v in obj.items() if k not in ("updated_at", "_firestore_updated")}


# ── Merge ─────────────────────────────────────────────────────────────────────

def _merge_by_id(a: list[dict], b: list[dict]) -> list[dict]:
    """Union zweier Listen by 'id'. Neuestes 'time'-Feld gewinnt bei Konflikt."""
    by_id: dict[str, dict] = {}
    for item in a + b:
        iid = item.get("id")
        if not iid:
            continue
        existing = by_id.get(iid)
        if existing is None or item.get("time", "") > existing.get("time", ""):
            by_id[iid] = _strip_firestore_fields(item)
    return sorted(by_id.values(), key=lambda x: x.get("time", ""))


# ── Sync: Nutrition ───────────────────────────────────────────────────────────

def _sync_nutrition(d: str, direction: str) -> dict:
    fs = _get_fs()
    local_path = _nutrition_path(d)
    local = _read_json(local_path, {"date": d, "meals": [], "water_ml": 0})

    doc_ref = fs.collection("nutrition").document(UID).collection("logs").document(d)
    snap = doc_ref.get()
    remote = snap.to_dict() if snap.exists else {"date": d, "meals": [], "water_ml": 0}

    remote_meals = [_strip_firestore_fields(m) for m in (remote.get("meals") or [])]
    local_meals = local.get("meals") or []

    if direction == "push":
        merged_meals = _merge_by_id(local_meals, remote_meals)
    elif direction == "pull":
        merged_meals = remote_meals
    else:
        merged_meals = _merge_by_id(local_meals, remote_meals)

    # water_ml: Firestore gewinnt wenn vorhanden, sonst lokal
    water_ml = remote.get("water_ml") or local.get("water_ml", 0)

    result = {"date": d, "meals": merged_meals, "water_ml": water_ml}
    _write_json(local_path, result)
    doc_ref.set({"date": d, "meals": merged_meals, "water_ml": water_ml}, merge=True)

    return {"meals": len(merged_meals), "water_ml": water_ml}


# ── Sync: Supplements ─────────────────────────────────────────────────────────

def _sync_supplements(d: str, direction: str) -> dict:
    fs = _get_fs()
    local_path = _supplements_path(d)
    local = _read_json(local_path, {"date": d, "intakes": []})

    doc_ref = fs.collection("supplements").document(UID).collection("logs").document(d)
    snap = doc_ref.get()
    remote = snap.to_dict() if snap.exists else {"date": d, "intakes": []}

    remote_intakes = [_strip_firestore_fields(i) for i in (remote.get("intakes") or [])]
    local_intakes = local.get("intakes") or []

    if direction == "push":
        merged = _merge_by_id(local_intakes, remote_intakes)
    elif direction == "pull":
        merged = remote_intakes
    else:
        merged = _merge_by_id(local_intakes, remote_intakes)

    _write_json(local_path, {"date": d, "intakes": merged})
    doc_ref.set({"date": d, "intakes": merged}, merge=True)

    return {"intakes": len(merged)}


# ── Sync: Journal ─────────────────────────────────────────────────────────────

def _sync_journal(d: str, direction: str) -> dict:
    fs = _get_fs()
    local_path = _journal_path(d)
    local_content = local_path.read_text() if local_path.exists() else ""
    local_mtime = local_path.stat().st_mtime if local_path.exists() else 0.0

    doc_ref = fs.collection("nutrition").document(UID).collection("journal").document(d)
    snap = doc_ref.get()
    remote_content = snap.to_dict().get("content", "") if snap.exists else ""

    if direction == "push":
        result_content = local_content
    elif direction == "pull":
        result_content = remote_content
    else:
        # Bisync: neueres Timestamp gewinnt (remote updated_at vs lokale mtime)
        remote_ts = 0.0
        if snap.exists:
            updated_at = snap.to_dict().get("updated_at")
            if updated_at and hasattr(updated_at, "timestamp"):
                remote_ts = updated_at.timestamp()
        result_content = remote_content if remote_ts > local_mtime else local_content

    if result_content:
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_text(result_content)
        doc_ref.set({"date": d, "content": result_content}, merge=True)

    return {"journal_chars": len(result_content)}


# ── Core sync ─────────────────────────────────────────────────────────────────

def do_sync(d: str, direction: str) -> dict:
    results: dict[str, Any] = {}
    for name, fn in [
        ("nutrition", _sync_nutrition),
        ("supplements", _sync_supplements),
        ("journal", _sync_journal),
    ]:
        try:
            results[name] = fn(d, direction)
        except Exception as e:
            logger.error(f"fuel-firestore: {name} sync fehlgeschlagen ({d}): {e}")
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
        _get_fs()
        return web.json_response({
            "ok": True,
            "firestore": "connected",
            "sa": str(SA_PATH),
            "data_dir": str(FUEL_DATA_DIR),
        })
    except Exception as e:
        return web.json_response({"ok": False, "firestore": "disconnected", "error": str(e)}, status=503)


async def handle_ping(request: web.Request) -> web.Response:
    """Event-Trigger aus fuel-dev: sync heute nach jedem Write."""
    d = date.today().isoformat()
    logger.info(f"fuel-firestore: ping → bisync {d}")
    try:
        results = do_sync(d, "bisync")
        return web.json_response({"ok": True, "date": d, "direction": "bisync", **results})
    except Exception as e:
        logger.error(f"fuel-firestore ping error: {e}")
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_sync(request: web.Request) -> web.Response:
    d = _get_date(request)
    logger.info(f"fuel-firestore: bisync {d}")
    try:
        results = do_sync(d, "bisync")
        return web.json_response({"ok": True, "date": d, "direction": "bisync", **results})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_push(request: web.Request) -> web.Response:
    d = _get_date(request)
    logger.info(f"fuel-firestore: push {d} → Firestore")
    try:
        results = do_sync(d, "push")
        return web.json_response({"ok": True, "date": d, "direction": "push", **results})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


async def handle_pull(request: web.Request) -> web.Response:
    d = _get_date(request)
    logger.info(f"fuel-firestore: pull {d} ← Firestore")
    try:
        results = do_sync(d, "pull")
        return web.json_response({"ok": True, "date": d, "direction": "pull", **results})
    except Exception as e:
        return web.json_response({"ok": False, "error": str(e)}, status=500)


# ── Bridge-Handler ────────────────────────────────────────────────────────────

def register_routes(app: web.Application) -> None:
    """Bridge-Integration: in bridge.py importieren und register_routes(app) aufrufen."""
    app.router.add_get(f"{PREFIX}/status", handle_status)
    app.router.add_post(f"{PREFIX}/ping", handle_ping)
    app.router.add_post(f"{PREFIX}/sync", handle_sync)
    app.router.add_post(f"{PREFIX}/push", handle_push)
    app.router.add_post(f"{PREFIX}/pull", handle_pull)
    logger.info(f"fuel-firestore: routes registered auf {PREFIX}/*")


# ── Standalone ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="fuel-firestore sync server (standalone)")
    parser.add_argument("--host", default=os.getenv("FUEL_FIRESTORE_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("FUEL_FIRESTORE_PORT", "9011")))
    args = parser.parse_args()

    app = web.Application()
    register_routes(app)

    logger.info(f"fuel-firestore standalone: http://{args.host}:{args.port}{PREFIX}/")
    web.run_app(app, host=args.host, port=args.port, print=None)

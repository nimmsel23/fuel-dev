"""Phase 3: Nutrition-Abfrage-Fläche.

Portiert aus fuel-dev (Node/Fastify):
- weekly.mjs   -> GET /nutrition/weekly/{year}/{week}
- log.mjs      -> GET /nutrition/history
- daily.mjs    -> GET /nutrition/search, GET /nutrition/daily/{date}
- estimate.mjs -> POST /nutrition/estimate
- compose.mjs  -> POST /nutrition/compose

Datenmodell-Unterschied zum Node-Original: Python nutzt "Journal-First"
(DailyJournal.food_logs / .micros_sum) statt Datei-pro-Tag-JSON + separatem
SQLite-Meal-Micros-Cache. Micros werden bereits beim Logging (Gemini) auf
Dokumentebene in micros_sum aggregiert (siehe food.py::log_food) — weekly/daily
lesen hier direkt micros_sum statt pro-Meal-Auflösung wie im Node-Original.
"""

from datetime import date as date_cls, datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.core.dach import DACH, MICRO_KEYS, get_status
from backend.core.catalog import find_meal, resolve_catalog_item
from backend.core.llm import extract_macros_from_text
from backend.db.database import get_db
from backend.db.models.catalog import MealCatalogItem
from backend.db.models.journal import DailyJournal

router = APIRouter()


# ============ 3a: Weekly Micros vs. DACH ============

def _iso_week_dates(year: int, week: int) -> list[str]:
    """Liefert die 7 Datums-Strings (Mo-So) für eine ISO-Kalenderwoche."""
    # date.fromisocalendar ist der direkte Python-Äquivalent zu getWeekDates() in weekly.mjs
    monday = date_cls.fromisocalendar(year, week, 1)
    return [(monday + timedelta(days=i)).isoformat() for i in range(7)]


@router.get("/weekly/{year}/{week}")
def get_weekly_micros(year: int, week: int, db: Session = Depends(get_db)):
    """GET /nutrition/weekly/{year}/{week}

    Wochen-Mikros vs. DACH-Referenz. Response-Form analog zum Node-Original
    (ok, year, week, dates, week_totals, rda_comparison, day_breakdown).
    """
    if week < 1 or week > 53:
        raise HTTPException(status_code=400, detail="Invalid year or week")

    try:
        dates = _iso_week_dates(year, week)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid year or week")

    week_totals = {k: 0.0 for k in MICRO_KEYS}
    day_breakdown = {}

    for d in dates:
        journal = db.query(DailyJournal).filter(DailyJournal.date == d).first()
        day_totals = {k: 0.0 for k in MICRO_KEYS}
        if journal and journal.micros_sum:
            for k in MICRO_KEYS:
                if k in journal.micros_sum:
                    day_totals[k] = round(journal.micros_sum[k], 1)

        day_breakdown[d] = day_totals
        for k in MICRO_KEYS:
            week_totals[k] = round(week_totals[k] + day_totals[k], 1)

    status = {}
    for key, dach in DACH.items():
        avg = week_totals[key] / 7
        status[key] = {
            "dach": dach["value"],
            "unit": dach["unit"],
            "total_week": round(week_totals[key], 1),
            "avg_daily": round(avg, 1),
            "percent_of_dach": round((avg / dach["value"]) * 100) if dach["value"] else 0,
            "status": get_status(avg, dach["value"]),
        }

    return {
        "ok": True,
        "year": year,
        "week": week,
        "dates": dates,
        "week_totals": week_totals,
        "rda_comparison": status,
        "day_breakdown": day_breakdown,
    }


# ============ 3b: History ============

@router.get("/history")
def get_history(limit: int = Query(30, ge=1, le=365), db: Session = Depends(get_db)):
    """GET /nutrition/history?limit=30

    Letzte N Tage mit Meals, neueste zuerst. Nur Tage mit tatsächlichen
    food_logs werden zurückgegeben (analog zum Node-Original-Filter).
    """
    journals = (
        db.query(DailyJournal)
        .filter(DailyJournal.food_logs != [])
        .order_by(DailyJournal.date.desc())
        .limit(limit)
        .all()
    )

    history = [
        {
            "date": j.date,
            "meals": j.food_logs,
            "water_ml": j.water_ml,
        }
        for j in journals
        if j.food_logs
    ]

    return {"ok": True, "history": history}


# ============ 3c: Search (Catalog Fuzzy + Open Food Facts Proxy) ============

OFF_API_URL = "https://world.openfoodfacts.org/cgi/search.pl"


def _search_off(query: str, limit: int) -> list[dict]:
    """Open Food Facts Proxy — analog zu searchOFF() in nutrition-search.mjs."""
    try:
        resp = httpx.get(
            OFF_API_URL,
            params={
                "search_terms": query,
                "search_simple": 1,
                "action": "process",
                "json": 1,
                "page_size": limit,
            },
            headers={"User-Agent": "fuel-python/1.0"},
            timeout=8.0,
        )
        data = resp.json()
        results = []
        for p in data.get("products", []):
            nutriments = p.get("nutriments", {})
            if not p.get("product_name") or nutriments.get("energy-kcal_100g") is None:
                continue
            results.append({
                "name": p["product_name"],
                "brand": p.get("brands", ""),
                "kcal": round(nutriments.get("energy-kcal_100g", 0) * 10) / 10,
                "kh": round(nutriments.get("carbohydrates_100g", 0) * 10) / 10,
                "fett": round(nutriments.get("fat_100g", 0) * 10) / 10,
                "ew": round(nutriments.get("proteins_100g", 0) * 10) / 10,
                "_src": "off",
            })
        return results
    except Exception:
        return []


def _search_catalog(query: str, limit: int, db: Session) -> list[dict]:
    """Catalog-Fuzzy-Suche über find_meal() hinausgehend: alle Treffer statt nur best-match."""
    from backend.core.catalog import _normalize_singular, _score_match

    items = db.query(MealCatalogItem).all()
    if not items:
        return []
    q_norm = _normalize_singular(query)
    scored = [(_score_match(q_norm, it), it) for it in items]
    scored = [(s, it) for s, it in scored if s >= 20.0]
    scored.sort(key=lambda x: x[0], reverse=True)

    results = []
    for _, item in scored[:limit]:
        results.append({
            "name": item.name,
            "brand": "",
            "kcal": item.kcal or 0,
            "kh": item.carbs or 0,
            "fett": item.fat or 0,
            "ew": item.protein or 0,
            "catalog_id": item.id,
            "_src": "catalog",
        })
    return results


@router.get("/search")
def search_nutrition(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=50), db: Session = Depends(get_db)):
    """GET /nutrition/search?q=&limit=

    Kombiniert Catalog-Fuzzy-Suche (eigene Stammdaten, bevorzugt) mit
    Open-Food-Facts-Proxy (externe Datenbank), analog zum Node-Original
    (dort: wger + OFF; Python-Refactor hat keine wger-Anbindung — Catalog
    übernimmt hier die Rolle der bevorzugten, schnellen Quelle).
    """
    catalog_results = _search_catalog(q, limit, db)
    if len(catalog_results) >= limit:
        results = catalog_results[:limit]
    else:
        off_results = _search_off(q, limit - len(catalog_results))
        results = catalog_results + off_results

    return {"ok": True, "count": len(results), "results": results}


# ============ 3d: Daily aggregiert ============

@router.get("/daily/{date_str}")
def get_daily(date_str: str, db: Session = Depends(get_db)):
    """GET /nutrition/daily/{date}

    Tages-Makros + Mikros aggregiert. Mikros kommen aus micros_sum (bereits
    beim Logging von Gemini geschätzt und aggregiert, siehe food.py::log_food).
    """
    try:
        datetime.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    journal = db.query(DailyJournal).filter(DailyJournal.date == date_str).first()

    macros = {"kcal": 0.0, "protein": 0.0, "carbs": 0.0, "fat": 0.0}
    micros = {k: 0.0 for k in MICRO_KEYS}
    water_ml = 0

    if journal:
        for meal in journal.food_logs or []:
            macros["kcal"] += meal.get("calories", meal.get("kcal", 0)) or 0
            macros["protein"] += meal.get("protein", 0) or 0
            macros["carbs"] += meal.get("carbs", 0) or 0
            macros["fat"] += meal.get("fat", 0) or 0

        if journal.micros_sum:
            for k in MICRO_KEYS:
                if k in journal.micros_sum:
                    micros[k] = round(journal.micros_sum[k], 1)

        water_ml = journal.water_ml or 0

    return {
        "ok": True,
        "date": date_str,
        "macros": macros,
        "micros": micros,
        "water_ml": water_ml,
    }


# ============ 3e: Estimate (Preview, kein Save) ============

class EstimateRequest(BaseModel):
    text: str


@router.post("/estimate")
def estimate_macros(request: EstimateRequest):
    """POST /nutrition/estimate

    Freitext -> Makro-Schätzung via Gemini, reiner Preview-Call ohne Save.
    Nutzt dieselbe extract_macros_from_text() wie /nutrition/log (inkl.
    Mock-Fallback wenn Gemini nicht verfügbar ist).
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="text fehlt")

    try:
        meal_entry = extract_macros_from_text(request.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "ok": True,
        "data": {
            "description": meal_entry.description,
            "type": "meal",
            "kcal": meal_entry.macros.calories,
            "protein": meal_entry.macros.protein,
            "carbs": meal_entry.macros.carbs,
            "fat": meal_entry.macros.fat,
        },
    }


# ============ 3f: Compose (ohne wger — dokumentierte Lücke) ============

class ComposeRequest(BaseModel):
    description: str
    save_catalog: bool = False


@router.post("/compose")
def compose_meal(request: ComposeRequest, db: Session = Depends(get_db)):
    """POST /nutrition/compose

    Gericht aus Freitext komponieren. WICHTIGE EINSCHRÄNKUNG: das Node-Original
    (nutrition-compose.mjs) nutzt eine wger-Zutaten-Datenbank-Anbindung für
    strukturierte Zutaten-Zusammensetzung — diese Anbindung existiert im
    Python-Refactor (Stand 2026-07-31) nicht. Diese Implementierung ist daher
    bewusst eine Minimalversion: reiner Freitext-zu-Makro-Pfad über Gemini
    (identisch zu extract_macros_from_text), ohne wger-Ingredient-Auflösung
    oder "components"-Aufschlüsselung. Optional wird das Ergebnis in den
    Meal-Katalog gespeichert (save_catalog=true).
    """
    if not request.description or not request.description.strip():
        raise HTTPException(status_code=400, detail="description required")

    try:
        meal_entry = extract_macros_from_text(request.description)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    composed = {
        "kcal": meal_entry.macros.calories,
        "protein": meal_entry.macros.protein,
        "carbs": meal_entry.macros.carbs,
        "fat": meal_entry.macros.fat,
        "components": [],  # keine wger-Komponenten-Auflösung im Python-Refactor
    }

    saved = False
    if request.save_catalog and composed["kcal"] > 0:
        from backend.core.catalog import generate_meal_id

        item_id = generate_meal_id(request.description, db)
        item = MealCatalogItem(
            id=item_id,
            kind="meal",
            name=request.description,
            description=request.description,
            kcal=composed["kcal"],
            protein=composed["protein"],
            carbs=composed["carbs"],
            fat=composed["fat"],
            source="gemini-compose",
        )
        db.add(item)
        db.commit()
        saved = True

    return {"ok": True, "description": request.description, **composed, "saved": saved}

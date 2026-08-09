"""Einmaliges Import-Skript: ~/fuel-dev/catalogs/*.yaml -> Postgres (meal_catalog, supplement_catalog).

~/fuel-dev bleibt dabei unverändert (reine Lesequelle). Idempotent: existierende
IDs werden übersprungen (ON CONFLICT DO NOTHING), mehrfaches Ausführen ist sicher.

Aufruf: poetry run python scripts/import_fuel_dev_catalog.py
"""

from __future__ import annotations

from pathlib import Path

import yaml
from sqlalchemy.dialects.postgresql import insert as pg_insert

from backend.db.database import SessionLocal
from backend.db.models.catalog import MealCatalogItem, SupplementCatalogItem

FUEL_DEV_CATALOGS = Path.home() / "fuel-dev" / "catalogs"
MEALS_DIR = FUEL_DEV_CATALOGS / "nutrition" / "meals"
SUPPLEMENTS_YAML = FUEL_DEV_CATALOGS / "supplements" / "catalog.yaml"


def import_meals(db) -> int:
    if not MEALS_DIR.exists():
        print(f"[meals] Verzeichnis fehlt: {MEALS_DIR}")
        return 0

    rows = []
    for f in sorted(MEALS_DIR.glob("*.yaml")):
        try:
            data = yaml.safe_load(f.read_text())
        except Exception as e:
            print(f"[meals] skip {f.name}: parse error ({e})")
            continue
        if not isinstance(data, dict) or not data.get("id") or not data.get("name"):
            print(f"[meals] skip {f.name}: kein id/name")
            continue

        rows.append({
            "id": data["id"],
            "kind": data.get("kind") or "meal",
            "category": data.get("category"),
            "name": data["name"],
            "alias": data.get("alias"),
            "meal_type": data.get("meal_type"),
            "description": data.get("description"),
            "notes": data.get("notes"),
            "kcal": float(data.get("kcal") or 0),
            "protein": float(data.get("protein") or 0),
            "carbs": float(data.get("carbs") or 0),
            "fat": float(data.get("fat") or 0),
            "yield_g": data.get("yield_g"),
            "components": data.get("components") or [],
            "addons": data.get("addons") or [],
            "default_addon_ids": data.get("default_addon_ids") or [],
            "source": data.get("source") or "fuel-dev-import",
        })

    if not rows:
        return 0

    stmt = pg_insert(MealCatalogItem).values(rows)
    stmt = stmt.on_conflict_do_nothing(index_elements=["id"])
    result = db.execute(stmt)
    db.commit()
    print(f"[meals] {len(rows)} YAML-Dateien gelesen, {result.rowcount} neu importiert")
    return result.rowcount


def import_supplements(db) -> int:
    if not SUPPLEMENTS_YAML.exists():
        print(f"[supplements] Datei fehlt: {SUPPLEMENTS_YAML}")
        return 0

    data = yaml.safe_load(SUPPLEMENTS_YAML.read_text()) or {}
    items = data.get("items") or []
    rows = []
    for it in items:
        if not it.get("id") or not it.get("name"):
            continue
        rows.append({
            "id": it["id"],
            "name": it["name"],
            "product": it.get("product"),
            "unit": it.get("unit") or "mg",
            "default_dose": it.get("default_dose"),
            "default_time_of_day": it.get("default_time_of_day") or "any",
            "micros": it.get("micros") or {},
        })

    if not rows:
        return 0

    stmt = pg_insert(SupplementCatalogItem).values(rows)
    stmt = stmt.on_conflict_do_nothing(index_elements=["id"])
    result = db.execute(stmt)
    db.commit()
    print(f"[supplements] {len(rows)} Einträge gelesen, {result.rowcount} neu importiert")
    return result.rowcount


def main():
    db = SessionLocal()
    try:
        import_meals(db)
        import_supplements(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()

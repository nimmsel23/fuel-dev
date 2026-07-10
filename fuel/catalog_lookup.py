"""Catalog-Lookup: matcht User-Input gegen vorhandene Meal-Catalog-Einträge.

Ziel: vor jedem Gemini-Call erst Catalog durchsuchen. Bei Hit → stored
Per-Unit-Makros nutzen, null Gemini-Calls verbrauchen.
"""

from __future__ import annotations

import json
import os
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from loguru import logger

from . import log as _log

_log.setup()

REPO_CATALOG_DIR = Path(__file__).resolve().parent.parent / "catalogs" / "nutrition" / "meals"
# Legacy zentrale Catalog-Datei (vor der Umstellung auf ein YAML-File pro
# Meal) — enthält weiterhin echte, git-unabhängige Einträge (z.B. Restaurant-
# Kombos). Wird mitgelesen, damit sie für find_meal() nicht unsichtbar sind.
_LEGACY_CATALOG_FILE = (
    Path(os.environ.get("AOS_FUEL_DATA_DIR", Path.home() / ".aos" / "fuel")).expanduser()
    / "nutrition" / "catalog.json"
)

# Wörter, die in Catalog-Namen typisch für "schlechte" Einträge mit Mengen sind
_QUANTITY_NOISE = re.compile(r"\d+\s*(g|gr|gramm|ml|stk|stück|x)\b", re.IGNORECASE)


def _normalize(s: str) -> str:
    """Lowercase, Umlaute strip, nur a-z0-9 + Space, mehrfach-Space kollabiert."""
    if not s:
        return ""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower()
    # ß → ss
    s = s.replace("ß", "ss")
    # Plural-Stripping (einfach): trailing 'n' bei >5 chars
    s = re.sub(r"[^a-z0-9]+", " ", s).strip()
    s = re.sub(r"\s+", " ", s)
    return s


def _singularize(token: str) -> str:
    """Naives Plural→Singular für DE: 'semmeln' → 'semmel', 'eier' → 'ei' etc."""
    if len(token) > 5 and token.endswith("n"):
        return token[:-1]
    if len(token) > 4 and token.endswith("er"):
        return token[:-2]
    return token


def _normalize_singular(s: str) -> str:
    return " ".join(_singularize(t) for t in _normalize(s).split())


def _load_catalog_from_repo() -> list[dict]:
    items: list[dict] = []
    if not REPO_CATALOG_DIR.exists():
        return items
    seen_ids: set[str] = set()
    # YAML bevorzugen
    for f in sorted(REPO_CATALOG_DIR.glob("*.yaml")):
        try:
            import yaml
            data = yaml.safe_load(f.read_text())
            if isinstance(data, dict):
                items.append(data)
                seen_ids.add(f.stem)
        except Exception as e:
            logger.warning(f"catalog yaml parse failed for {f.name}: {e}")
    for f in sorted(REPO_CATALOG_DIR.glob("*.json")):
        if f.stem in seen_ids:
            continue
        try:
            items.append(json.loads(f.read_text()))
        except Exception as e:
            logger.warning(f"catalog json parse failed for {f.name}: {e}")

    if _LEGACY_CATALOG_FILE.exists():
        try:
            data = json.loads(_LEGACY_CATALOG_FILE.read_text())
            for it in data.get("items", []):
                if it.get("id") not in seen_ids:
                    items.append(it)
        except Exception as e:
            logger.warning(f"legacy catalog.json parse failed: {e}")

    return items


def load_meals() -> list[dict]:
    """Lädt Meal-Catalog direkt aus dem Repo + legacy zentraler catalog.json.

    Kein API-Call mehr: save_meal() schreibt in dasselbe Verzeichnis, aus
    dem hier gelesen wird. Ein laufender Node-Server kann in einem völlig
    anderen Arbeitsverzeichnis laufen (z.B. /opt/fuel bei Prod) — über die
    API zu lesen hätte frisch gespeicherte Einträge dort nie gefunden.
    """
    return _load_catalog_from_repo()


def _score_match(query_norm: str, item: dict) -> float:
    """Higher = better. 0.0 = kein Match."""
    name = item.get("name") or ""
    alias = item.get("alias") or ""
    name_norm = _normalize_singular(name)
    alias_norm = _normalize_singular(alias) if alias else ""
    q = _normalize_singular(query_norm)

    score = 0.0
    # Alias exact = sehr stark
    if alias_norm and q == alias_norm:
        score += 100.0
    # Name exact
    if q == name_norm:
        score += 90.0
    # Name enthält query (oder umgekehrt)
    if q in name_norm:
        score += 40.0
    elif name_norm in q:
        score += 30.0
    if alias_norm and alias_norm in q:
        score += 20.0
    # Token-Overlap (Jaccard-light)
    q_tokens = set(q.split())
    n_tokens = set(name_norm.split())
    if q_tokens and n_tokens:
        overlap = len(q_tokens & n_tokens) / len(q_tokens | n_tokens)
        score += overlap * 25.0

    if score == 0:
        return 0.0

    # Ranking-Boni
    name_orig = item.get("name") or ""
    if _QUANTITY_NOISE.search(name_orig):
        score -= 15.0  # "500g Käseleberkäse..." schlechter als "Käseleberkäsesemmel"
    if item.get("kind") in ("meal", "recipe"):
        score += 5.0
    # Kürzere Namen bevorzugen (weniger spezifisch = wiederverwendbar)
    score -= min(len(name_orig) * 0.1, 10.0)
    # Vorhandene addons = gut strukturiert
    if item.get("addons"):
        score += 3.0
    return score


def find_meal(query: str, *, min_score: float = 40.0) -> dict | None:
    """Sucht best-passenden Meal-Eintrag. None wenn kein guter Match.

    min_score=40 entspricht etwa "query in name" oder mittlerem Token-Overlap.
    Schwellwert sicherheitshalber konservativ, lieber Gemini fragen als falschen Hit nehmen.
    """
    if not query or not query.strip():
        return None
    items = load_meals()
    if not items:
        return None
    q_norm = _normalize_singular(query)
    scored: list[tuple[float, dict]] = []
    for it in items:
        s = _score_match(q_norm, it)
        if s >= min_score:
            scored.append((s, it))
    if not scored:
        return None
    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best = scored[0]
    logger.info(f"catalog hit: {best.get('name')!r} (score={best_score:.1f}, query={query!r})")
    return best


def _slugify(name: str) -> str:
    s = _normalize(name).replace(" ", "_")
    return re.sub(r"_+", "_", s).strip("_")[:60] or "meal"


def save_meal(name: str, macros: dict[str, float], *, source: str = "gemini") -> str:
    """Schreibt einen neuen Meal-Catalog-Eintrag direkt als YAML-Datei.

    Kein HTTP-Call an den Node-Server — das Python-CLI-Tool schreibt direkt
    in dasselbe Repo-Verzeichnis, aus dem find_meal()/load_meals() auch lesen
    (REPO_CATALOG_DIR). Damit landen neu von Gemini identifizierte Produkte
    garantiert im git-Repo statt in einem laufenden Server-Prozess, dessen
    Arbeitsverzeichnis auch der Deploy-Zielordner (/opt/fuel) sein kann.
    """
    import yaml

    REPO_CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    base_id = f"meal_{_slugify(name)}"
    item_id = base_id
    n = 2
    while (REPO_CATALOG_DIR / f"{item_id}.yaml").exists():
        item_id = f"{base_id}_{n}"
        n += 1

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    entry = {
        "id": item_id,
        "kind": "meal",
        "category": "meal",
        "name": name,
        "alias": None,
        "meal_type": "meal",
        "description": name,
        "notes": "",
        "kcal": round(float(macros.get("kcal", 0)), 1),
        "protein": round(float(macros.get("protein", 0)), 1),
        "carbs": round(float(macros.get("carbs", 0)), 1),
        "fat": round(float(macros.get("fat", 0)), 1),
        "yield_g": None,
        "components": [],
        "addons": [],
        "default_addon_ids": [],
        "source": source,
        "created_at": now,
        "updated_at": now,
    }
    (REPO_CATALOG_DIR / f"{item_id}.yaml").write_text(
        yaml.dump(entry, allow_unicode=True, sort_keys=False, default_flow_style=False)
    )
    logger.info(f"catalog gespeichert: {item_id} ({name})")
    return item_id


def extract_macros(item: dict) -> dict[str, float]:
    """Top-level macros aus Catalog-Item, inkl. default_addons summiert."""
    base = {
        "kcal": float(item.get("kcal") or 0),
        "protein": float(item.get("protein") or 0),
        "carbs": float(item.get("carbs") or 0),
        "fat": float(item.get("fat") or 0),
    }
    # default_addon_ids sind in den Top-Level-Werten i.d.R. schon enthalten
    # (siehe meal_spiegelei_5x: kcal=669 = base 445 + addons 70+154)
    # Daher KEIN doppeltes Addieren.
    return base

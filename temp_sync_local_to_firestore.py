#!/usr/bin/env python3
import sys
import os
from pathlib import Path
from datetime import date
from loguru import logger

# Annahme: aos-dev/handlers ist im PYTHONPATH oder fuel-firestore.py ist direkt erreichbar
# Um aos-dev/handlers in den PYTHONPATH zu bekommen, falls nicht schon geschehen
aos_handlers_path = Path('/home/alpha/aos-dev/handlers').resolve()
if str(aos_handlers_path) not in sys.path:
    sys.path.insert(0, str(aos_handlers_path))

try:
    import fuel_firestore
except ImportError:
    logger.error("fuel_firestore.py konnte nicht importiert werden. Sicherstellen, dass aos-dev/handlers im PYTHONPATH ist.")
    sys.exit(1)

# UID für den Sync (wir pushen in den "default" Bereich, den die PWA lesen darf)
target_uid = "default"

# Pfad zu den lokalen Daten (wie in fuel-firestore.py definiert)
FUEL_DATA_DIR = Path(os.getenv("AOS_FUEL_DATA_DIR", str(Path.home() / ".aos" / "fuel"))).expanduser()

logger.remove() # Entfernt Standard-Logger
logger.add(sys.stderr, level="INFO") # Nur INFO und höher zu stderr

logger.info(f"Starte einmaligen Push der lokalen Daten aus {FUEL_DATA_DIR} zu Firestore (UID: {target_uid}).")

# --- Sync Nutrition Logs ---
nut_dir = FUEL_DATA_DIR / "nutrition"
if nut_dir.exists():
    for f in nut_dir.glob("*.json"):
        d = f.stem # Dateiname ist Datum (YYYY-MM-DD)
        try:
            results = fuel_firestore.do_sync(d, "push", target_uid)
            logger.info(f"Nutrition {d}: {results}")
        except Exception as e:
            logger.error(f"Fehler beim Sync Nutrition {d}: {e}")
else:
    logger.info("Keine Nutrition-Logs gefunden.")

# --- Sync Supplements Logs ---
supp_logs_dir = FUEL_DATA_DIR / "supplements" / "logs"
if supp_logs_dir.exists():
    for f in supp_logs_dir.glob("*.json"):
        d = f.stem # Dateiname ist Datum (YYYY-MM-DD)
        try:
            results = fuel_firestore.do_sync(d, "push", target_uid)
            logger.info(f"Supplements {d}: {results}")
        except Exception as e:
            logger.error(f"Fehler beim Sync Supplements {d}: {e}")
else:
    logger.info("Keine Supplements-Logs gefunden.")

# --- Sync Nutrition Journal ---
journal_dir = FUEL_DATA_DIR / "nutrition_journal"
if journal_dir.exists():
    for f in journal_dir.glob("*.md"):
        d = f.stem # Dateiname ist Datum (YYYY-MM-DD)
        try:
            results = fuel_firestore.do_sync(d, "push", target_uid)
            logger.info(f"Journal {d}: {results}")
        except Exception as e:
            logger.error(f"Fehler beim Sync Journal {d}: {e}")
else:
    logger.info("Keine Journal-Logs gefunden.")

logger.info("Einmaliger Push abgeschlossen.")

#!/usr/bin/env python3
"""Interactive TUI for editing nutrition catalog and log entries with nutrient lookup."""

import json
import subprocess
import sys
from datetime import date
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

try:
    from wasabi import Printer
    msg = Printer()
except ImportError:
    class _P:
        def divider(self, t): print(f"\n--- {t} ---\n")
        def warn(self, t): print(f"[warn] {t}", file=sys.stderr)
        def fail(self, t): print(f"[fail] {t}", file=sys.stderr)
        def info(self, t): print(f"[info] {t}")
        def good(self, t): print(f"[ok] {t}")
    msg = _P()


def have_gum() -> bool:
    """Check if gum is available."""
    return subprocess.run(["which", "gum"], capture_output=True).returncode == 0


def _data_dir() -> Path:
    import os
    return Path(os.environ.get("AOS_FUEL_DATA_DIR", "~/.aos/fuel")).expanduser()


def _nutrition_dir() -> Path:
    return _data_dir() / "nutrition"


def _catalog_dir() -> Path:
    """Catalog directory relative to fuel-dev repo."""
    return Path(__file__).resolve().parent.parent / "catalogs" / "nutrition" / "meals"


def _lookup_nutrition(name: str) -> dict | None:
    """Lookup nutrition data: wger (with fallback to OFF)."""
    from .sources.wger import search_ingredient as wger_search
    from .sources.off import search_ingredient as off_search

    # Try wger first
    try:
        result = wger_search(name, limit=1, timeout=3)
        if result:
            msg.info(f"✓ wger: {result['name']}")
            return result
    except Exception as e:
        pass

    # Fallback to OFF
    try:
        result = off_search(name, limit=1, timeout=5)
        if result:
            msg.info(f"✓ OFF: {result['name']}")
            return result
    except Exception as e:
        msg.warn(f"OFF lookup failed: {e}")

    return None


def _gum_choose(options: list[str], placeholder: str = "") -> str | None:
    """Use gum choose or fallback to numbered menu."""
    if not have_gum():
        return _numbered_menu(options, placeholder)

    try:
        result = subprocess.run(
            ["gum", "choose"] + options,
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
        elif result.returncode != 0:
            # gum failed, log stderr for debugging
            if result.stderr:
                msg.warn(f"gum error: {result.stderr.strip()[:100]}")
    except subprocess.TimeoutExpired:
        msg.warn("gum timeout")
    except Exception as e:
        msg.warn(f"gum exception: {e}")

    # Fallback if gum fails (no TTY, etc.)
    return _numbered_menu(options, placeholder)


def _gum_input(prompt: str, initial: str = "") -> str | None:
    """Use gum input or fallback to raw input."""
    if not have_gum():
        try:
            display = f"{prompt}: [{initial}] " if initial else f"{prompt}: "
            val = input(display).strip()
            return val or initial
        except (EOFError, KeyboardInterrupt):
            return None

    try:
        cmd = ["gum", "input", "--prompt", f"{prompt}: "]
        if initial:
            cmd.extend(["--value", initial])
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None


def _gum_confirm(message: str) -> bool:
    """Use gum confirm or fallback to y/n prompt."""
    if not have_gum():
        try:
            return input(f"{message} [y/N]: ").lower() in ("y", "yes")
        except (EOFError, KeyboardInterrupt):
            return False

    try:
        result = subprocess.run(["gum", "confirm", message], capture_output=True)
        return result.returncode == 0
    except Exception:
        return False


def _numbered_menu(options: list[str], prompt: str = "Wähle eine Option") -> str | None:
    """Fallback: numbered menu in terminal."""
    if not options:
        return None

    print(f"\n{prompt}:")
    for i, opt in enumerate(options, 1):
        print(f"  {i}) {opt}")

    while True:
        try:
            choice = input("Eingabe (Nummer oder 'q' zum Abbrechen): ").strip()
            if choice.lower() == 'q':
                return None
            idx = int(choice) - 1
            if 0 <= idx < len(options):
                return options[idx]
            else:
                print(f"  ✗ Bitte Nummer zwischen 1 und {len(options)} eingeben")
        except (ValueError, IndexError):
            print(f"  ✗ Ungültige Eingabe")
        except (EOFError, KeyboardInterrupt):
            return None


def _load_meal_file(meal_file: Path) -> dict | None:
    """Load meal data from JSON or YAML file."""
    try:
        if meal_file.suffix == ".json":
            return json.loads(meal_file.read_text())
        elif meal_file.suffix == ".yaml" or meal_file.suffix == ".yml":
            if yaml is None:
                msg.warn(f"YAML support not available for {meal_file.name}")
                return None
            return yaml.safe_load(meal_file.read_text())
    except (json.JSONDecodeError, yaml.YAMLError if yaml else None) as e:
        msg.warn(f"Error parsing {meal_file.name}: {e}")
    return None


def _save_meal_file(meal_file: Path, data: dict) -> None:
    """Save meal data to JSON or YAML file."""
    if meal_file.suffix == ".json":
        meal_file.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    elif meal_file.suffix == ".yaml" or meal_file.suffix == ".yml":
        if yaml is None:
            msg.fail("YAML support not available")
            return
        meal_file.write_text(yaml.dump(data, default_flow_style=False, allow_unicode=True))


def edit_catalog() -> None:
    """Edit nutrition catalog entries with optional nutrient lookup."""
    msg.divider("NUTRITION CATALOG EDIT")

    catalog_dir = _catalog_dir()
    if not catalog_dir.exists():
        msg.fail(f"Catalog directory not found: {catalog_dir}")
        return

    # List all .json and .yaml files in catalog
    meals = sorted(list(catalog_dir.glob("*.json")) + list(catalog_dir.glob("*.yaml")))
    if not meals:
        msg.warn("No meals in catalog")
        return

    # Show meal list with descriptions
    meal_options = []
    meal_map = {}
    for meal_file in meals:
        data = _load_meal_file(meal_file)
        if not data:
            continue
        name = data.get("name", meal_file.stem)
        meal_options.append(f"{name} ({meal_file.stem})")
        meal_map[f"{name} ({meal_file.stem})"] = meal_file

    if not meal_options:
        msg.warn("Could not parse any meals")
        return

    # Select meal
    selected = _gum_choose(meal_options, "Wähle eine Mahlzeit zum Editieren")
    if not selected:
        msg.fail("Abgebrochen oder keine Auswahl möglich")
        return

    meal_file = meal_map[selected]
    data = _load_meal_file(meal_file)
    if not data:
        return

    # Edit fields
    msg.divider(f"Editiere: {data.get('name', meal_file.stem)}")
    print(f"File: {meal_file.name}\n")

    # Option: Lookup nutrition from wger/OFF
    if _gum_confirm("Nährwerte aus wger/OFF laden?"):
        search_term = data.get("description") or data.get("name")
        msg.info(f"Suche: {search_term}...")
        nutrition = _lookup_nutrition(search_term)
        if nutrition:
            if _gum_confirm(f"Werte übernehmen? ({nutrition['energy_kcal']} kcal, {nutrition['protein']}P, {nutrition['carbs']}C, {nutrition['fat']}F)"):
                data["kcal"] = nutrition["energy_kcal"]
                data["protein"] = nutrition["protein"]
                data["carbs"] = nutrition["carbs"]
                data["fat"] = nutrition["fat"]
                if "name" not in data or data["name"] == data.get("description"):
                    data["name"] = nutrition["name"]
                msg.good("Nährwerte übernommen")
        else:
            msg.warn("Keine Nährwertdaten gefunden")

    # Manual edits
    editable_fields = ["name", "description", "kcal", "protein", "carbs", "fat", "notes", "meal_type", "category"]

    print("\nManuelle Änderungen (Enter = überspringen):")
    for field in editable_fields:
        if field in data:
            current = str(data[field])
            new_val = _gum_input(f"{field}", current)
            if new_val is not None and new_val != current:
                # Try to convert to number for numeric fields
                if field in ("kcal", "protein", "carbs", "fat"):
                    try:
                        data[field] = float(new_val)
                    except ValueError:
                        data[field] = new_val
                else:
                    data[field] = new_val

    # Show changes and confirm
    print("\nFinale Werte:")
    for field in editable_fields:
        if field in data:
            print(f"  {field}: {data[field]}")

    if _gum_confirm("Speichern?"):
        _save_meal_file(meal_file, data)
        msg.good(f"Gespeichert: {meal_file.name}")
    else:
        msg.warn("Abgebrochen (nicht gespeichert)")


def edit_logs(target_date: str | None = None) -> None:
    """Edit nutrition log entries for a specific date."""
    msg.divider("NUTRITION LOG EDIT")

    # Get target date
    if not target_date:
        target_date = _gum_input("Datum (YYYY-MM-DD)", str(date.today()))
        if not target_date:
            msg.warn("Abgebrochen")
            return

    # Load log file
    log_file = _nutrition_dir() / f"{target_date}.json"
    if not log_file.exists():
        msg.warn(f"Keine Einträge für {target_date}")
        return

    try:
        data = json.loads(log_file.read_text())
    except json.JSONDecodeError:
        msg.fail(f"Fehler beim Laden von {log_file}")
        return

    meals = data.get("meals", [])
    if not meals:
        msg.warn(f"Keine Mahlzeiten für {target_date}")
        return

    # Show meals
    meal_options = []
    meal_map = {}
    for i, meal in enumerate(meals):
        desc = meal.get("description", "unnamed")
        time_str = meal.get("time", "").split("T")[1][:5] if "T" in meal.get("time", "") else "?"
        label = f"{i+1}. {time_str} — {desc} ({meal.get('kcal', 0)} kcal)"
        meal_options.append(label)
        meal_map[label] = i

    # Select meal
    selected = _gum_choose(meal_options, "Wähle eine Mahlzeit zum Editieren")
    if not selected:
        msg.fail("Abgebrochen oder keine Auswahl möglich")
        return

    meal_idx = meal_map[selected]
    meal = meals[meal_idx]

    # Edit fields
    msg.divider(f"Editiere Mahlzeit #{meal_idx+1}")
    print(f"Datum: {target_date}\n")

    # Option: Lookup nutrition from wger/OFF
    if _gum_confirm("Nährwerte aus wger/OFF laden?"):
        search_term = meal.get("description")
        msg.info(f"Suche: {search_term}...")
        nutrition = _lookup_nutrition(search_term)
        if nutrition:
            if _gum_confirm(f"Werte übernehmen? ({nutrition['energy_kcal']} kcal, {nutrition['protein']}P, {nutrition['carbs']}C, {nutrition['fat']}F)"):
                meal["kcal"] = nutrition["energy_kcal"]
                meal["protein"] = nutrition["protein"]
                meal["carbs"] = nutrition["carbs"]
                meal["fat"] = nutrition["fat"]
                msg.good("Nährwerte übernommen")
        else:
            msg.warn("Keine Nährwertdaten gefunden")

    editable_fields = ["description", "kcal", "protein", "carbs", "fat", "notes", "meal_type", "type"]

    print("\nManuelle Änderungen (Enter = überspringen):")
    for field in editable_fields:
        if field in meal:
            current = str(meal[field])
            new_val = _gum_input(f"{field}", current)
            if new_val is not None and new_val != current:
                # Try to convert to number for numeric fields
                if field in ("kcal", "protein", "carbs", "fat"):
                    try:
                        meal[field] = float(new_val)
                    except ValueError:
                        meal[field] = new_val
                else:
                    meal[field] = new_val

    # Show changes and confirm
    print("\nFinale Werte:")
    for field in editable_fields:
        if field in meal:
            print(f"  {field}: {meal[field]}")

    if _gum_confirm("Speichern?"):
        # Update mtime
        import time
        data["_local_mtime"] = int(time.time() * 1000)

        log_file.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        msg.good(f"Gespeichert: {log_file.name}")
    else:
        msg.warn("Abgebrochen (nicht gespeichert)")


def edit(mode: str | None = None, target_date: str | None = None) -> None:
    """Main edit dispatcher.

    Default (no args): ncurses TUI für heutiges Datum
    --mode catalog: gum-basierter Catalog-Editor
    --mode log [--date]: gum-basierter Log-Editor für spezifisches Datum
    """
    # Default: ncurses TUI für heute (neutral, kein Datum-Input)
    if not mode and not target_date:
        from .tui_ncurses import edit_daily
        edit_daily()
        return

    # Expliziter Mode
    if not mode:
        options = ["Catalog editieren", "Log editieren"]
        selected = _gum_choose(options, "Was möchtest du editieren?")
        if not selected:
            return
        mode = "catalog" if "Catalog" in selected else "log"

    if mode == "catalog":
        edit_catalog()
    elif mode == "log":
        edit_logs(target_date)
    else:
        msg.fail(f"Unbekannter Mode: {mode}")

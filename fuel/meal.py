#!/usr/bin/env python3
"""
fuel-meal — Meal logging CLI (interactive, manual, Gemini-powered)

Usage:
  fuel meal log "Nussschnecke" --kcal 250    # With manual macros
  fuel meal log "Wiener Schnitzel"           # Auto-estimate via Gemini
  fuel meal log "Name" --save-catalog        # Save to reusable catalog
  fuel meal list                             # List meals in catalog
  fuel meal today                            # Show today's meals
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import typer
from wasabi import Printer
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from rich.console import Console
from rich.table import Table

from .dates import resolve_flags as _resolve_date, extract_date_hint as _extract_date_hint
from .narrative import parse as _parse_narrative, spread_times as _spread_times
from .gemini import estimate_macros_only as _gemini_macros, discover_item as _gemini_discover
from .catalog_lookup import find_meal as _catalog_find, extract_macros as _catalog_macros, save_meal as _catalog_save, load_meals as _catalog_load_meals


def _clean_catalog_name(text: str, max_len: int = 80) -> str:
    """Macht aus items_text einen sauberen Catalog-Namen ohne Gemini-Call."""
    import re as _re
    # Prefix-Müll: "Mahlzeit:", "Insgesamt:", etc.
    cleaned = _re.sub(r"^\s*(mahlzeit|insgesamt|gericht|essen)\s*:?\s*", "", text, flags=_re.IGNORECASE).strip()
    cleaned = _re.sub(r"\s+", " ", cleaned)
    if len(cleaned) > max_len:
        cleaned = cleaned[: max_len - 1].rsplit(",", 1)[0].rstrip() + "…"
    return cleaned or text

console = Console()
msg = Printer()

# ── Helpers ───────────────────────────────────────────────────────────────────

def gum_log(level: str, text: str):
    """Wrapper for gum log."""
    try:
        subprocess.run(["gum", "log", f"--level={level}", text])
    except:
        if level == "info": msg.info(text)
        elif level == "warn": msg.warn(text)
        elif level == "error": msg.fail(text)

# ── Config ────────────────────────────────────────────────────────────────────

def _load_env():
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

_load_env()

# ── Paths ──────────────────────────────────────────────────────────────────────

DATA_DIR = Path(os.environ.get("AOS_FUEL_DATA_DIR", Path.home() / ".aos" / "fuel")).expanduser()
NUTRITION_DIR = DATA_DIR / "nutrition"

# ── Local I/O ──────────────────────────────────────────────────────────────────

def _load_log_local(date_str: str) -> dict:
    p = NUTRITION_DIR / f"{date_str}.json"
    if p.exists():
        try:
            return json.loads(p.read_text())
        except:
            pass
    return {"date": date_str, "meals": [], "water_ml": 0}

def _save_log_local(log: dict) -> None:
    NUTRITION_DIR.mkdir(parents=True, exist_ok=True)
    p = NUTRITION_DIR / f"{log['date']}.json"
    p.write_text(json.dumps(log, indent=2, ensure_ascii=False) + "\n")

# ── Validation ─────────────────────────────────────────────────────────────────

class MealInput(BaseModel):
    model_config = ConfigDict(validate_assignment=True)
    description: str = Field(..., min_length=1)
    kcal: float = Field(0, ge=0)
    protein: float = Field(0, ge=0)
    carbs: float = Field(0, ge=0)
    fat: float = Field(0, ge=0)
    notes: str = Field("")

def _parse_macros_with_gemini(description: str) -> dict:
    """Schätzt Makros direkt über fuel.gemini (kein Subprocess mehr).

    War vorher ein subprocess.run() auf ein externes bin/gemini-estimate
    Script — unnötiger Umweg, da _gemini_macros (fuel.gemini.
    estimate_macros_only) exakt dasselbe tut, inklusive Multi-Key-Rotation
    bei HTTP 400/403/429. Der Subprocess-Pfad war zudem seit dem Umzug von
    fuel-meal nach fuel/meal.py kaputt (relativer Pfad zeigte auf das
    falsche Verzeichnis).
    """
    macros = _gemini_macros(description)
    kcal = macros.get("kcal", 0)
    if macros.get("_error"):
        msg.warn(f"Gemini: {macros['_error']}")
    elif kcal > 0:
        msg.info(f"Gemini: {kcal} kcal geschätzt")
    return macros

# ── Interactive Mode ───────────────────────────────────────────────────────────

def do_meal_interactive() -> None:
    """Interactive fzf catalog browser."""
    items = _catalog_load_meals()

    if not items:
        msg.warn("Catalog ist leer")
        raise SystemExit(1)

    fzf_items = []
    for item in items:
        kcal = item.get("kcal", 0)
        label = f"{item['name']:<40} {kcal:>4} kcal"
        fzf_items.append((label, item))

    fzf_input = "\n".join([label for label, _ in fzf_items])

    try:
        result = subprocess.run(
            ["fzf", "--header", "MEAL AUSWÄHLEN", "--height=15", "--layout=reverse"],
            input=fzf_input,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0:
            raise SystemExit(0)

        selected_label = result.stdout.strip()
        selected_item = None
        for label, item in fzf_items:
            if label == selected_label:
                selected_item = item
                break

        if not selected_item:
            msg.fail("Item nicht gefunden")
            raise SystemExit(1)

        do_meal_log(selected_item["name"], selected_item.get("kcal", 0),
                    selected_item.get("protein", 0), selected_item.get("carbs", 0),
                    selected_item.get("fat", 0), "", None, False)

    except FileNotFoundError:
        msg.fail("fzf nicht gefunden")
        raise SystemExit(1)

# ── Meal Logging ───────────────────────────────────────────────────────────────

def do_meal_log(description: str, kcal: float, protein: float, carbs: float, fat: float, notes: str, day: str | None, save_catalog: bool, qty: int = 1, catalog_id: str | None = None, meal_type: str = "lunch") -> None:
    today = day or date.today().isoformat()
    qty = max(1, int(qty))

    if kcal == 0 and protein == 0 and carbs == 0 and fat == 0:
        # Lookup-first: Catalog-Hit spart Gemini-Call komplett
        if not catalog_id:
            hit = _catalog_find(description)
            if hit:
                m = _catalog_macros(hit)
                kcal, protein, carbs, fat = m["kcal"], m["protein"], m["carbs"], m["fat"]
                catalog_id = hit.get("id")
                msg.good(f"Catalog-Hit: {hit['name']} ({kcal:.0f} kcal/Stück) — kein Gemini-Call")
        if kcal == 0:
            with Console().status(f"[cyan]Gemini schätzt Makros für '{description}'...[/cyan]", spinner="dots"):
                macros = _parse_macros_with_gemini(description)
            
            kcal, protein, carbs, fat = macros.get("kcal", 0), macros.get("protein", 0), macros.get("carbs", 0), macros.get("fat", 0)
            
            if kcal == 0 and protein == 0 and carbs == 0 and fat == 0:
                msg.fail("Gemini konnte die Makros nicht schätzen (Netzwerkfehler oder ungültige Antwort). Abbruch.")
                raise SystemExit(1)

    if qty > 1:
        kcal, protein, carbs, fat = kcal * qty, protein * qty, carbs * qty, fat * qty

    try:
        MealInput(description=description, kcal=kcal, protein=protein, carbs=carbs, fat=fat, notes=notes)
    except ValidationError as e:
        msg.fail(f"Validation error: {e.error_count()} Fehler")
        raise SystemExit(1)

    meal_entry = {
        "id": f"meal_{int(datetime.now().timestamp() * 1000)}",
        "catalog_id": catalog_id,
        "type": meal_type,
        "description": f"{qty}x {description}" if qty > 1 else description,
        "notes": notes,
        "kcal": kcal, "protein": protein, "carbs": carbs, "fat": fat,
        "time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }

    # Direkter Dateizugriff — kein Node-Server als Dependency für das Python
    # CLI-Tool. War vorher _api_call("POST", "/nutrition/log", ...) über HTTP;
    # das koppelte den Log-Schreibpfad an einen laufenden Server-Prozess
    # (und dessen Arbeitsverzeichnis — /opt/fuel bei Prod statt Repo-Checkout).
    log = _load_log_local(today)
    log["meals"].append(meal_entry)
    _save_log_local(log)
    msg.good(f"{description} ({kcal:.0f} kcal) geloggt — {today}")

    if save_catalog:
        new_id = _catalog_save(description, {"kcal": kcal/qty, "protein": protein/qty, "carbs": carbs/qty, "fat": fat/qty})
        msg.info(f"Zum Catalog hinzugefügt: {description} (id={new_id})")

def do_today(day: str | None) -> None:
    today = day or date.today().isoformat()
    meals = _load_log_local(today).get("meals", [])

    if not meals:
        console.print(f"[yellow]Keine Mahlzeiten geloggt am {today}[/yellow]")
        return

    table = Table(title=f"Mahlzeiten — {today}", show_header=True, header_style="bold green")
    table.add_column("MAHLZEIT")
    table.add_column("KCAL", justify="right")
    table.add_column("P", justify="right")
    table.add_column("K", justify="right")
    table.add_column("F", justify="right")

    for m in meals:
        table.add_row(m["description"], f"{m['kcal']:.0f}", f"{m['protein']:.1f}g", f"{m['carbs']:.1f}g", f"{m['fat']:.1f}g")
    
    console.print(table)

def do_unlog(day: str | None) -> None:
    target_day = day or date.today().isoformat()
    meals = _load_log_local(target_day).get("meals", [])

    if not meals:
        msg.warn(f"Keine Einträge am {target_day} zum Löschen.")
        return

    fzf_lines = []
    for m in meals:
        line = f"{m['id']} | {m['description']} ({m.get('kcal',0)} kcal)"
        fzf_lines.append(line)

    try:
        result = subprocess.run(
            ["fzf", "--header", f"MAHLZEIT LÖSCHEN ({target_day})", "--height=15", "--layout=reverse"],
            input="\n".join(fzf_lines),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return

        selected_line = result.stdout.strip()
        if not selected_line:
            return

        delete_id = selected_line.split("|")[0].strip()

        log = _load_log_local(target_day)
        log["meals"] = [m for m in log["meals"] if m["id"] != delete_id]
        _save_log_local(log)
        msg.good(f"Mahlzeit {delete_id} gelöscht.")

    except FileNotFoundError:
        msg.fail("fzf nicht gefunden")
        raise SystemExit(1)

# ── Typer App ──────────────────────────────────────────────────────────────────

app = typer.Typer(help="Meal Logging CLI — ohne Subcommand: interaktiver Catalog-Browser (fzf)")

@app.command(name="unlog")
def unlog_command(
    tag:        str | None = typer.Option(None, "--tag", help="Datum: heute|gestern|vorgestern|-N|Mo|YYYY-MM-DD"),
    gestern:    bool       = typer.Option(False, "--gestern", "-g"),
    vorgestern: bool       = typer.Option(False, "--vorgestern"),
    day:        str | None = typer.Option(None, "--day", "-d", help="(legacy) Datum YYYY-MM-DD"),
) -> None:
    """Entferne einen Mahlzeiten-Eintrag interaktiv."""
    try:
        target = _resolve_date(tag=tag, gestern=gestern, vorgestern=vorgestern, day_legacy=day)
    except ValueError as e:
        msg.fail(str(e)); raise typer.Exit(1)
    do_unlog(target)

@app.callback(invoke_without_command=True)
def _app_callback(ctx: typer.Context) -> None:
    if ctx.invoked_subcommand is None:
        do_meal_interactive()

@app.command(name="log")
def log_command(
    description: str = typer.Argument(..., help="Mahlzeit-Beschreibung — ohne Makros: Gemini schätzt automatisch"),
    kcal: float = typer.Option(0, "--kcal", help="Kalorien (kcal)"),
    protein: float = typer.Option(0, "--protein", help="Protein (g)"),
    carbs: float = typer.Option(0, "--carbs", help="Kohlenhydrate (g)"),
    fat: float = typer.Option(0, "--fat", help="Fett (g)"),
    notes: str = typer.Option("", "--notes", "-n", help="Optionale Notiz"),
    tag:        str | None = typer.Option(None, "--tag", help="Datum: heute|gestern|vorgestern|-N|Mo|YYYY-MM-DD"),
    gestern:    bool       = typer.Option(False, "--gestern", "-g"),
    vorgestern: bool       = typer.Option(False, "--vorgestern"),
    day: str = typer.Option(None, "--day", "-d", hidden=True),
    save_catalog: bool = typer.Option(False, "--save-catalog", "-s", help="Im Catalog speichern für spätere Wiederverwendung"),
    qty: int = typer.Option(1, "--qty", "-q", help="Portionen-Multiplikator — Makros × N"),
    meal_type: str = typer.Option("lunch", "--meal-type", "-m", help="breakfast|lunch|dinner|snack"),
) -> None:
    """Einzelne Mahlzeit loggen. Reihenfolge: --kcal (falls gesetzt) → Catalog-Hit → Gemini-Schätzung.

    Beispiele:
      fuel-meal log "Käsekrainer 330g"
      fuel-meal log "Nussschnecke" --kcal 250 --protein 4
      fuel-meal log "Toast mit Ei" --gestern --meal-type breakfast --save-catalog
    """
    try:
        target = _resolve_date(tag=tag, gestern=gestern, vorgestern=vorgestern, day_legacy=day)
    except ValueError as e:
        msg.fail(str(e)); raise typer.Exit(1)

    # Explizite Flags haben immer Vorrang. Nur wenn KEIN Datums-Flag gesetzt
    # wurde, nach einem Datumswort im Freitext suchen ("gestern hab ich X
    # gegessen") — sonst landet ein "gestern" in der Beschreibung fälschlich
    # auf dem heutigen Datum, weil es sonst nirgends ausgewertet wird.
    if not (tag or gestern or vorgestern or day):
        hint_date, cleaned = _extract_date_hint(description)
        if hint_date:
            target = hint_date
            description = cleaned
            msg.info(f"Datumswort erkannt: Log-Datum → {target}")

    do_meal_log(description, kcal, protein, carbs, fat, notes, target, save_catalog, qty, meal_type=meal_type)

@app.command(name="narrative")
def narrative_command(
    text: str = typer.Argument(..., help="Freitext: '4 Teller Nachmittag bis Abend: 250g Reis, Gemüse, Chicken'"),
    tag:        str | None = typer.Option(None, "--tag", help="Datum: heute|gestern|vorgestern|-N|Mo|YYYY-MM-DD"),
    gestern:    bool       = typer.Option(False, "--gestern", "-g"),
    vorgestern: bool       = typer.Option(False, "--vorgestern"),
    day:        str | None = typer.Option(None, "--day", "-d", hidden=True),
    save_catalog: bool     = typer.Option(False, "--save-catalog", "-s", help="Gericht als Catalog-Eintrag speichern"),
    dry_run:    bool       = typer.Option(False, "--dry-run", "-n", help="Vorschau — nichts loggen"),
) -> None:
    """Freitext → mehrere Mahlzeit-Einträge. Gemini schätzt Gesamt-Makros und teilt auf N Teller/Portionen auf."""
    try:
        target = _resolve_date(tag=tag, gestern=gestern, vorgestern=vorgestern, day_legacy=day)
    except ValueError as e:
        msg.fail(str(e)); raise typer.Exit(1)

    if not (tag or gestern or vorgestern or day):
        hint_date, cleaned = _extract_date_hint(text)
        if hint_date:
            target = hint_date
            text = cleaned
            msg.info(f"Datumswort erkannt: Log-Datum → {target}")

    parsed = _parse_narrative(text)
    if not parsed.items_text:
        msg.fail("Keine Items in der Beschreibung erkannt"); raise typer.Exit(1)

    msg.info(f"Erkannt: {parsed.count} Teller · Fenster {parsed.time_window or 'kein'} · Items: {parsed.items_text}")

    # Lookup-first: Catalog-Match → stored per-unit macros, null Gemini
    catalog_hit = _catalog_find(parsed.items_text)
    catalog_id: str | None = None
    catalog_name = _clean_catalog_name(parsed.items_text)

    if catalog_hit:
        m = _catalog_macros(catalog_hit)
        per_kcal, per_protein, per_carbs, per_fat = m["kcal"], m["protein"], m["carbs"], m["fat"]
        catalog_id = catalog_hit.get("id")
        catalog_name = catalog_hit.get("name") or catalog_name
        msg.good(f"Catalog-Hit: {catalog_name} ({per_kcal:.0f} kcal/Teller) — kein Gemini-Call")
    else:
        with Console().status(f"[cyan]Gemini schätzt Makros für '{parsed.items_text}'...[/cyan]", spinner="dots"):
            macros = _gemini_macros(parsed.items_text)
        if macros.get("_error"):
            msg.fail(f"Gemini-Fehler: {macros['_error']}"); raise typer.Exit(1)
        per_kcal    = macros["kcal"]    / parsed.count
        per_protein = macros["protein"] / parsed.count
        per_carbs   = macros["carbs"]   / parsed.count
        per_fat     = macros["fat"]     / parsed.count
        console.print(f"[bold]Gesamt:[/bold] {macros['kcal']:.0f} kcal · {macros['protein']:.1f}P · {macros['carbs']:.1f}C · {macros['fat']:.1f}F")

    times = _spread_times(parsed.count, parsed.time_window)
    console.print(f"[bold]Pro Teller:[/bold] {per_kcal:.0f} kcal · {per_protein:.1f}P · {per_carbs:.1f}C · {per_fat:.1f}F")

    # Catalog-Enhancement: bei Miss + --save-catalog → 1× discover + POST → catalog_id
    if save_catalog and not dry_run and not catalog_id:
        with Console().status("[cyan]Gemini extrahiert kanonischen Namen...[/cyan]", spinner="dots"):
            disc = _gemini_discover(parsed.items_text)
        if disc.get("error"):
            msg.warn(f"discover: {disc['error']} — fallback lokaler Name")
        else:
            entry = disc.get("catalog_entry") or {}
            name = (entry.get("name") or "").strip()
            if disc.get("type") == "meal" and name:
                catalog_name = name
        catalog_id = _catalog_save(catalog_name, {
            "kcal": per_kcal, "protein": per_protein, "carbs": per_carbs, "fat": per_fat,
        })
        msg.good(f"Catalog: '{catalog_name}' (id={catalog_id})")

    for i, t in enumerate(times, 1):
        slot = f" ~{t}" if t else ""
        # Saubere Description: Catalog-Name + Instance-Suffix (oder items_text wenn kein Catalog)
        base = catalog_name if catalog_id else parsed.items_text
        desc = f"{base} (Teller {i}/{parsed.count}{slot})"
        note = f"Teller {i}/{parsed.count}{slot}"
        if dry_run:
            console.print(f"  [dim]would log:[/dim] {desc}  →  {per_kcal:.0f}kcal/{per_protein:.1f}P/{per_carbs:.1f}C/{per_fat:.1f}F")
            continue
        do_meal_log(
            description=desc,
            kcal=per_kcal, protein=per_protein, carbs=per_carbs, fat=per_fat,
            notes=note, day=target,
            save_catalog=False,  # Catalog wurde 1× oben angelegt
            qty=1,
            catalog_id=catalog_id,
        )


@app.command()
def list() -> None:
    """Alle gespeicherten Mahlzeiten im Catalog anzeigen."""
    items = _catalog_load_meals()
    table = Table(title="Meal Catalog", show_header=True, header_style="bold magenta")
    table.add_column("NAME")
    table.add_column("KCAL", justify="right")
    for i in items:
        table.add_row(i["name"], f"{i.get('kcal',0):.0f}")
    console.print(table)

@app.command()
def today(
    tag:        str | None = typer.Option(None, "--tag", help="Datum: heute|gestern|vorgestern|-N|Mo|YYYY-MM-DD"),
    gestern:    bool       = typer.Option(False, "--gestern", "-g"),
    vorgestern: bool       = typer.Option(False, "--vorgestern"),
    day: str = typer.Option(None, "--day", "-d", hidden=True),
):
    """Gebuchte Mahlzeiten für heute (oder ein anderes Datum) anzeigen."""
    try:
        target = _resolve_date(tag=tag, gestern=gestern, vorgestern=vorgestern, day_legacy=day)
    except ValueError as e:
        msg.fail(str(e)); raise typer.Exit(1)
    do_today(target)


def main() -> None:
    app()


if __name__ == "__main__":
    main()

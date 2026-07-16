#!/usr/bin/env python3
"""
fuel-supplement — Supplement intake tracking CLI

Usage:
  fuel supplement log [id] [dose]    Log a supplement
  fuel supplement list              List available supplements from catalog
  fuel supplement today             Show today's supplement intakes
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import typer
from wasabi import Printer
from pydantic import BaseModel, ConfigDict, Field, ValidationError
from rich.console import Console
from rich.table import Table

from .dates import resolve_flags as _resolve_date

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

# ── Validation (Pydantic) ──────────────────────────────────────────────────────

class SupplementInput(BaseModel):
    model_config = ConfigDict(validate_assignment=True)

    name: str = Field(..., min_length=1, description="Supplement name")
    dose: float | None = Field(None, ge=0, description="Dose amount")
    unit: str | None = Field(None, description="Unit (mg, g, etc.)")
    time_of_day: str | None = Field(None, description="morning, evening, night, any")
    notes: str = Field("", description="Optional notes")

# ── Pfade ──────────────────────────────────────────────────────────────────────

FUEL_DIR      = Path(os.environ.get("AOS_FUEL_DIR", Path.home() / ".aos" / "fuel"))
REPO_DIR      = Path(__file__).resolve().parent.parent
CATALOG_PATH  = REPO_DIR / "catalogs" / "supplements" / "catalog.yaml"
LOGS_DIR      = FUEL_DIR / "supplements" / "logs"

# ── Log I/O ────────────────────────────────────────────────────────────────────

def log_path(day: str) -> Path:
    return LOGS_DIR / f"{day}.json"

def read_log(day: str) -> dict:
    p = log_path(day)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except:
            pass
    return {"date": day, "intakes": []}

def write_log(day: str, data: dict) -> None:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    log_path(day).write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")

# ── Catalog ────────────────────────────────────────────────────────────────────

def load_catalog() -> dict[str, dict]:
    """Gibt {id: supplement_dict} zurück. Liest direkt aus dem Repo-Katalog.

    Kein HTTP-Call an den Node-Server — der Katalog liegt git-getrackt im
    Repo (CATALOG_PATH); ein laufender Server könnte in einem völlig anderen
    Arbeitsverzeichnis laufen (z.B. /opt/fuel bei Prod).
    """
    items = []
    if CATALOG_PATH.exists():
        try:
            import yaml
            data = yaml.safe_load(CATALOG_PATH.read_text())
            items = data.get("items", [])
        except Exception:
            try:
                data = json.loads(CATALOG_PATH.read_text())
                items = data.get("items", [])
            except Exception:
                pass
    return {item["id"]: item for item in items}

# ── Kern-Logik ─────────────────────────────────────────────────────────────────

def _make_id() -> str:
    import hashlib, time
    return "supp_" + hashlib.sha1(str(time.time()).encode()).hexdigest()[:12]

def do_interactive(target_day: str | None = None) -> None:
    """Interactive supplement selection via fzf."""
    catalog = load_catalog()
    if not catalog:
        msg.fail("Catalog ist leer")
        raise SystemExit(1)

    # Format items for fzf: "ID | Name | Default Dose"
    fzf_lines = []
    for sid, item in catalog.items():
        line = f"{sid:<15} | {item['name']:<30} | {item.get('default_dose', 0)}{item['unit']}"
        fzf_lines.append(line)

    try:
        header = "SUPPLEMENT AUSWÄHLEN"
        if target_day:
            header += f" ({target_day})"
        result = subprocess.run(
            ["fzf", "--header", header, "--height=15", "--layout=reverse"],
            input="\n".join(fzf_lines),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise SystemExit(0)

        selected_line = result.stdout.strip()
        if not selected_line:
            raise SystemExit(0)

        # Extract ID (first column before '|')
        selected_id = selected_line.split("|")[0].strip()

        do_log(selected_id, None, None, target_day)

    except FileNotFoundError:
        msg.fail("fzf nicht gefunden")
        raise SystemExit(1)


def do_log(supplement_id: str, dose: float | None, time_of_day: str | None, day: str | None) -> None:
    catalog = load_catalog()
    if supplement_id not in catalog:
        msg.fail(f"Unbekannt: {supplement_id}")
        raise SystemExit(1)

    supp   = catalog[supplement_id]
    today  = day or date.today().isoformat()
    dose   = dose if dose is not None else supp["default_dose"]
    tod    = time_of_day or supp.get("default_time_of_day", "any")
    unit   = supp["unit"]

    try:
        SupplementInput(name=supp["name"], dose=dose, unit=unit, time_of_day=tod)
    except ValidationError as e:
        msg.fail(f"Validation error: {e.error_count()} Fehler")
        raise SystemExit(1)

    intake = {
        "id": _make_id(),
        "supplement_id": supplement_id,
        "name": supp["name"],
        "dose": dose,
        "unit": unit,
        "time_of_day": tod,
        "notes": "",
        "time": datetime.now(timezone.utc).isoformat(),
    }

    # Direkter Dateizugriff statt HTTP — siehe load_catalog().
    log_data = read_log(today)
    log_data["intakes"].append(intake)
    write_log(today, log_data)

    msg.good(f"{supp['name']} {dose}{unit} ({tod}) geloggt — {today}")

def do_today(day: str | None) -> None:
    today = day or date.today().isoformat()
    intakes = read_log(today).get("intakes", [])

    if not intakes:
        console.print(f"[yellow]Keine Supplements geloggt am {today}[/yellow]")
        return

    st = Table(title=f"Supplements — {today}", show_header=True, header_style="bold blue")
    st.add_column("SUPPLEMENT", style="green")
    st.add_column("DOSIS",      style="cyan")
    st.add_column("ZEIT",       style="blue")

    for i in intakes:
        st.add_row(i["name"], f"{i['dose']}{i['unit']}", i["time_of_day"])
    console.print(st)

def do_unlog(day: str | None) -> None:
    target_day = day or date.today().isoformat()
    intakes = read_log(target_day).get("intakes", [])

    if not intakes:
        msg.warn(f"Keine Einträge am {target_day} zum Löschen.")
        return

    # If only one entry, maybe ask? Or just fzf always for safety
    fzf_lines = []
    for i in intakes:
        line = f"{i['id']} | {i['name']} ({i['dose']}{i['unit']}) @ {i['time_of_day']}"
        fzf_lines.append(line)

    try:
        result = subprocess.run(
            ["fzf", "--header", f"EINTRAG LÖSCHEN ({target_day})", "--height=15", "--layout=reverse"],
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

        log_data = read_log(target_day)
        log_data["intakes"] = [i for i in log_data["intakes"] if i["id"] != delete_id]
        write_log(target_day, log_data)
        msg.good(f"Eintrag {delete_id} gelöscht.")

    except FileNotFoundError:
        msg.fail("fzf nicht gefunden")
        raise SystemExit(1)

# ── Typer App ──────────────────────────────────────────────────────────────────

app = typer.Typer(help="Supplement Tracker CLI — ohne Subcommand: interaktiver Catalog-Browser (fzf)")

@app.command(name="unlog")
def unlog_command(
    tag:        str | None = typer.Option(None, "--tag", help="Datum: heute|gestern|vorgestern|-N|Mo|YYYY-MM-DD"),
    gestern:    bool       = typer.Option(False, "--gestern", "-g"),
    vorgestern: bool       = typer.Option(False, "--vorgestern"),
    day:        str | None = typer.Option(None, "--day", "-d", hidden=True),
) -> None:
    """Entferne einen Supplement-Eintrag interaktiv."""
    try:
        target = _resolve_date(tag=tag, gestern=gestern, vorgestern=vorgestern, day_legacy=day)
    except ValueError as e:
        msg.fail(str(e)); raise typer.Exit(1)
    do_unlog(target)

@app.callback(invoke_without_command=True)
def _app_callback(
    ctx: typer.Context,
    tag:        str | None = typer.Option(None, "--tag", help="Datum: heute|gestern|vorgestern|-N|Mo|YYYY-MM-DD"),
    gestern:    bool       = typer.Option(False, "--gestern", "-g"),
    vorgestern: bool       = typer.Option(False, "--vorgestern"),
    day:        str | None = typer.Option(None, "--day", "-d", hidden=True),
) -> None:
    if ctx.invoked_subcommand is None:
        try:
            target = _resolve_date(tag=tag, gestern=gestern, vorgestern=vorgestern, day_legacy=day)
        except ValueError as e:
            msg.fail(str(e)); raise typer.Exit(1)
        do_interactive(target)

@app.command(name="log")
def log_command(
    supplements: list[str]   = typer.Argument(..., help="Supplement-IDs (e.g. 'mag', 'zink')"),
    dose:       float | None = typer.Option(None, "--dose", "-v", help="Abweichende Dosis für das erste Supplement"),
    time:       str | None   = typer.Option(None, "--time", "-t", help="morning|evening|night|any"),
    tag:        str | None   = typer.Option(None, "--tag", help="Datum: heute|gestern|vorgestern|-N|Mo|YYYY-MM-DD"),
    gestern:    bool         = typer.Option(False, "--gestern", "-g"),
    vorgestern: bool         = typer.Option(False, "--vorgestern"),
    day:        str | None   = typer.Option(None, "--day", "-d", hidden=True),
) -> None:
    """Manuell ein oder mehrere Supplements loggen (ohne interaktives Menü)."""
    try:
        target = _resolve_date(tag=tag, gestern=gestern, vorgestern=vorgestern, day_legacy=day)
    except ValueError as e:
        msg.fail(str(e)); raise typer.Exit(1)
        
    for i, supp in enumerate(supplements):
        d = dose if i == 0 else None
        do_log(supp, d, time, target)

@app.command(name="list")
def list_supplements() -> None:
    """Katalog der verfügbaren Supplements anzeigen."""
    catalog = load_catalog()
    table = Table(title="Supplement Catalog", show_header=True, header_style="bold magenta")
    table.add_column("ID", style="cyan")
    table.add_column("NAME", style="green")
    table.add_column("DEFAULT", style="yellow")
    table.add_column("TIME", style="blue")

    for sid, s in catalog.items():
        table.add_row(sid, s["name"], f"{s.get('default_dose', 0)}{s.get('unit', '')}", s.get("default_time_of_day", "any"))
    console.print(table)

@app.command()
def today(
    tag:        str | None = typer.Option(None, "--tag", help="Datum: heute|gestern|vorgestern|-N|Mo|YYYY-MM-DD"),
    gestern:    bool       = typer.Option(False, "--gestern", "-g"),
    vorgestern: bool       = typer.Option(False, "--vorgestern"),
    day:        str | None = typer.Option(None, "--day", "-d", hidden=True),
):
    """Zeigt die geloggten Supplements für ein bestimmtes Datum an."""
    try:
        target = _resolve_date(tag=tag, gestern=gestern, vorgestern=vorgestern, day_legacy=day)
    except ValueError as e:
        msg.fail(str(e)); raise typer.Exit(1)
    do_today(target)

def main() -> None:
    app()

if __name__ == "__main__":
    main()

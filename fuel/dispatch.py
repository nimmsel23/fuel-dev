#!/usr/bin/env python3
"""
fuel — Typer-powered smart logging dispatcher.

Routing:
  fuel                               → kombiniertes Today (meal + supplement)
  fuel <supp_id> [opts]              → fuel-supplement <supp_id>
  fuel "<description>" [opts]        → fuel-meal log "<description>"
                                        (Catalog-Hit zuerst, Gemini nur bei Miss)
  fuel "<item1>" "<item2>" [opts]    → EIN Meal-Log, EIN Gemini-Call über
                                        beide Items (Gemini summiert selbst)
  fuel meal|supplement <subcmd>      → pass-through
  fuel today|list|unlog|sync ...     → eigene Sub-Commands

Datums-Flags (überall erkannt, auch gemischt mit anderen Flags):
  --gestern / -g          gestern
  --vorgestern            vorgestern
  --tag <wort|datum>      heute|gestern|vorgestern|-N|Mo|YYYY-MM-DD
  --day/-d <YYYY-MM-DD>   (legacy) explizites Datum
  -Nd                     Kurzform: N Tage zurück, z.B. -1d, -2d, -3d
  Datumswort im Freitext  "gestern hab ich X gegessen" — wird erkannt UND
                          aus der Beschreibung entfernt, wenn kein Flag
                          gesetzt ist (Fallback, kein Ersatz für Flags)

Tageszeit-Shortcuts (setzen meal_type für fuel-meal log):
  -morgen, -vormittag     → breakfast
  -mittag                 → lunch (= Standard)
  -nachmittag, -nacht     → snack
  -abend                  → dinner

Beispiele:
  fuel "Käsekrainer 330g"
  fuel "Käsekrainer 330g" "250g Reis" --gestern
  fuel "Toast mit Ei" -abend -1d
  fuel magnesium --abend
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

import typer

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

FUEL_REPO_DIR = Path(__file__).resolve().parent.parent

from .catalog import load_supplement_ids
from .dates import resolve as _resolve_date  # noqa: F401 — re-exposed for tests
from . import tui

# ── Direkte File-Zugriffe ─────────────────────────────────────────────────────

def _data_dir() -> Path:
    return Path(os.environ.get("AOS_FUEL_DATA_DIR", "~/.aos/fuel")).expanduser()

def _nutrition_dir() -> Path:
    return _data_dir() / "nutrition"

def _supplements_log_dir() -> Path:
    return _data_dir() / "supplements" / "logs"

def _read_nutrition(date_str: str) -> dict | None:
    f = _nutrition_dir() / f"{date_str}.json"
    return json.loads(f.read_text()) if f.exists() else None

def _read_supplements(date_str: str) -> dict | None:
    f = _supplements_log_dir() / f"{date_str}.json"
    return json.loads(f.read_text()) if f.exists() else None

def _try_http(fn_name: str, *args, **kwargs):
    from . import http as _http
    return getattr(_http, fn_name)(*args, **kwargs)

def _print_nutrition(data: dict) -> None:
    meals = data.get("meals", [])
    if not meals:
        print("  (keine Mahlzeiten)")
        return
    total_kcal = total_p = total_c = total_f = 0.0
    for m in meals:
        kcal = m.get("kcal", 0) or 0
        p = m.get("protein", 0) or 0
        c = m.get("carbs", 0) or 0
        f = m.get("fat", 0) or 0
        desc = m.get("description", "—")
        print(f"  {desc:<36} {kcal:>5.0f} kcal  {p:.0f}P {c:.0f}C {f:.0f}F")
        total_kcal += kcal; total_p += p; total_c += c; total_f += f
    print(f"  {'─'*60}")
    print(f"  {'Total':<36} {total_kcal:>5.0f} kcal  {total_p:.0f}P {total_c:.0f}C {total_f:.0f}F")
    water = data.get("water_ml")
    if water:
        print(f"  Wasser: {water} ml")

def _print_supplements(data: dict) -> None:
    intakes = data.get("intakes", [])
    if not intakes:
        print("  (keine Supplements)")
        return
    for s in intakes:
        name = s.get("name") or s.get("supplement_id", "—")
        dose = s.get("dose", "")
        unit = s.get("unit", "")
        tod = s.get("time_of_day", "")
        print(f"  {name:<24} {dose}{unit}  {tod}")

def _show_day(date_str: str) -> None:
    nutr = _read_nutrition(date_str)
    supps = _read_supplements(date_str)
    if nutr is None and supps is None:
        try:
            nutr = _try_http("nutrition_log", date_str)
            supps = _try_http("supplements_log", date_str)
        except Exception:
            msg.warn(f"Keine Daten für {date_str} (lokal + HTTP)")
            return
    msg.divider(f"MEALS  [{date_str}]")
    if nutr:
        _print_nutrition(nutr)
    else:
        print("  (keine Mahlzeiten)")
    msg.divider(f"SUPPLEMENTS  [{date_str}]")
    if supps:
        _print_supplements(supps)
    else:
        print("  (keine Supplements)")

app = typer.Typer(
    help=(
        "Fuel Centre Smart CLI.\n\n"
        "Meist NICHT über einen Subcommand aufgerufen, sondern direkt:\n\n"
        "  fuel \"Käsekrainer 330g\"                  → Meal loggen (Catalog-Hit "
        "oder Gemini-Schätzung)\n"
        "  fuel \"Item1\" \"Item2\" --gestern           → mehrere Items, ein Log, "
        "ein Gemini-Call\n"
        "  fuel magnesium                            → Supplement loggen "
        "(erkannt an bekannter ID)\n"
        "  fuel                                       → heutiges Log (Meals + "
        "Supplements)\n\n"
        "Datums-Flags: --gestern/-g, --vorgestern, --tag <wort>, --day/-d "
        "YYYY-MM-DD, -Nd (z.B. -1d, -2d)\n"
        "Tageszeit-Shortcuts: -morgen, -vormittag, -mittag, -nachmittag, "
        "-abend, -nacht (setzen meal_type)\n\n"
        "Subcommands unten sind für Spezialfälle (Catalog-Browser, Sync, "
        "Stats) — für den täglichen Log-Fall einfach 'fuel \"...\"' benutzen."
    ),
    no_args_is_help=False,
)

DATE_FLAGS = {"--gestern", "-g", "--vorgestern", "--tag", "--day", "-d"}
DATE_FLAGS_WITH_VALUE = {"--tag", "--day", "-d"}

TIME_OF_DAY_SHORTCUTS = {
    "-morgen": "breakfast", "-vormittag": "breakfast",
    "-mittag": "lunch",
    "-nachmittag": "snack", "-nacht": "snack",
    "-abend": "dinner",
}
_RELATIVE_DAY_RE = re.compile(r"^-(\d+)d$")


def _split_date_flags(args: list[str]) -> tuple[list[str], list[str]]:
    """Pull date-related flags out of args. Returns (date_flags, remaining)."""
    date_flags: list[str] = []
    rest: list[str] = []
    i = 0
    while i < len(args):
        a = args[i]
        if a in DATE_FLAGS_WITH_VALUE and i + 1 < len(args):
            date_flags.extend([a, args[i + 1]])
            i += 2
        elif a in DATE_FLAGS:
            date_flags.append(a)
            i += 1
        else:
            rest.append(a)
            i += 1
    return date_flags, rest


def _split_shortcut_flags(args: list[str]) -> tuple[str | None, list[str], list[str]]:
    """Erkennt -abend/-morgen/... (meal_type) und -Nd (Tage zurück).

    Returns (meal_type_or_None, date_flags_from_shortcuts, rest_ohne_shortcuts).
    """
    meal_type: str | None = None
    shortcut_date_flags: list[str] = []
    rest: list[str] = []
    for a in args:
        if a in TIME_OF_DAY_SHORTCUTS:
            meal_type = TIME_OF_DAY_SHORTCUTS[a]
            continue
        m = _RELATIVE_DAY_RE.match(a)
        if m:
            shortcut_date_flags = ["--tag", f"-{m.group(1)}"]
            continue
        rest.append(a)
    return meal_type, shortcut_date_flags, rest


def _first_non_flag(args: list[str]) -> str | None:
    for a in args:
        if not a.startswith("-"):
            return a
    return None


def show_combined_today(extra_args: list[str] | None = None) -> None:
    extra_args = extra_args or []
    if not extra_args:
        _show_day(str(date.today()))
    else:
        # Datums-Flags an Sub-CLIs weitergeben (z.B. --gestern)
        msg.divider("MEALS")
        subprocess.run([str(FUEL_REPO_DIR / "bin" / "fuel-meal"), "today", *extra_args])
        msg.divider("SUPPLEMENTS")
        subprocess.run([str(FUEL_REPO_DIR / "bin" / "fuel-supplement"), "today", *extra_args])


def _meal_log(description: str, extra_args: list[str], meal_type: str | None) -> int:
    """Delegiert an `fuel-meal log` OHNE vorab Gemini zu rufen.

    do_meal_log() in fuel-meal macht bereits Catalog-first → Gemini-Fallback
    (siehe fuel/catalog_lookup.py). Würde man hier schon --kcal mitgeben,
    triggert das den kcal==0-Branch dort nie — der Catalog-Check würde tot
    sein. Deshalb: nur die Beschreibung + Flags durchreichen, kein Makro-Call.
    --save-catalog default an, damit neu von Gemini geschätzte Items beim
    nächsten Mal ein Catalog-Hit sind (kein Gemini-Call mehr nötig).
    """
    cmd = [str(FUEL_REPO_DIR / "bin" / "fuel-meal"), "log", description, "--save-catalog"]
    if meal_type:
        cmd += ["--meal-type", meal_type]
    cmd += extra_args
    return subprocess.run(cmd).returncode


# ── Typer commands (explicit pass-through) ───────────────────────────────────

_PASSTHROUGH_CTX = {"allow_extra_args": True, "ignore_unknown_options": True, "help_option_names": []}


@app.command(context_settings=_PASSTHROUGH_CTX)
def meal(ctx: typer.Context):
    """Route to fuel-meal. '--help' geht an fuel-meal selbst (eigene Subcommands: log/narrative/list/today/unlog)."""
    subprocess.run([str(FUEL_REPO_DIR / "bin" / "fuel-meal"), *ctx.args])


@app.command(context_settings=_PASSTHROUGH_CTX)
def supplement(ctx: typer.Context):
    """Route to fuel-supplement. '--help' geht an fuel-supplement selbst (eigene Subcommands: log/list/unlog)."""
    subprocess.run([str(FUEL_REPO_DIR / "bin" / "fuel-supplement"), *ctx.args])


@app.command(context_settings={"allow_extra_args": True, "ignore_unknown_options": True})
def today(ctx: typer.Context):
    """Combined today (meals + supplements). Akzeptiert --gestern/--vorgestern/--tag."""
    show_combined_today(ctx.args)


@app.command()
def list():
    """List available supplements."""
    subprocess.run([str(FUEL_REPO_DIR / "bin" / "fuel-supplement"), "list"])


@app.command(context_settings=_PASSTHROUGH_CTX)
def unlog(ctx: typer.Context):
    """Unlog. Default: supplement. Mit --meal: Meal-unlog. '--help' geht an die jeweilige Sub-CLI."""
    args = list(ctx.args)
    if "--meal" in args:
        args.remove("--meal")
        subprocess.run([str(FUEL_REPO_DIR / "bin" / "fuel-meal"), "unlog", *args])
    else:
        subprocess.run([str(FUEL_REPO_DIR / "bin" / "fuel-supplement"), "unlog", *args])


@app.command()
def sync(
    direction: str = typer.Argument("push", help="push | pull"),
    uid: str = typer.Option(None, "--uid", help="Firebase UID (default: aktiver User)"),
):
    """Fuel-Daten ↔ Firestore synchronisieren (via fitness-dev/firestore)."""
    sys.path.insert(0, str(FUEL_REPO_DIR.parent / "fitness-dev"))
    try:
        from firestore.fuel import push_fuel, pull_fuel
        from firestore._db import UID as DEFAULT_UID
    except ImportError as e:
        typer.echo(f"❌ firestore Package nicht gefunden: {e}", err=True)
        raise typer.Exit(1)

    target_uid = uid or DEFAULT_UID
    if direction == "push":
        typer.echo(f"⬆  Push → Firestore (uid={target_uid})")
        result = push_fuel(target_uid)
        typer.echo(f"✅ {result['dates']} Tage · catalog: {result.get('catalog', '–')}")
    elif direction == "pull":
        typer.echo(f"⬇  Pull ← Firestore (uid={target_uid})")
        result = pull_fuel(target_uid)
        typer.echo(f"✅ nutrition: {result['nutrition']} · supplements: {result['supplements']}")
    else:
        typer.echo(f"❌ Unbekannte Richtung: {direction} (push | pull)", err=True)
        raise typer.Exit(1)


@app.command()
def get(day: str = typer.Argument(..., help="Datum (YYYY-MM-DD)")):
    """Tages-Log für ein bestimmtes Datum (direkt aus Dateien)."""
    _show_day(day)


@app.command()
def stats(days: int = typer.Option(7, "-d", "--days", help="Anzahl Tage")):
    """Aggregierte Makros der letzten N Tage (direkt aus Dateien)."""
    today_date = date.today()
    total_kcal = total_p = total_c = total_f = 0.0
    count = 0
    for i in range(days):
        d = today_date - timedelta(days=i)
        data = _read_nutrition(str(d))
        if not data:
            continue
        count += 1
        for m in data.get("meals", []):
            total_kcal += m.get("kcal", 0) or 0
            total_p += m.get("protein", 0) or 0
            total_c += m.get("carbs", 0) or 0
            total_f += m.get("fat", 0) or 0
    if count == 0:
        msg.warn(f"Keine Nutrition-Logs in den letzten {days} Tagen gefunden")
        return
    avg_kcal = total_kcal / count
    avg_p = total_p / count
    avg_c = total_c / count
    avg_f = total_f / count
    print(f"  Letzte {days} Tage: {count} Logs")
    print(f"  Total: {total_kcal:.0f} kcal  {total_p:.0f}P {total_c:.0f}C {total_f:.0f}F")
    print(f"  Schnitt: {avg_kcal:.0f} kcal  {avg_p:.0f}P {avg_c:.0f}C {avg_f:.0f}F")


@app.command(context_settings={"allow_extra_args": True, "ignore_unknown_options": True})
def edit(
    ctx: typer.Context,
    mode: str = typer.Option(None, "--mode", "-m", help="catalog | log (default: ncurses für heute)"),
    date_arg: str = typer.Option(None, "--date", "-d", help="Datum für Log-Edit (YYYY-MM-DD)"),
):
    """Interactive Nutrition Editor.

    Default (keine Argumente): ncurses TUI mit allen Einträgen von heute (schnelle Batch-Edit)
    fuel edit catalog: gum-Menü zum Catalog editieren
    fuel edit log [DATUM]: gum-Menü zum Log editieren
    """
    # Allow positional arguments like: fuel edit catalog
    if ctx.args and not mode:
        first_arg = ctx.args[0]
        if first_arg in ("catalog", "log"):
            mode = first_arg
        if first_arg and first_arg not in ("catalog", "log") and len(ctx.args) > 1:
            # Treat as: fuel edit log DATUM
            if ctx.args[0] == "log":
                date_arg = ctx.args[1]
                mode = "log"

    tui.edit(mode=mode, target_date=date_arg)


# Known Typer-Subcommands aus der App ableiten — kein hardcoded set mehr.
def _known_commands() -> set[str]:
    names = set()
    for c in app.registered_commands:
        names.add(c.name or (c.callback.__name__ if c.callback else None))
    names.discard(None)
    return names | {"--help", "-h"}


def main() -> None:
    argv = sys.argv[1:]

    if not argv:
        show_combined_today()
        return

    # --help/-h MUSS immer Typer erreichen — sonst greift weiter unten das
    # Smart-Routing (Datums-Flags rausziehen, Rest als Item behandeln), das
    # "--help" als reines Flag ignoriert und mangels Item einfach "today"
    # zeigt. Damit war --help faktisch nie erreichbar.
    if "--help" in argv or "-h" in argv:
        app()
        return

    known = _known_commands()
    first_token = _first_non_flag(argv)

    if first_token in known:
        app()
        return

    # Smart-Routing: Datums-Flags + Shortcuts (-abend, -1d, ...) rausziehen,
    # dann erstes Non-Flag klassifizieren.
    date_flags, rest = _split_date_flags(argv)
    meal_type, shortcut_date_flags, rest = _split_shortcut_flags(rest)
    # Explizite --tag/--gestern/etc. haben Vorrang vor -Nd-Shortcuts.
    if not date_flags and shortcut_date_flags:
        date_flags = shortcut_date_flags
    target = _first_non_flag(rest)

    if not target:
        # Nur Flags, kein Item — als Today interpretieren
        show_combined_today(date_flags)
        return

    supp_ids = load_supplement_ids()
    if target in supp_ids:
        # Erstes Item ist Supplement → fuel-supplement log <items> <flags>
        supps = [a for a in rest if a in supp_ids]
        other = [a for a in rest if a not in supp_ids]
        subprocess.run([str(FUEL_REPO_DIR / "bin" / "fuel-supplement"), "log", *supps, *other, *date_flags])
        return

    # NL-Mahlzeitbeschreibung(en) → EIN Meal-Log. Mehrere Quoted-Args werden
    # zu einem Text zusammengefügt — Gemini summiert Komponenten selbst
    # (siehe PROMPT_TEMPLATE Punkt 3 in fuel/gemini.py).
    description = " ".join(rest)
    sys.exit(_meal_log(description, date_flags, meal_type))


if __name__ == "__main__":
    main()

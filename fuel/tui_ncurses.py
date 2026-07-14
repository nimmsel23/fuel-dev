#!/usr/bin/env python3
"""ncurses TUI for daily meal editing."""

import curses
import json
from datetime import date
from pathlib import Path

try:
    from wasabi import Printer
    msg = Printer()
except ImportError:
    class _P:
        def divider(self, t): print(f"\n--- {t} ---\n")
        def warn(self, t): print(f"[warn] {t}")
        def fail(self, t): print(f"[fail] {t}")
        def info(self, t): print(f"[info] {t}")
        def good(self, t): print(f"[ok] {t}")
    msg = _P()


def _data_dir() -> Path:
    import os
    return Path(os.environ.get("AOS_FUEL_DATA_DIR", "~/.aos/fuel")).expanduser()


def _nutrition_dir() -> Path:
    return _data_dir() / "nutrition"


def _lookup_nutrition(name: str) -> dict | None:
    """Lookup nutrition data: wger (with fallback to OFF)."""
    from .sources.wger import search_ingredient as wger_search
    from .sources.off import search_ingredient as off_search

    try:
        result = wger_search(name, limit=1, timeout=3)
        if result:
            return result
    except Exception:
        pass

    try:
        result = off_search(name, limit=1, timeout=5)
        if result:
            return result
    except Exception:
        pass

    return None


class MealEditor:
    def __init__(self, target_date: str | None = None):
        self.target_date = target_date or str(date.today())
        self.log_file = _nutrition_dir() / f"{self.target_date}.json"
        self.data = None
        self.meals = []
        self.selected_idx = 0
        self.modified = False
        self.load_data()

    def load_data(self):
        """Load log file for target date."""
        if not self.log_file.exists():
            raise FileNotFoundError(f"Keine Einträge für {self.target_date}")

        try:
            self.data = json.loads(self.log_file.read_text())
            self.meals = self.data.get("meals", [])
        except json.JSONDecodeError:
            raise ValueError(f"Fehler beim Laden von {self.log_file}")

    def save_data(self):
        """Save log file."""
        import time
        self.data["_local_mtime"] = int(time.time() * 1000)
        self.log_file.write_text(json.dumps(self.data, indent=2, ensure_ascii=False))
        self.modified = False

    def format_meal(self, meal: dict, width: int = 100) -> str:
        """Format meal for display."""
        desc = meal.get("description", "unnamed")[:40]
        time_str = meal.get("time", "").split("T")[1][:5] if "T" in meal.get("time", "") else "?"
        kcal = meal.get("kcal", 0)
        return f"{time_str} │ {desc:<40} │ {kcal:>5.0f} kcal"

    def run(self, stdscr):
        """Main ncurses loop."""
        curses.curs_set(0)  # Hide cursor
        stdscr.clear()

        # Colors
        curses.init_pair(1, curses.COLOR_BLACK, curses.COLOR_WHITE)  # Selected
        curses.init_pair(2, curses.COLOR_GREEN, curses.COLOR_BLACK)  # Status
        curses.init_pair(3, curses.COLOR_YELLOW, curses.COLOR_BLACK)  # Modified
        curses.init_pair(4, curses.COLOR_RED, curses.COLOR_BLACK)    # Error

        while True:
            stdscr.clear()
            height, width = stdscr.getmaxyx()

            # Header
            header = f"Nutrition Log Editor — {self.target_date}"
            stdscr.addstr(0, 0, header, curses.A_BOLD)
            status = "[M]odified" if self.modified else ""
            stdscr.addstr(0, width - len(status) - 1, status, curses.color_pair(3))

            # Instructions
            stdscr.addstr(1, 0, "↑↓ Navigate │ Enter Edit │ L Lookup │ D Delete │ S Save │ Q Quit")

            # Meals list
            for i, meal in enumerate(self.meals):
                y = 3 + i
                if y >= height - 2:
                    break

                formatted = self.format_meal(meal)
                if i == self.selected_idx:
                    stdscr.addstr(y, 0, formatted, curses.color_pair(1))
                else:
                    stdscr.addstr(y, 0, formatted)

            # Footer
            if self.meals:
                total_kcal = sum(m.get("kcal", 0) or 0 for m in self.meals)
                total_p = sum(m.get("protein", 0) or 0 for m in self.meals)
                total_c = sum(m.get("carbs", 0) or 0 for m in self.meals)
                total_f = sum(m.get("fat", 0) or 0 for m in self.meals)
                footer = f"Total: {total_kcal:.0f} kcal │ {total_p:.0f}P {total_c:.0f}C {total_f:.0f}F"
                stdscr.addstr(height - 2, 0, footer, curses.color_pair(2))

            stdscr.refresh()

            # Input
            try:
                ch = stdscr.getch()
            except KeyboardInterrupt:
                ch = ord('q')

            if ch == ord('q'):
                if self.modified:
                    stdscr.addstr(height - 1, 0, "Unsaved changes! (S)ave or (Q)uit? ", curses.color_pair(4))
                    stdscr.refresh()
                    if stdscr.getch() == ord('s'):
                        self.save_data()
                        break
                    elif stdscr.getch() == ord('q'):
                        break
                else:
                    break

            elif ch == ord('s'):
                self.save_data()
                stdscr.addstr(height - 1, 0, "Saved!", curses.color_pair(2))
                stdscr.refresh()
                stdscr.getch()

            elif ch == curses.KEY_UP:
                if self.selected_idx > 0:
                    self.selected_idx -= 1

            elif ch == curses.KEY_DOWN:
                if self.selected_idx < len(self.meals) - 1:
                    self.selected_idx += 1

            elif ch == ord('\n') or ch == ord('e'):  # Enter or E
                self.edit_meal(stdscr, self.selected_idx)

            elif ch == ord('l'):  # L for Lookup
                self.lookup_meal(stdscr, self.selected_idx)

            elif ch == ord('d'):  # D for Delete
                self.delete_meal(stdscr, self.selected_idx)

    def edit_meal(self, stdscr, idx):
        """Edit a meal's fields."""
        meal = self.meals[idx]
        height, width = stdscr.getmaxyx()

        editable_fields = ["description", "kcal", "protein", "carbs", "fat", "notes", "meal_type"]
        field_idx = 0

        while True:
            stdscr.clear()
            stdscr.addstr(0, 0, f"Edit Meal #{idx + 1}", curses.A_BOLD)
            stdscr.addstr(1, 0, "Tab/Shift+Tab Navigate │ Enter Edit │ Esc Done")

            y = 3
            for i, field in enumerate(editable_fields):
                if field in meal:
                    current = str(meal[field])
                    prefix = ">>> " if i == field_idx else "    "
                    line = f"{prefix}{field:<12}: {current}"
                    if i == field_idx:
                        stdscr.addstr(y, 0, line, curses.color_pair(1))
                    else:
                        stdscr.addstr(y, 0, line)
                    y += 1

            stdscr.refresh()

            try:
                ch = stdscr.getch()
            except KeyboardInterrupt:
                break

            if ch == 27 or ch == ord('q'):  # ESC or Q
                break

            elif ch == ord('\t'):  # Tab
                field_idx = (field_idx + 1) % len(editable_fields)

            elif curses.KEY_BTAB or (ch == curses.KEY_STAB):  # Shift+Tab
                field_idx = (field_idx - 1) % len(editable_fields)

            elif ch == ord('\n'):  # Enter
                field = editable_fields[field_idx]
                current = str(meal.get(field, ""))
                # Simple input (not perfect in ncurses, but works)
                curses.echo()
                curses.curs_set(1)
                stdscr.addstr(height - 1, 0, f"{field}: [{current}] > ")
                stdscr.refresh()
                new_val = stdscr.getstr(height - 1, len(f"{field}: [{current}] > ")).decode()
                curses.noecho()
                curses.curs_set(0)

                if new_val:
                    if field in ("kcal", "protein", "carbs", "fat"):
                        try:
                            meal[field] = float(new_val)
                        except ValueError:
                            meal[field] = new_val
                    else:
                        meal[field] = new_val
                    self.modified = True

    def lookup_meal(self, stdscr, idx):
        """Lookup nutrition for a meal from wger/OFF."""
        meal = self.meals[idx]
        height, width = stdscr.getmaxyx()

        search_term = meal.get("description", "")
        stdscr.addstr(height - 1, 0, f"Searching for: {search_term}...", curses.color_pair(2))
        stdscr.refresh()

        nutrition = _lookup_nutrition(search_term)
        if not nutrition:
            stdscr.addstr(height - 1, 0, "No nutrition data found.", curses.color_pair(4))
            stdscr.refresh()
            stdscr.getch()
            return

        # Show result and ask to confirm
        stdscr.clear()
        stdscr.addstr(0, 0, f"Lookup Result for: {search_term}", curses.A_BOLD)
        y = 2
        stdscr.addstr(y, 0, f"  Name:    {nutrition['name']}")
        y += 1
        stdscr.addstr(y, 0, f"  kcal:    {nutrition['energy_kcal']}")
        y += 1
        stdscr.addstr(y, 0, f"  protein: {nutrition['protein']}g")
        y += 1
        stdscr.addstr(y, 0, f"  carbs:   {nutrition['carbs']}g")
        y += 1
        stdscr.addstr(y, 0, f"  fat:     {nutrition['fat']}g")
        y += 2
        stdscr.addstr(y, 0, "Accept? (Y)es / (N)o", curses.color_pair(3))
        stdscr.refresh()

        if stdscr.getch() == ord('y'):
            meal["kcal"] = nutrition["energy_kcal"]
            meal["protein"] = nutrition["protein"]
            meal["carbs"] = nutrition["carbs"]
            meal["fat"] = nutrition["fat"]
            self.modified = True
            stdscr.addstr(y + 2, 0, "Accepted!", curses.color_pair(2))
            stdscr.refresh()
            stdscr.getch()

    def delete_meal(self, stdscr, idx):
        """Delete a meal."""
        height, width = stdscr.getmaxyx()
        stdscr.addstr(height - 1, 0, f"Delete meal #{idx + 1}? (Y)es / (N)o", curses.color_pair(4))
        stdscr.refresh()

        if stdscr.getch() == ord('y'):
            self.meals.pop(idx)
            if self.selected_idx >= len(self.meals) and self.selected_idx > 0:
                self.selected_idx -= 1
            self.modified = True


def edit_daily(target_date: str | None = None) -> None:
    """Open ncurses TUI for daily meal editing."""
    try:
        editor = MealEditor(target_date)
        curses.wrapper(editor.run)
        msg.good("Done!")
    except FileNotFoundError as e:
        msg.fail(str(e))
    except ValueError as e:
        msg.fail(str(e))
    except Exception as e:
        msg.fail(f"Error: {e}")

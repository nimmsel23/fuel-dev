"""Filesystem roots shared by the Fuel package entry points."""

from __future__ import annotations

import os
from pathlib import Path

from .env import load_env_file, load_fuel_env

REPO_DIR = Path(os.environ.get("FUEL_REPO_DIR", Path(__file__).resolve().parent.parent)).expanduser()
load_env_file(REPO_DIR / ".env")
load_fuel_env()
if not os.environ.get("AOS_FUEL_DATA_DIR") and os.environ.get("AOS_FUEL_DIR"):
    os.environ["AOS_FUEL_DATA_DIR"] = os.environ["AOS_FUEL_DIR"]

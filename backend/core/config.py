import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
load_dotenv(Path.home() / ".env" / "fuel.env", override=False)

# Pfad an backend/ selbst ankern statt an cwd — sonst wandert backend.db je
# nachdem von wo der Prozess gestartet wird (z.B. WorkingDirectory=/opt/...).
_BACKEND_DIR = Path(__file__).resolve().parent.parent

class Config:
    # Database Configuration
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_BACKEND_DIR / 'backend.db'}")

    # Gemini Configuration
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

config = Config()

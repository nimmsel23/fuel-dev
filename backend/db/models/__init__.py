from backend.db.database import Base
from backend.db.models.food import FoodLog
from backend.db.models.supplements import SupplementLog
from backend.db.models.journal import DailyJournal, FuelFrame
from backend.db.models.catalog import MealCatalogItem, SupplementCatalogItem

# Alle Modelle hier importieren, damit Alembic sie findet
__all__ = [
    "Base",
    "FoodLog",
    "SupplementLog",
    "DailyJournal",
    "FuelFrame",
    "MealCatalogItem",
    "SupplementCatalogItem",
]

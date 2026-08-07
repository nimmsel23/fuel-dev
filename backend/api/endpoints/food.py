from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from pydantic import BaseModel
from backend.db.database import get_db
from backend.db.models.journal import DailyJournal
from backend.db.models.catalog import MealCatalogItem
from backend.core.llm import extract_macros_from_text
from backend.core.catalog import find_meal, resolve_catalog_item, generate_meal_id
from backend.schemas.catalog import MealCatalogUpsert, MealCatalogItemOut
from datetime import date, datetime, timezone

router = APIRouter()

class FoodLogRequest(BaseModel):
    text: str | None = None
    date: str | None = None
    catalog_item_id: str | None = None
    catalog_addon_ids: list[str] | None = None

class FoodLogPatchRequest(BaseModel):
    date: str | None = None
    meal_id: str  # Eindeutige ID des Meal-Eintrags
    meal: dict | None = None  # Teilweise Updates erlaubt
    new_date: str | None = None  # Auf ein anderes Datum verschieben

class JournalRequest(BaseModel):
    date: str | None = None
    content: str = ""

class NutritionCatalogPost(BaseModel):
    item: MealCatalogUpsert

@router.post("/log")
def log_food(request: FoodLogRequest, db: Session = Depends(get_db)):
    target_date = request.date or date.today().isoformat()
    journal = db.query(DailyJournal).filter(DailyJournal.date == target_date).first()

    if not journal:
        journal = DailyJournal(date=target_date, food_logs=[], habits=[], notes=[])
        db.add(journal)
        db.commit()
        db.refresh(journal)

    micros: dict = {}

    if request.catalog_item_id:
        # Stammdaten-Treffer: Makros direkt aus dem Katalog übernehmen, kein Gemini-Call.
        item = db.query(MealCatalogItem).filter(MealCatalogItem.id == request.catalog_item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Catalog item not found")
        resolved = resolve_catalog_item(item, request.catalog_addon_ids)
        meal_dict = {
            "id": f"meal_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "original_text": resolved["description"],
            "name": resolved["description"],
            "description": resolved["description"],
            "ingredients": [],
            "calories": resolved["kcal"],
            "protein": resolved["protein"],
            "carbs": resolved["carbs"],
            "fat": resolved["fat"],
            "fiber": None,
            "sugar": None,
            "catalog_id": resolved["catalog_id"],
            "logged_at": datetime.now(timezone.utc).isoformat(),
        }
    else:
        if not request.text or not request.text.strip():
            raise HTTPException(status_code=400, detail="text or catalog_item_id required")

        # Fuzzy-Catalog-Lookup vor jedem Gemini-Call — spart Calls bei wiederkehrenden Eingaben.
        hit = find_meal(request.text, db)
        if hit:
            resolved = resolve_catalog_item(hit)
            meal_dict = {
                "id": f"meal_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
                "original_text": request.text,
                "name": resolved["description"],
                "description": resolved["description"],
                "ingredients": [],
                "calories": resolved["kcal"],
                "protein": resolved["protein"],
                "carbs": resolved["carbs"],
                "fat": resolved["fat"],
                "fiber": None,
                "sugar": None,
                "catalog_id": resolved["catalog_id"],
                "logged_at": datetime.now(timezone.utc).isoformat(),
            }
        else:
            try:
                meal_entry = extract_macros_from_text(request.text)
            except Exception as e:
                raise HTTPException(status_code=500, detail=str(e))

            meal_dict = {
                "id": f"meal_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
                "original_text": request.text,
                "name": meal_entry.name,
                "description": meal_entry.description,
                "ingredients": meal_entry.ingredients,
                "calories": meal_entry.macros.calories,
                "protein": meal_entry.macros.protein,
                "carbs": meal_entry.macros.carbs,
                "fat": meal_entry.macros.fat,
                "fiber": meal_entry.macros.fiber,
                "sugar": meal_entry.macros.sugar,
                "logged_at": datetime.now(timezone.utc).isoformat(),
                # micros werden absichtlich nicht pro Mahlzeit gespeichert (Speicheroptimierung),
                # da sie in micros_sum auf Dokumentebene aggregiert werden.
            }
            if meal_entry.micros:
                micros = meal_entry.micros.model_dump()

    # anfügen und flaggen
    journal.food_logs.append(meal_dict)
    flag_modified(journal, "food_logs")

    # Firestore-Optimierung: Micros sofort auf Dokumentebene summieren
    if not journal.micros_sum:
        journal.micros_sum = {}

    for k, v in micros.items():
        if v:
            journal.micros_sum[k] = journal.micros_sum.get(k, 0) + v
    flag_modified(journal, "micros_sum")

    db.commit()
    db.refresh(journal)

    return {"status": "success", "meal": meal_dict}

@router.get("/log")
def get_food_logs(date: str = Query(default_factory=lambda: date.today().isoformat()), db: Session = Depends(get_db)):
    journal = db.query(DailyJournal).filter(DailyJournal.date == date).first()

    meals = journal.food_logs if journal else []
    water = journal.water_ml if journal else 0

    # The frontend expects { data: { meals: [...] } } based on `const meals = nutrition?.meals || [];`
    return {"status": "success", "data": {"meals": meals, "water_ml": water}}


@router.get("/catalog")
def list_meal_catalog(db: Session = Depends(get_db)):
    items = db.query(MealCatalogItem).order_by(MealCatalogItem.name).all()
    return {"ok": True, "items": [MealCatalogItemOut.model_validate(i).model_dump() for i in items]}


@router.post("/catalog")
def upsert_meal_catalog(request: NutritionCatalogPost, db: Session = Depends(get_db)):
    data = request.item
    item_id = generate_meal_id(data.name, db)
    item = MealCatalogItem(
        id=item_id,
        kind="meal",
        name=data.name,
        description=data.description or data.name,
        kcal=data.kcal,
        protein=data.protein,
        carbs=data.carbs,
        fat=data.fat,
        source="manual",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"ok": True, "item": MealCatalogItemOut.model_validate(item).model_dump()}


@router.delete("/catalog/{item_id}")
def delete_meal_catalog(item_id: str, db: Session = Depends(get_db)):
    item = db.query(MealCatalogItem).filter(MealCatalogItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


# ============ Phase 2a: Meal-Editing (PATCH) ============

@router.patch("/log")
def patch_meal_log(request: FoodLogPatchRequest, db: Session = Depends(get_db)):
    """PATCH /nutrition/log

    Bestehenden Food-Log-Eintrag bearbeiten oder auf ein anderes Datum verschieben.
    Request: {date?, meal_id, meal?, new_date?}
    Response: {ok, meal}
    """
    target_date = request.date or date.today().isoformat()
    new_date = request.new_date or target_date

    journal = db.query(DailyJournal).filter(DailyJournal.date == target_date).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Journal for date not found")

    # Meal in der bestehenden Liste finden
    meal_idx = None
    for idx, meal in enumerate(journal.food_logs):
        if meal.get("id") == request.meal_id:
            meal_idx = idx
            break

    if meal_idx is None:
        raise HTTPException(status_code=404, detail="Meal not found")

    # Update durchführen
    updated_meal = journal.food_logs[meal_idx].copy()
    if request.meal:
        updated_meal.update(request.meal)

    # Falls new_date != target_date: Meal auf ein anderes Datum verschieben
    if new_date != target_date:
        # Auf das neue Datum-Journal verweisen
        new_journal = db.query(DailyJournal).filter(DailyJournal.date == new_date).first()
        if not new_journal:
            new_journal = DailyJournal(date=new_date, food_logs=[], habits=[], notes=[])
            db.add(new_journal)
            db.commit()
            db.refresh(new_journal)

        # Von altem Datum entfernen
        journal.food_logs.pop(meal_idx)
        flag_modified(journal, "food_logs")

        # Zum neuen Datum hinzufügen
        new_journal.food_logs.append(updated_meal)
        flag_modified(new_journal, "food_logs")
    else:
        # Im gleichen Datum-Journal updaten
        journal.food_logs[meal_idx] = updated_meal
        flag_modified(journal, "food_logs")

    db.commit()
    return {"ok": True, "meal": updated_meal}


# ============ Phase 1a+1b: Freitext-Tagebuch (nutrition/journal) ============

@router.get("/journal")
def get_journal(date_str: str = Query(default_factory=lambda: date.today().isoformat()), db: Session = Depends(get_db)):
    """GET /nutrition/journal?date=YYYY-MM-DD

    Freitext-Tagebucheintrag für einen Tag auslesen.
    Response: {ok, date, content} — content ist leerer String falls kein Eintrag vorhanden.
    """
    journal = db.query(DailyJournal).filter(DailyJournal.date == date_str).first()
    content = journal.journal_text if journal and journal.journal_text else ""
    return {"ok": True, "date": date_str, "content": content}


@router.post("/journal")
def post_journal(request: JournalRequest, db: Session = Depends(get_db)):
    """POST /nutrition/journal

    Freitext-Tagebucheintrag für einen Tag speichern.
    Request: {date?, content}
    Response: {ok, date}
    """
    target_date = request.date or date.today().isoformat()

    journal = db.query(DailyJournal).filter(DailyJournal.date == target_date).first()
    if not journal:
        journal = DailyJournal(date=target_date, food_logs=[], habits=[], notes=[])
        db.add(journal)
        db.commit()
        db.refresh(journal)

    journal.journal_text = request.content or ""
    flag_modified(journal, "journal_text")
    db.commit()

    return {"ok": True, "date": target_date}


@router.get("/journal/list")
def list_journal_entries(db: Session = Depends(get_db)):
    """GET /nutrition/journal/list

    Alle vorhandenen Tagebucheinträge auflisten (neueste zuerst).
    Response: {ok, entries: [{name, date}, ...]}
    """
    journals = db.query(DailyJournal)\
        .filter(DailyJournal.journal_text != '')\
        .order_by(DailyJournal.date.desc())\
        .all()

    entries = [{"name": f"{j.date}.md", "date": j.date} for j in journals]
    return {"ok": True, "entries": entries}

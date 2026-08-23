from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from backend.db.database import get_db
from backend.db.models.journal import DailyJournal
from backend.db.models.catalog import SupplementCatalogItem
from backend.core.catalog import generate_supplement_id
from backend.core.llm import estimate_supplement_from_text
from backend.schemas.catalog import SupplementCatalogUpsert, SupplementCatalogItemOut, SupplementEstimateRequest
from datetime import date, datetime, timezone, timedelta
from pydantic import BaseModel

router = APIRouter()


class SupplementLogRequest(BaseModel):
    date: str | None = None
    intake: dict | None = None
    delete_id: str | None = None
    supplement_id: str | None = None
    name: str | None = None
    dose: float | None = None
    unit: str | None = None
    time_of_day: str | None = None
    notes: str | None = None


class SupplementLogPatchRequest(BaseModel):
    date: str | None = None
    intake_id: str  # ID des Habit-Eintrags
    updates: dict  # Teilweise Updates: {name?, dose?, unit?, time_of_day?, notes?}


@router.post("/log")
def log_supplement(request: SupplementLogRequest, db: Session = Depends(get_db)):
    target_date = request.date or date.today().isoformat()
    intake_input = request.intake or {
        "supplement_id": request.supplement_id,
        "name": request.name,
        "dose": request.dose,
        "unit": request.unit,
        "time_of_day": request.time_of_day,
        "notes": request.notes,
    }

    if request.delete_id:
        journal = db.query(DailyJournal).filter(DailyJournal.date == target_date).first()
        if journal:
            before = len(journal.habits)
            journal.habits = [h for h in journal.habits if h.get("id") != request.delete_id]
            if len(journal.habits) != before:
                flag_modified(journal, "habits")
                db.commit()
                db.refresh(journal)
                intakes = [h for h in journal.habits if h.get("type") == "supplement"]
                return {"ok": True, "data": {"date": target_date, "intakes": intakes}}

        journals = db.query(DailyJournal).all()
        for journal in journals:
            before = len(journal.habits)
            journal.habits = [h for h in journal.habits if h.get("id") != request.delete_id]
            if len(journal.habits) != before:
                flag_modified(journal, "habits")
                db.commit()
                db.refresh(journal)
                intakes = [h for h in journal.habits if h.get("type") == "supplement"]
                return {"ok": True, "data": {"date": journal.date, "intakes": intakes}}
        raise HTTPException(status_code=404, detail="Intake not found")

    if not intake_input.get("supplement_id") and not intake_input.get("name"):
        raise HTTPException(status_code=400, detail="intake missing")

    journal = db.query(DailyJournal).filter(DailyJournal.date == target_date).first()

    if not journal:
        journal = DailyJournal(date=target_date, food_logs=[], habits=[], notes=[])
        db.add(journal)
        db.commit()
        db.refresh(journal)

    catalog_item = None
    if intake_input.get("supplement_id"):
        catalog_item = db.query(SupplementCatalogItem).filter(SupplementCatalogItem.id == intake_input["supplement_id"]).first()
    if not catalog_item and intake_input.get("name"):
        catalog_item = db.query(SupplementCatalogItem).filter(SupplementCatalogItem.name == intake_input["name"]).first()

    habit_dict = {
        "id": f"supp_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "type": "supplement",
        "supplement_id": intake_input.get("supplement_id") or (catalog_item.id if catalog_item else None),
        "name": intake_input.get("name") or (catalog_item.name if catalog_item else None),
        "dose": intake_input.get("dose") if intake_input.get("dose") is not None else 0,
        "unit": intake_input.get("unit") or (catalog_item.unit if catalog_item else "mg"),
        "time_of_day": intake_input.get("time_of_day") or "any",
        "notes": intake_input.get("notes") or "",
    }
    journal.habits.append(habit_dict)
    flag_modified(journal, "habits")

    if not journal.micros_sum:
        journal.micros_sum = {}
    if habit_dict["name"]:
        journal.micros_sum[habit_dict["name"]] = journal.micros_sum.get(habit_dict["name"], 0) + habit_dict["dose"]
        flag_modified(journal, "micros_sum")

    db.commit()
    db.refresh(journal)

    intakes = [h for h in journal.habits if h.get("type") == "supplement"]
    return {"ok": True, "supplement": habit_dict, "data": {"date": target_date, "intakes": intakes}}


@router.get("/log")
def get_supplement_logs(date: str = Query(default_factory=lambda: date.today().isoformat()), db: Session = Depends(get_db)):
    journal = db.query(DailyJournal).filter(DailyJournal.date == date).first()

    habits = journal.habits if journal else []
    intakes = [h for h in habits if h.get("type") == "supplement"]

    return {"ok": True, "data": {"date": date, "intakes": intakes}}


@router.delete("/log/{delete_id}")
def delete_supplement_log(delete_id: str, db: Session = Depends(get_db)):
    # Frontend schickt kein Datum mit (deleteJson(`/supplements/log/${delete_id}`)) —
    # ueber alle Journale suchen, ids sind Millisekunden-Timestamps und damit
    # praktisch eindeutig; Datenmenge pro Nutzer ist klein genug fuer Full-Scan.
    journals = db.query(DailyJournal).all()
    for journal in journals:
        before = len(journal.habits)
        remaining = [h for h in journal.habits if h.get("id") != delete_id]
        if len(remaining) != before:
            journal.habits = remaining
            flag_modified(journal, "habits")
            db.commit()
            return {"ok": True}
    raise HTTPException(status_code=404, detail="Intake not found")


# ============ Phase 2b: Supplement-Editing (PATCH) ============

@router.patch("/log")
def patch_supplement_log(request: SupplementLogPatchRequest, db: Session = Depends(get_db)):
    """PATCH /supplements/log

    Bestehenden Supplement-Log-Eintrag bearbeiten.
    Request: {date?, intake_id, updates: {name?, dose?, ...}}
    Response: {ok, data: {...updated journal}}
    """
    target_date = request.date or date.today().isoformat()

    journal = db.query(DailyJournal).filter(DailyJournal.date == target_date).first()
    if not journal:
        raise HTTPException(status_code=404, detail="Journal for date not found")

    # Habit in der bestehenden Liste finden
    habit_idx = None
    for idx, habit in enumerate(journal.habits):
        if habit.get("id") == request.intake_id and habit.get("type") == "supplement":
            habit_idx = idx
            break

    if habit_idx is None:
        raise HTTPException(status_code=404, detail="Intake not found")

    # Update durchführen
    updated_habit = journal.habits[habit_idx].copy()
    updated_habit.update(request.updates)
    journal.habits[habit_idx] = updated_habit
    flag_modified(journal, "habits")

    db.commit()
    db.refresh(journal)

    intakes = [h for h in journal.habits if h.get("type") == "supplement"]
    return {"ok": True, "data": {"date": target_date, "intakes": intakes}}


@router.get("/catalog")
def list_supplement_catalog(db: Session = Depends(get_db)):
    items = db.query(SupplementCatalogItem).order_by(SupplementCatalogItem.name).all()
    return {"ok": True, "items": [SupplementCatalogItemOut.model_validate(i).model_dump() for i in items]}


@router.post("/catalog")
def upsert_supplement_catalog(request: SupplementCatalogUpsert, db: Session = Depends(get_db)):
    item_id = request.id or generate_supplement_id(request.name, db)
    item = db.query(SupplementCatalogItem).filter(SupplementCatalogItem.id == item_id).first()

    if item:
        item.name = request.name
        item.product = request.product
        item.unit = request.unit
        item.default_dose = request.default_dose
        item.default_time_of_day = request.default_time_of_day
        item.micros = request.micros
    else:
        item = SupplementCatalogItem(
            id=item_id,
            name=request.name,
            product=request.product,
            unit=request.unit,
            default_dose=request.default_dose,
            default_time_of_day=request.default_time_of_day,
            micros=request.micros,
        )
        db.add(item)

    db.commit()
    db.refresh(item)
    return {"ok": True, "item": SupplementCatalogItemOut.model_validate(item).model_dump()}


# ============ Phase 2c: Delete Supplement Catalog ============

@router.delete("/catalog/{item_id}")
def delete_supplement_catalog(item_id: str, db: Session = Depends(get_db)):
    """DELETE /supplements/catalog/{id}

    Supplement aus dem Katalog löschen.
    """
    item = db.query(SupplementCatalogItem).filter(SupplementCatalogItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


@router.post("/catalog/estimate")
def estimate_supplement(request: SupplementEstimateRequest, db: Session = Depends(get_db)):
    if not request.description.strip():
        raise HTTPException(status_code=400, detail="description fehlt")
    try:
        estimate = estimate_supplement_from_text(request.description)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    item = estimate.model_dump()
    item["id"] = generate_supplement_id(estimate.name, db)
    return {"ok": True, "item": item}


# ============ Phase 1c: Supplement-Stats & Streaks ============

@router.get("/stats")
def get_supplement_stats(
    days: int = Query(30, ge=1, le=365),
    anchor: str = Query(default_factory=lambda: date.today().isoformat()),
    db: Session = Depends(get_db)
):
    """GET /supplements/stats?days=30&anchor=YYYY-MM-DD

    Supplement-Konsumstatistiken über einen Zeitraum: wie viele Tage genommen,
    aktuelle Streak (rückwärts vom anchor).

    Algorithmus:
    - Für jeden Tag im Fenster [anchor - days + 1, anchor]:
      * Alle Supplements laden, die an diesem Tag geloggt wurden
      * days_taken pro supplement_id hochzählen
    - Streaks: rückwärts vom anchor zählen, aber heute nicht brechen wenn noch nicht geloggt

    Response: {ok, anchor, days, stats: [{supplement: {...}, days_taken, current_streak}, ...]}
    """
    today = date.today().isoformat()
    anchor_date = datetime.fromisoformat(anchor).date() if anchor else datetime.fromisoformat(today).date()
    start_date = anchor_date - timedelta(days=days - 1)

    stats = {}
    catalog = db.query(SupplementCatalogItem).all()

    # Fenster durchgehen: für jeden Tag zählen
    for i in range(days):
        d = start_date + timedelta(days=i)
        date_str = d.isoformat()

        journal = db.query(DailyJournal).filter(DailyJournal.date == date_str).first()
        if journal and journal.habits:
            for habit in journal.habits:
                if habit.get("type") == "supplement":
                    supp_id = habit.get("supplement_id")
                    name = habit.get("name", "Unknown")

                    if supp_id not in stats:
                        # Catalog-Item finden oder fallback
                        cat_item = next((c for c in catalog if c.id == supp_id), None)
                        stats[supp_id] = {
                            "supplement": {
                                "id": supp_id,
                                "name": name,
                                **({"product": cat_item.product} if cat_item and cat_item.product else {}),
                            },
                            "days_taken": 0,
                            "current_streak": 0,
                        }
                    stats[supp_id]["days_taken"] += 1

    # Streaks berechnen: rückwärts vom anchor_date
    for supp_id in stats:
        streak = 0
        for i in range(days):
            d = anchor_date - timedelta(days=i)
            date_str = d.isoformat()

            journal = db.query(DailyJournal).filter(DailyJournal.date == date_str).first()
            has_intake = (
                journal and journal.habits and
                any(h.get("type") == "supplement" and h.get("supplement_id") == supp_id for h in journal.habits)
            )

            if has_intake:
                streak += 1
            elif date_str == today:
                # Heute noch nicht geloggt → nicht brechen, weiterzählen
                continue
            else:
                # Ein Tag dazwischen ohne Intake → Streak beendet
                break

        stats[supp_id]["current_streak"] = streak

    return {
        "ok": True,
        "anchor": anchor_date.isoformat(),
        "days": days,
        "stats": list(stats.values()),
    }

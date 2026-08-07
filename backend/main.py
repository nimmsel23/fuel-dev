import sys
from backend.db.database import engine, Base, SessionLocal
from backend.db.models import FoodLog
from backend.core.llm import extract_macros_from_text

# Initialize Database
Base.metadata.create_all(bind=engine)

def add_meal(user_input: str):
    print(f"Analysiere: '{user_input}' ...")
    
    try:
        meal_entry = extract_macros_from_text(user_input)
    except Exception as e:
        print(f"Fehler bei der Gemini-API: {e}")
        return

    print("\n--- Analyse Ergebnis ---")
    print(f"Name: {meal_entry.name}")
    print(f"Beschreibung: {meal_entry.description}")
    print(f"Kalorien: {meal_entry.macros.calories} kcal")
    print(f"Protein: {meal_entry.macros.protein}g | Carbs: {meal_entry.macros.carbs}g | Fett: {meal_entry.macros.fat}g")
    if meal_entry.ingredients:
        print("\nZutaten:")
        for ing in meal_entry.ingredients:
            print(f"- {ing}")
            
    db = SessionLocal()
    try:
        db_log = FoodLog(
            original_text=user_input,
            name=meal_entry.name,
            description=meal_entry.description,
            ingredients=meal_entry.ingredients,
            calories=meal_entry.macros.calories,
            protein=meal_entry.macros.protein,
            carbs=meal_entry.macros.carbs,
            fat=meal_entry.macros.fat,
            fiber=meal_entry.macros.fiber,
            sugar=meal_entry.macros.sugar,
            micros=meal_entry.micros.model_dump()
        )
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
        print(f"\n✅ Erfolgreich in der Datenbank gespeichert (Log ID: {db_log.id})")
    except Exception as e:
        print(f"\n❌ Datenbank-Fehler: {e}")
    finally:
        db.close()

def main():
    if len(sys.argv) < 2:
        print("Verwendung: poetry run python main.py 'Ich habe 200g Lachs mit 150g Reis und Brokkoli gegessen'")
        sys.exit(1)
        
    user_input = " ".join(sys.argv[1:])
    add_meal(user_input)

if __name__ == "__main__":
    main()

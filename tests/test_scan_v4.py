"""Isolated v4 persistence test: DATABASE_URL=sqlite://, never runtime data."""
import os
import unittest
os.environ['DATABASE_URL'] = 'sqlite://'
from backend.db.database import Base, engine, SessionLocal
from backend.api.endpoints.food import FoodLogRequest, FoodLogPatchRequest, log_food, get_food_logs, patch_meal_log
from backend.db.models.journal import DailyJournal

class ScanPersistenceTest(unittest.TestCase):
    def test_profile_portion_and_day_totals(self):
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as session:
            meal = dict(id='scan', description='Test rice', grams=200, kcal=300,
                        micros={'calcium_mg': 20}, micros_meta={'source': 'gemini'},
                        components=[{'name': 'Rice', 'amount_g': 200}], source='gemini')
            log_food(FoodLogRequest(date='2026-10-16', meal=meal), session)
            saved = get_food_logs('2026-10-16', session)['data']['meals'][0]
            for key in ('grams', 'micros', 'micros_meta', 'components', 'source'):
                self.assertEqual(saved[key], meal[key])
            patch_meal_log(FoodLogPatchRequest(date='2026-10-16', meal_id='scan', meal={'grams': 100, 'micros': {'calcium_mg': 10}}), session)
            self.assertEqual(session.get(DailyJournal, '2026-10-16').micros_sum['calcium_mg'], 10)
            patch_meal_log(FoodLogPatchRequest(date='2026-10-16', meal_id='scan', new_date='2026-10-17'), session)
            self.assertEqual(session.get(DailyJournal, '2026-10-16').micros_sum['calcium_mg'], 0)
            self.assertEqual(session.get(DailyJournal, '2026-10-17').micros_sum['calcium_mg'], 10)
            log_food(FoodLogRequest(date='2026-10-17', delete_meal_id='scan'), session)
            self.assertEqual(session.get(DailyJournal, '2026-10-17').micros_sum['calcium_mg'], 0)

if __name__ == '__main__': unittest.main()

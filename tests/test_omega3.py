import json
import unittest
from unittest.mock import patch
from io import BytesIO
from fuel.omega3 import normalize_omega3
from fuel.sources.usda import get_nutrients

class Omega3Test(unittest.TestCase):
    def fetch(self, nutrients):
        response = BytesIO(json.dumps({'foodNutrients': [
            {'nutrient': {'name': name, 'unitName': unit}, 'amount': value}
            for name, unit, value in nutrients
        ]}).encode())
        with patch('urllib.request.urlopen', return_value=response):
            return get_nutrients(123)['per_100g']

    def test_usda_epa_units_and_no_ambiguous_ala(self):
        profile = self.fetch([
            ('PUFA 20:5 n-3 (EPA)', 'g', .18),
            ('PUFA 22:6 n-3 (DHA)', 'mg', 120),
            ('PUFA 22:5 n-3 (DPA)', 'g', .005),
            ('PUFA 18:3', 'g', 9),
        ])
        self.assertEqual(profile['omega3_epa_mg'], 180)
        self.assertEqual(profile['omega3_epa_dha_mg'], 300)
        self.assertEqual(profile['omega3_mg'], 305)
        self.assertNotIn('omega3_ala_mg', profile)

    def test_missing_zero_unknown_unit(self):
        profile = self.fetch([('PUFA 20:5 n-3 (EPA)', 'g', 0), ('PUFA 22:6 n-3 (DHA)', 'IU', 200)])
        self.assertEqual(profile['omega3_epa_mg'], 0)
        self.assertNotIn('omega3_dha_mg', profile)
        self.assertNotIn('omega3_epa_dha_mg', profile)
        self.assertNotIn('omega3_mg', self.fetch([]))

    def test_total_is_not_a_species_split(self):
        self.assertEqual(normalize_omega3({'omega3_mg': 1000}), {'omega3_mg': 1000})
        self.assertEqual(normalize_omega3({'omega3_epa_mg': None, 'omega3_dha_mg': float('nan')}), {})
        self.assertEqual(normalize_omega3({'omega3_epa_mg': 180, 'omega3_dha_mg': 120})['omega3_epa_dha_mg'], 300)


class Omega3BackendTest(unittest.TestCase):
    def test_typed_estimate_derives_combined_and_preserves_missing(self):
        from backend.schemas.micros import MicroNutrients
        profile = MicroNutrients(omega3_epa_mg=180, omega3_dha_mg=120)
        self.assertEqual(profile.omega3_epa_dha_mg, 300)
        self.assertIsNone(profile.omega3_ala_mg)
        from fuel.constants.nutrients import MICRO_KEYS
        from backend.core.dach import MICRO_KEYS as BACKEND_KEYS
        self.assertEqual(set(MICRO_KEYS), set(BACKEND_KEYS))

    def test_weekly_backend_marks_legacy_total_as_unknown_split(self):
        import os
        os.environ['DATABASE_URL'] = 'sqlite://'
        from backend.db.database import Base, engine, SessionLocal
        from backend.db.models.journal import DailyJournal
        from backend.api.endpoints.nutrition_query import get_weekly_micros
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as session:
            journal = DailyJournal(date='2026-10-12', food_logs=[{'micros': {'omega3_mg': 1000}}], habits=[], notes=[], micros_sum={'omega3_mg': 1000})
            session.merge(journal)
            session.commit()
            result = get_weekly_micros(2026, 42, session)
            self.assertIsNone(result['rda_comparison']['omega3_epa_dha_mg']['percent_of_dach'])
            self.assertIsNone(result['rda_comparison']['omega3_epa_dha_mg']['avg_daily'])

if __name__ == '__main__': unittest.main()

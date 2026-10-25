import json
import unittest
from datetime import date
from unittest.mock import patch

from fuel import parse
from fuel.units import grams_for

DEBREZINER = {
    "id": "ingredient_ja_natuerlich_bio_debreziner", "kind": "ingredient",
    "name": "Ja! Natürlich Bio-Debreziner", "alias": "bio debreziner",
    "kcal": 357, "protein": 16, "carbs": 0.7, "fat": 32, "yield_g": 100, "piece_g": 60,
    "micros": {"iron_mg": 1.0, "zinc_mg": 2.0},
}
DACHSTEIN = {
    "id": "ingredient_dachsteinbrot", "kind": "ingredient", "name": "Dachsteinbrot",
    "alias": "dachsteinbrot", "kcal": 230, "protein": 8.1, "carbs": 36.1, "fat": 6.7, "yield_g": 100,
    "micros": {"iron_mg": 2.0, "magnesium_mg": 50.0},
}
# Ein fertiges Gericht darf nie als Einzelzutat durchgehen.
GERICHT = {
    "id": "meal_senf_semmel", "kind": "meal", "name": "Senf", "alias": "senf",
    "kcal": 500, "protein": 20, "carbs": 50, "fat": 20, "yield_g": 300,
}

SATZ = "4 Bio-Debreziner von Ja Natürlich mit bissl Dachsteinbrot und Kräutersenf"
SATZ_JSON = {"meals": [{
    "text": SATZ, "meal_type": None, "day": None, "time": None,
    "items": [
        {"name": "Bio-Debreziner", "brand": "Ja! Natürlich", "count": 4, "piece_g": 50},
        {"name": "Dachsteinbrot", "vague": "bissl", "grams_guess": 80},
        {"name": "Kräutersenf", "vague": "bissl", "grams_guess": 20},
    ],
}]}


def gemini_returns(payload):
    return patch("fuel.gemini.call_gemini", return_value={"ok": True, "text": json.dumps(payload)})


class UnitsTest(unittest.TestCase):
    def test_austrian_dekagramm(self):
        self.assertEqual(grams_for(5, "dag"), (50.0, "stated"))

    def test_gr_and_el(self):
        self.assertEqual(grams_for(240, "gr"), (240.0, "stated"))
        self.assertEqual(grams_for(2, "EL"), (30.0, "stated"))
        self.assertEqual(grams_for(2, "Esslöffel"), (30.0, "stated"))

    def test_piece_needs_weight(self):
        self.assertEqual(grams_for(4, None, piece_g=50), (200.0, "piece"))
        self.assertEqual(grams_for(4, None), (None, "unknown"))

    def test_guess_without_amount(self):
        self.assertEqual(grams_for(None, None, grams_guess=80), (80.0, "guessed"))


class ParsedModelTest(unittest.TestCase):
    def test_vague_word_always_counts_as_guessed(self):
        item = parse.ParsedItem(name="Brot", count=2, unit="scheiben", piece_g=40, vague="bissl")
        self.assertEqual(item.grams()[1], "piece")
        item = parse.ParsedItem(name="Brot", count=80, unit="g", vague="bissl")
        self.assertEqual(item.grams(), (80.0, "guessed"))

    def test_comma_decimal_from_llm(self):
        self.assertEqual(parse.ParsedItem(name="Milch", count="0,5", unit="l").grams(), (500.0, "stated"))

    def test_invalid_time_is_dropped_not_fatal(self):
        meal = parse.ParsedMeal(text="x", time="25:99", items=[{"name": "Ei"}])
        self.assertIsNone(meal.time)
        self.assertEqual(parse.ParsedMeal(text="x", time="9:05", items=[{"name": "Ei"}]).time, "09:05")

    def test_relative_day_resolved_by_code(self):
        meal = parse.ParsedMeal(text="x", day="gestern", items=[{"name": "Ei"}])
        self.assertEqual(meal.resolved_day(today=date(2026, 10, 25)), "2026-10-24")
        self.assertIsNone(parse.ParsedMeal(text="x", day="irgendwann", items=[{"name": "Ei"}]).resolved_day())

    def test_estimate_text_marks_guesses(self):
        meal = parse.ParsedInput.model_validate(SATZ_JSON).meals[0]
        text = meal.estimate_text()
        self.assertIn("200 g Bio-Debreziner (Ja! Natürlich)", text)
        self.assertIn("ca. 80 g Dachsteinbrot (Menge geschätzt)", text)

    def test_looks_complex(self):
        self.assertTrue(parse.looks_complex(SATZ))
        self.assertTrue(parse.looks_complex("2 Eier, 1 Semmel"))
        self.assertFalse(parse.looks_complex("Käsekrainer 330g"))
        # Kurze Sätze mit Menge/Marke müssen ebenfalls in den Parser.
        self.assertTrue(parse.looks_complex("4 Bio-Debreziner von Ja Natürlich"))
        self.assertTrue(parse.looks_complex("60dag Dachsteinbrot"))


class ParseInputTest(unittest.TestCase):
    def test_parses_sentence(self):
        with gemini_returns(SATZ_JSON):
            out = parse.parse_input(SATZ)
        self.assertEqual(len(out.meals), 1)
        self.assertEqual(out.meals[0].items[0].brand, "Ja! Natürlich")

    def test_multiple_meals(self):
        payload = {"meals": [
            {"text": "2 Eier", "meal_type": "breakfast", "time": "08:00", "items": [{"name": "Ei", "count": 2, "piece_g": 50}]},
            {"text": "250g Nudeln", "meal_type": "lunch", "items": [{"name": "Nudeln", "count": 250, "unit": "g"}]},
        ]}
        with gemini_returns(payload):
            out = parse.parse_input("zum Frühstück 2 Eier um 8, mittags 250g Nudeln")
        self.assertEqual([m.meal_type for m in out.meals], ["breakfast", "lunch"])
        self.assertEqual(out.meals[0].time, "08:00")

    def test_garbage_and_errors_return_none(self):
        with patch("fuel.gemini.call_gemini", return_value={"ok": True, "text": "keine ahnung"}):
            self.assertIsNone(parse.parse_input("x"))
        with patch("fuel.gemini.call_gemini", return_value={"ok": False, "error": "no credentials"}):
            self.assertIsNone(parse.parse_input("x"))
        with gemini_returns({"meals": []}):
            self.assertIsNone(parse.parse_input("x"))


class ResolveTest(unittest.TestCase):
    def resolve(self, estimate=None):
        meal = parse.ParsedInput.model_validate(SATZ_JSON).meals[0]
        est = estimate or {"macros": {"kcal": 20, "protein": 1, "carbs": 2, "fat": 1.2}, "micros": {}, "components": []}
        with patch("fuel.catalog_lookup.load_meals", return_value=[DEBREZINER, DACHSTEIN, GERICHT]), \
             patch("fuel.gemini.estimate_nutrition", return_value=est) as est_mock:
            return parse.resolve_meal(meal), est_mock

    def test_catalog_piece_weight_beats_llm_guess(self):
        res, _ = self.resolve()
        deb = next(c for c in res.components if "Debreziner" in c["name"])
        self.assertEqual(deb["qty"], "240 g")          # 4 × 60 g aus Catalog, nicht 4 × 50 g
        self.assertAlmostEqual(deb["kcal"], 856.8, places=1)

    def test_sum_is_computed_in_code(self):
        res, _ = self.resolve()
        # 240 g Debreziner + 80 g Dachsteinbrot (Catalog) + Senf (Schätzung)
        self.assertAlmostEqual(res.macros["kcal"], 856.8 + 184.0 + 20, places=1)
        self.assertAlmostEqual(res.macros["protein"], 38.4 + 6.5 + 1, places=1)

    def test_only_unresolved_items_go_to_estimate(self):
        res, est_mock = self.resolve()
        self.assertEqual(est_mock.call_count, 1)
        sent = est_mock.call_args.args[0]
        self.assertIn("Kräutersenf", sent)
        self.assertNotIn("Debreziner", sent)
        self.assertTrue(any("GESCHÄTZT" in n and "Kräutersenf" in n for n in res.notes))

    def test_meal_hit_is_not_used_as_ingredient(self):
        # "Senf" matcht ein fertiges Gericht (kind=meal) → muss in die Schätzung.
        meal = parse.ParsedMeal(text="x", items=[{"name": "Senf", "count": 20, "unit": "g"}])
        with patch("fuel.catalog_lookup.load_meals", return_value=[GERICHT]), \
             patch("fuel.gemini.estimate_nutrition", return_value={"macros": {"kcal": 20}, "micros": {}, "components": []}) as est_mock:
            res = parse.resolve_meal(meal)
        self.assertEqual(est_mock.call_count, 1)
        self.assertEqual(res.macros["kcal"], 20)

    def test_shortened_name_finds_unique_ingredient(self):
        # LLM liefert "Debreziner", der Baustein heißt "Bio-Debreziner".
        item = parse.ParsedItem(name="Debreziner", count=2)
        with patch("fuel.catalog_lookup.load_meals", return_value=[DEBREZINER, DACHSTEIN]):
            self.assertEqual(parse._catalog_ingredient(item)["id"], DEBREZINER["id"])

    def test_ambiguous_short_name_finds_nothing(self):
        other = dict(DEBREZINER, id="ingredient_billa_debreziner", name="Billa Debreziner", alias="billa debreziner")
        item = parse.ParsedItem(name="Debreziner", count=2)
        with patch("fuel.catalog_lookup.load_meals", return_value=[DEBREZINER, other]):
            self.assertIsNone(parse._catalog_ingredient(item))

    def test_estimate_error_returns_none(self):
        meal = parse.ParsedMeal(text="x", items=[{"name": "Irgendwas", "count": 20, "unit": "g"}])
        with patch("fuel.catalog_lookup.load_meals", return_value=[]), \
             patch("fuel.gemini.estimate_nutrition", return_value={"_error": "boom"}):
            self.assertIsNone(parse.resolve_meal(meal))


if __name__ == "__main__":
    unittest.main()

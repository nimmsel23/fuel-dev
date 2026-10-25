import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fuel import micros, parse
from fuel import catalog_lookup as cat


def ingredient(**over):
    base = {
        "id": "ingredient_debreziner", "kind": "ingredient", "name": "Ja! Natürlich Bio-Debreziner",
        "alias": "bio debreziner", "source": "manual", "kcal": 357, "protein": 16, "carbs": 0.7, "fat": 32,
        "yield_g": 100, "piece_g": 60,
    }
    base.update(over)
    return base


def est(micro_values, error=None):
    if error:
        return {"_error": error, "macros": {}, "micros": {}, "components": []}
    return {"macros": {"kcal": 1}, "micros": micro_values, "components": []}


class IngredientMicrosTest(unittest.TestCase):
    def test_existing_micros_are_never_reestimated(self):
        with patch("fuel.gemini.estimate_nutrition") as e:
            m, fresh = micros.ingredient_micros(ingredient(micros={"iron_mg": 1.0}))
        self.assertEqual((m, fresh), ({"iron_mg": 1.0}, False))
        e.assert_not_called()

    def test_missing_micros_estimated_once_and_persisted(self):
        entry = ingredient()
        with patch("fuel.gemini.estimate_nutrition", return_value=est({"iron_mg": 1.2, "zinc_mg": 0, "sodium_mg": 800})) as e, \
             patch("fuel.catalog_lookup.update_catalog_item") as upd:
            m, fresh = micros.ingredient_micros(entry)
            m2, fresh2 = micros.ingredient_micros(entry)   # zweiter Lauf: kein Call mehr
        self.assertTrue(fresh)
        self.assertFalse(fresh2)
        self.assertEqual(e.call_count, 1)
        self.assertEqual(m, {"iron_mg": 1.2, "sodium_mg": 800.0})   # 0-Werte fliegen raus
        self.assertEqual(m2, m)
        self.assertEqual(entry["source"], "manual")                  # Herkunft des Bausteins bleibt
        self.assertEqual(entry["micros_meta"]["method"], "ingredient_estimate")
        self.assertEqual(entry["micros_meta"]["basis_g"], 100.0)
        upd.assert_called_once()
        self.assertIn("357 kcal", e.call_args.args[0])               # Packungs-Makros im Schätz-Text

    def test_estimate_error_returns_empty_and_persists_nothing(self):
        with patch("fuel.gemini.estimate_nutrition", return_value=est({}, error="boom")), \
             patch("fuel.catalog_lookup.update_catalog_item") as upd:
            self.assertEqual(micros.ingredient_micros(ingredient()), ({}, False))
        upd.assert_not_called()


class SumComponentsTest(unittest.TestCase):
    COMPONENTS = [
        {"name": "Bio-Debreziner (Ja! Natürlich)", "qty_text": "4 Stück (240g)", "amount_g": 240.0},
        {"name": "Kräutersenf", "qty_text": "ein bisschen (20g)", "amount_g": 20.0},
    ]

    def test_catalog_scaled_rest_estimated(self):
        deb = ingredient(micros={"iron_mg": 1.0, "zinc_mg": 2.0})
        with patch("fuel.catalog_lookup.load_meals", return_value=[deb]), \
             patch("fuel.gemini.estimate_nutrition", return_value=est({"iron_mg": 0.5})) as e:
            total, info = micros.sum_components_micros(self.COMPONENTS)
        self.assertEqual(total["iron_mg"], 2.9)       # 240 g × 1.0/100 g + 0.5 Senf
        self.assertEqual(total["zinc_mg"], 4.8)
        self.assertEqual(info["from_catalog"], ["Bio-Debreziner (Ja! Natürlich)"])
        self.assertEqual(info["estimated"], ["Kräutersenf"])
        sent = e.call_args.args[0]
        self.assertIn("Kräutersenf", sent)
        self.assertNotIn("Debreziner", sent)           # Baustein-Zutat geht NICHT in die Schätzung

    def test_failed_rest_estimate_is_reported_not_silent(self):
        deb = ingredient(micros={"iron_mg": 1.0})
        with patch("fuel.catalog_lookup.load_meals", return_value=[deb]), \
             patch("fuel.gemini.estimate_nutrition", return_value=est({}, error="boom")):
            total, info = micros.sum_components_micros(self.COMPONENTS)
        self.assertEqual(total, {"iron_mg": 2.4})
        self.assertEqual(info["missing"], ["Kräutersenf"])


class RecomputeEntryTest(unittest.TestCase):
    def entry(self, **over):
        e = {"description": "4 Bio-Debreziner", "micros": {"iron_mg": 99},
             "components": [{"name": "Bio-Debreziner", "amount_g": 240.0}]}
        e.update(over)
        return e

    def run_recompute(self, entry, catalog=None):
        deb = ingredient(micros={"iron_mg": 1.0})
        with patch("fuel.catalog_lookup.load_meals", return_value=catalog if catalog is not None else [deb]):
            return micros.recompute_entry(entry)

    def test_replaces_stale_micros_from_components(self):
        fields, info = self.run_recompute(self.entry())
        self.assertEqual(fields["micros"], {"iron_mg": 2.4})
        self.assertEqual(fields["micros_meta"]["method"], "components_sum")
        self.assertEqual(fields["micros_meta"]["source"], "catalog")
        self.assertNotIn("incomplete", fields["micros_meta"])

    def test_qty_prefix_scales_like_macros(self):
        fields, _ = self.run_recompute(self.entry(description="2x Bio-Debreziner"))
        self.assertEqual(fields["micros"], {"iron_mg": 4.8})

    def test_no_components_returns_none(self):
        self.assertIsNone(micros.recompute_entry({"description": "x", "micros": {"iron_mg": 1}}))

    def test_incomplete_is_marked_in_meta(self):
        entry = self.entry(components=[
            {"name": "Bio-Debreziner", "amount_g": 240.0}, {"name": "Senf", "amount_g": 20.0}])
        deb = ingredient(micros={"iron_mg": 1.0})
        with patch("fuel.catalog_lookup.load_meals", return_value=[deb]), \
             patch("fuel.gemini.estimate_nutrition", return_value=est({}, error="boom")):
            fields, info = micros.recompute_entry(entry)
        self.assertEqual(fields["micros_meta"]["incomplete"], ["Senf"])


class UpdateCatalogItemTest(unittest.TestCase):
    def test_only_target_changes_and_file_stays_valid(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "catalog.json"
            path.write_text(json.dumps({"items": [ingredient(), ingredient(id="other", name="Anderes")],
                                        "deleted_ids": ["x"]}))
            with patch("fuel.catalog_lookup.user_catalog_path", return_value=path):
                self.assertTrue(cat.update_catalog_item("ingredient_debreziner", {"micros": {"iron_mg": 1.0}}))
                self.assertFalse(cat.update_catalog_item("gibt_es_nicht", {"micros": {}}))
            data = json.loads(path.read_text())
        by_id = {i["id"]: i for i in data["items"]}
        self.assertEqual(by_id["ingredient_debreziner"]["micros"], {"iron_mg": 1.0})
        self.assertIn("updated_at", by_id["ingredient_debreziner"])
        self.assertNotIn("micros", by_id["other"])
        self.assertEqual(data["deleted_ids"], ["x"])


class ResolveMealMicrosTest(unittest.TestCase):
    def meal(self):
        return parse.ParsedMeal(text="2 Debreziner", items=[{"name": "Bio-Debreziner", "count": 2}])

    def test_ingredient_without_micros_is_filled_once_and_summed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "catalog.json"
            path.write_text(json.dumps({"items": [ingredient()], "deleted_ids": []}))
            with patch("fuel.catalog_lookup.user_catalog_path", return_value=path), \
                 patch("fuel.gemini.estimate_nutrition", return_value=est({"iron_mg": 1.0})) as e:
                first = parse.resolve_meal(self.meal())
                second = parse.resolve_meal(self.meal())
            stored = json.loads(path.read_text())["items"][0]
        self.assertEqual(e.call_count, 1)                     # nur der erste Lauf zahlt
        self.assertEqual(first.micros, {"iron_mg": 1.2})      # 120 g × 1.0 / 100 g
        self.assertEqual(second.micros, first.micros)
        self.assertEqual(stored["micros"], {"iron_mg": 1.0})
        self.assertEqual(stored["source"], "manual")
        self.assertTrue(any("einmalig geschätzt" in n for n in first.notes))

    def test_unavailable_micros_are_flagged_not_silently_dropped(self):
        with patch("fuel.catalog_lookup.load_meals", return_value=[ingredient()]), \
             patch("fuel.gemini.estimate_nutrition", return_value=est({}, error="boom")):
            res = parse.resolve_meal(self.meal())
        self.assertEqual(res.micros, {})
        self.assertTrue(any("Mikros fehlen" in n for n in res.notes))


if __name__ == "__main__":
    unittest.main()

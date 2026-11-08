import test from "node:test";
import assert from "node:assert/strict";
import { mealFromCatalogItem } from "../src/client/lib/catalogMeal.js";

const item = {
  id: "bowl",
  name: "Bowl",
  meal_type: "lunch",
  notes: "selbst gemacht",
  kcal: 400,
  protein: 30,
  carbs: 40,
  fat: 10,
  yield_g: 400,
  addons: [
    { id: "cheese", label: "Käse", kcal: 80, protein: 6, carbs: 1, fat: 6 },
    { id: "sauce", label: "Sauce", kcal: 40, protein: 0, carbs: 8, fat: 1 },
  ],
};

test("selected add-ons are added to the catalog portion", () => {
  const meal = mealFromCatalogItem(item, { addonIds: ["cheese"] });
  assert.equal(meal.description, "Bowl");
  assert.equal(meal.grams, 400);
  assert.equal(meal.kcal, 480);
  assert.equal(meal.protein, 36);
  assert.equal(meal.catalog_id, "bowl");
  assert.match(meal.notes, /Add-ons: Käse/);
  assert.doesNotMatch(meal.notes, /Sauce/);
});

test("a different gram weight scales the base meal and the add-ons", () => {
  const meal = mealFromCatalogItem(item, { addonIds: ["cheese"], grams: 200 });
  assert.equal(meal.grams, 200);
  assert.equal(meal.kcal, 240);
  assert.equal(meal.protein, 18);
  assert.equal(meal.carbs, 20.5);
  assert.equal(meal.fat, 8);
});

test("unknown macros stay unknown and an explicit zero stays zero", () => {
  const meal = mealFromCatalogItem({ ...item, kcal: null, fat: 0 }, { addonIds: ["cheese"] });
  assert.equal(meal.kcal, null);
  assert.equal(meal.fat, 6);
  const plain = mealFromCatalogItem({ ...item, fat: 0, addons: [] });
  assert.equal(plain.fat, 0);
  assert.equal(plain.kcal, 400);
});

test("re-logging freezes ingredients and micronutrients at the chosen portion", () => {
  const source = {
    ...item,
    components: [{ name: "Reis", amount_g: 200, grams: 200, kcal: 180, protein: null, qty_text: "200g" }],
    micros: { calcium_mg: 0, iron_mg: 4 },
  };
  const meal = mealFromCatalogItem(source, { addonIds: ["cheese"], grams: 200 });
  source.components[0].kcal = 999;
  source.micros.iron_mg = 99;
  source.kcal = 1;
  assert.equal(meal.components_snapshot, true);
  assert.equal(meal.micros_snapshot, true);
  assert.equal(meal.components[0].kcal, 90);
  assert.equal(meal.components[0].amount_g, 100);
  assert.equal(meal.components[0].protein, null);
  assert.equal(meal.components[0].qty_text, "200g");
  assert.equal(meal.micros.calcium_mg, 0);
  assert.equal(meal.micros.iron_mg, 2);
  assert.equal(meal.addons[0].kcal, 40);
  assert.equal(meal.kcal, 240);
});

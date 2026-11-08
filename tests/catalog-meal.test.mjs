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

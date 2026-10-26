import { potMealFields, loggedAtFor } from "./potsLogic.js";

// Schreibt einen geplanten Tagesanteil (siehe planDay) in Topf und Tages-Log. Alle Seiteneffekte kommen per `deps` herein
// (hooks/usePots.js verdrahtet Firestore/API, tests/pots-persist.test.mjs ein Fake):
//   savePot(pot) · onPot(pot) Cache nachziehen · dayMeals(date) → Mahlzeiten des Tages ·
//   addMeal(date, meal) · patchMeal(date, mealId, fields) · deleteMeal(date, mealId) · newId() · today
//
// Reihenfolge: Topf zuerst, dann Log — ein Topf verweist so nie auf eine Mahlzeit, die es nicht gibt. Scheitert das Log,
// legt der nächste Versuch die Mahlzeit neu an (fehlende Mahlzeit wird unten erkannt).
export async function persistPlan(deps, plan, { saveFirst = true } = {}) {
  const { date, op } = plan;
  let pot = plan.nextPot;
  if (saveFirst) await deps.savePot(pot);
  if (op.kind === "none") return pot;

  if (op.kind === "delete") {
    await deps.deleteMeal(date, op.mealId);
    return pot;
  }

  const fields = potMealFields(pot, plan.fraction);
  let mealId = op.mealId;
  let kind = op.kind;
  if (kind === "patch") {
    // Wurde die Mahlzeit im Log-Tab gelöscht, würde das Patchen scheitern — dann neu anlegen (frische ID, Tombstone-sicher).
    const meals = await deps.dayMeals(date);
    if (!meals.some((m) => m.id === mealId)) {
      mealId = deps.newId();
      kind = "add";
      pot = { ...pot, days: { ...pot.days, [date]: { fraction: plan.fraction, meal_id: mealId } } };
      deps.onPot(pot);
      await deps.savePot(pot);
    }
  }

  if (kind === "patch") await deps.patchMeal(date, mealId, fields);
  else await deps.addMeal(date, { ...fields, id: mealId, logged_at: loggedAtFor(date, deps.today) });
  return pot;
}

// Makros/Name eines Topfs geändert: alle verknüpften Tages-Mahlzeiten mit dem neuen Stand nachziehen.
export function planRescale(pot) {
  return Object.entries(pot.days || {})
    .filter(([, d]) => d?.meal_id && d.fraction > 0)
    .map(([date, d]) => ({ date, fraction: d.fraction, nextPot: pot, op: { kind: "patch", mealId: d.meal_id } }));
}

// Eine Topf-Mahlzeit wurde im Log gelöscht (oder auf einen anderen Tag verschoben): den Tageseintrag im Topf freigeben
// bzw. verlegen, damit der Topf nicht dauerhaft "gegessen" zeigt, was nicht mehr im Log steht.
// Beim Verschieben bekommt die Mahlzeit eine neue ID (cloud patchJson, move_id) — `movedMealId` ist diese neue ID;
// fehlt sie oder ist der Zieltag im Topf schon belegt, wird der Tag nur freigegeben.
export function releaseDay(pot, date, mealId, moveTo = null, movedMealId = null) {
  const entry = pot.days?.[date];
  if (!entry || entry.meal_id !== mealId) return null; // gehört nicht (mehr) zu diesem Topf-Tag
  const days = { ...pot.days };
  delete days[date];
  if (moveTo && movedMealId && !days[moveTo]) days[moveTo] = { ...entry, meal_id: movedMealId };
  return { ...pot, days };
}

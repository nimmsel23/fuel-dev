import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, patchJson } from "@api";
import { listPots, savePot, deletePot } from "../lib/db/firestore/pots.js";
import { patchNutritionDay, reloadNutritionDay } from "../lib/optimisticMeal.js";
import { planDay, potMealFields, loggedAtFor } from "../lib/potsLogic.js";
import { todayISO } from "../lib/db/firestore/utils.js";

export const POTS_KEY = ["pots"];

export function usePots() {
  return useQuery({ queryKey: POTS_KEY, queryFn: listPots, staleTime: 30_000 });
}

// Schreibvorgänge je Topf nacheinander (Reihenfolge der Absicht), Anzeige bleibt dabei sofort optimistisch.
const queues = new Map();
function enqueue(potId, work) {
  const run = (queues.get(potId) || Promise.resolve()).catch(() => {}).then(work);
  queues.set(potId, run);
  return run;
}

const replacePot = (qc, pot) =>
  qc.setQueryData(POTS_KEY, (list) => (list || []).some((p) => p.id === pot.id) ? list.map((p) => (p.id === pot.id ? pot : p)) : [pot, ...(list || [])]);

const refreshDay = (qc, date) => {
  qc.invalidateQueries({ queryKey: ["nutrition", date], exact: true });
  qc.invalidateQueries({ queryKey: ["week-logs"] });
};

// Topf zuerst speichern, dann das Tages-Log: so verweist ein Topf nie auf eine Mahlzeit, die es nicht gibt;
// scheitert das Log, legt der nächste Versuch die Mahlzeit neu an (fehlende Mahlzeit wird unten erkannt).
async function persistPlan(qc, plan) {
  const { date } = plan;
  let pot = plan.nextPot;
  await savePot(pot);
  const { op } = plan;
  if (op.kind === "none") return;

  if (op.kind === "delete") {
    await patchNutritionDay(qc, date, { delete_meal_id: op.mealId });
    await postJson("/nutrition/log", { date, delete_meal_id: op.mealId });
    return refreshDay(qc, date);
  }

  const fields = potMealFields(pot, plan.fraction);
  let mealId = op.mealId;
  let kind = op.kind;
  if (kind === "patch") {
    // Wurde die Mahlzeit im Log-Tab gelöscht, würde das Patchen scheitern — dann neu anlegen (frische ID, Tombstone-sicher).
    const log = await fetchJson(`/nutrition/log?date=${date}`);
    if (!(log?.data?.meals || []).some((m) => m.id === mealId)) {
      mealId = crypto.randomUUID();
      kind = "add";
      pot = { ...pot, days: { ...pot.days, [date]: { fraction: plan.fraction, meal_id: mealId } } };
      replacePot(qc, pot);
      await savePot(pot);
    }
  }

  if (kind === "patch") {
    await patchNutritionDay(qc, date, { meal_id: mealId, meal: fields });
    await patchJson("/nutrition/log", { date, meal_id: mealId, meal: fields });
  } else {
    const meal = { ...fields, id: mealId, logged_at: loggedAtFor(date, todayISO()) };
    await patchNutritionDay(qc, date, { meal });
    await postJson("/nutrition/log", { date, meal });
  }
  refreshDay(qc, date);
}

export function usePotActions() {
  const qc = useQueryClient();
  const [error, setError] = useState(null);

  const fail = (date) => (e) => {
    setError(e?.message || String(e));
    qc.invalidateQueries({ queryKey: POTS_KEY });
    if (date) reloadNutritionDay(qc, date);
  };

  // Anteil eines Tages setzen (0 = Eintrag entfernen). Liest den aktuellen Stand aus dem Cache, damit schnelle
  // Folge-Taps auf dem optimistischen Stand aufbauen.
  function setDay(potId, date, fraction) {
    const pot = (qc.getQueryData(POTS_KEY) || []).find((p) => p.id === potId);
    if (!pot) return Promise.resolve();
    setError(null);
    const plan = planDay(pot, date, fraction, crypto.randomUUID());
    replacePot(qc, plan.nextPot);
    return enqueue(potId, () => persistPlan(qc, plan)).catch(fail(date));
  }

  async function createPot(input, firstFraction = 0) {
    setError(null);
    const pot = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      ingredients: input.ingredients?.trim() || "",
      cooked_on: input.cooked_on,
      macros: input.macros,
      ...(input.micros ? { micros: input.micros } : {}),
      ...(input.micros_meta ? { micros_meta: input.micros_meta } : {}),
      ...(input.components ? { components: input.components } : {}),
      days: {},
      created_at: new Date().toISOString(),
    };
    replacePot(qc, pot);
    try {
      await enqueue(pot.id, () => savePot(pot));
    } catch (e) {
      fail()(e);
      throw e;
    }
    if (firstFraction > 0) await setDay(pot.id, pot.cooked_on, firstFraction);
    return pot;
  }

  async function removePot(potId) {
    setError(null);
    qc.setQueryData(POTS_KEY, (list) => (list || []).filter((p) => p.id !== potId));
    try { await enqueue(potId, () => deletePot(potId)); } catch (e) { fail()(e); }
  }

  return { setDay, createPot, removePot, error, clearError: () => setError(null) };
}

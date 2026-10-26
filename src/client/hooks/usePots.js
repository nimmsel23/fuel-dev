import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson, postJson, patchJson } from "@api";
import { listPots, savePot, deletePot } from "../lib/db/firestore/pots.js";
import { patchNutritionDay, reloadNutritionDay } from "../lib/optimisticMeal.js";
import { planDay, applyPotEdit } from "../lib/potsLogic.js";
import { persistPlan, planRescale, releaseDay } from "../lib/potsPersist.js";
import { todayISO } from "../lib/db/firestore/utils.js";

export const POTS_KEY = ["pots"];

// Technische Fehlertexte (Auth/Firestore) in verständliches Deutsch übersetzen.
export function potErrorMessage(e) {
  const msg = e?.message || String(e || "");
  if (/not authenticated/i.test(msg)) return "Bitte zuerst anmelden (Cloud Login oben rechts).";
  if (/permission|insufficient/i.test(msg)) return "Keine Berechtigung für die Töpfe — bitte neu anmelden.";
  if (/offline|unavailable|network/i.test(msg)) return "Keine Verbindung zur Cloud — Änderungen werden nachgeholt, sobald du wieder online bist.";
  return msg;
}

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

// Verdrahtung von lib/potsPersist.js mit Firestore, Outbox-API und optimistischem Tages-Cache.
const depsFor = (qc) => ({
  savePot,
  onPot: (pot) => replacePot(qc, pot),
  dayMeals: async (date) => (await fetchJson(`/nutrition/log?date=${date}`))?.data?.meals || [],
  addMeal: async (date, meal) => {
    await patchNutritionDay(qc, date, { meal });
    await postJson("/nutrition/log", { date, meal });
    refreshDay(qc, date);
  },
  patchMeal: async (date, mealId, fields) => {
    await patchNutritionDay(qc, date, { meal_id: mealId, meal: fields });
    await patchJson("/nutrition/log", { date, meal_id: mealId, meal: fields });
    refreshDay(qc, date);
  },
  deleteMeal: async (date, mealId) => {
    await patchNutritionDay(qc, date, { delete_meal_id: mealId });
    await postJson("/nutrition/log", { date, delete_meal_id: mealId });
    refreshDay(qc, date);
  },
  newId: () => crypto.randomUUID(),
  today: todayISO(),
});

// Eine Topf-Mahlzeit wurde im Log-Tab gelöscht/verschoben → Topf-Tag freigeben bzw. verlegen (siehe releaseDay).
// Lädt die Töpfe bei Bedarf selbst (der Töpfe-Tab muss dafür nicht offen gewesen sein). Fehler hier dürfen das Log nicht stören.
export async function syncPotAfterMealChange(qc, { potId, date, mealId, moveTo = null }) {
  if (!potId) return;
  try {
    const pots = await qc.fetchQuery({ queryKey: POTS_KEY, queryFn: listPots, staleTime: 30_000 });
    const pot = pots.find((p) => p.id === potId);
    // Verschoben: die Mahlzeit hat am Zieltag eine neue ID — über pot_id/Anteil wiederfinden.
    let movedMealId = null;
    if (moveTo && pot?.days?.[date]) {
      const target = (await fetchJson(`/nutrition/log?date=${moveTo}`))?.data?.meals || [];
      movedMealId = target.find((m) => m.pot_id === potId && Math.abs((m.pot_fraction || 0) - pot.days[date].fraction) < 1e-6)?.id || null;
    }
    const next = pot && releaseDay(pot, date, mealId, moveTo, movedMealId);
    if (!next) return;
    replacePot(qc, next);
    await enqueue(potId, () => savePot(next));
  } catch (e) {
    console.warn("[pots] Topf nach Log-Änderung nicht aktualisiert:", e);
    qc.invalidateQueries({ queryKey: POTS_KEY });
  }
}

export function usePotActions() {
  const qc = useQueryClient();
  const [error, setError] = useState(null);

  const fail = (date) => (e) => {
    setError(potErrorMessage(e));
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
    return enqueue(potId, () => persistPlan(depsFor(qc), plan)).catch(fail(date));
  }

  async function createPot(input, firstFraction = 0) {
    setError(null);
    const pot = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      ingredients: input.ingredients?.trim() || "",
      cooked_on: input.cooked_on,
      macros: input.macros,
      ...(input.extras?.micros ? { micros: input.extras.micros } : {}),
      ...(input.extras?.micros_meta ? { micros_meta: input.extras.micros_meta } : {}),
      ...(input.extras?.components ? { components: input.extras.components } : {}),
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

  // Name/Zutaten/Gesamtwerte ändern; alle schon geloggten Tagesanteile werden mit den neuen Werten nachgezogen.
  async function updatePot(potId, input) {
    const pot = (qc.getQueryData(POTS_KEY) || []).find((p) => p.id === potId);
    if (!pot) return;
    setError(null);
    const next = applyPotEdit(pot, input);
    replacePot(qc, next);
    try {
      await enqueue(potId, async () => {
        await savePot(next);
        const deps = depsFor(qc);
        for (const plan of planRescale(next)) await persistPlan(deps, plan, { saveFirst: false });
      });
    } catch (e) {
      fail()(e);
      throw e;
    }
  }

  async function removePot(potId) {
    setError(null);
    qc.setQueryData(POTS_KEY, (list) => (list || []).filter((p) => p.id !== potId));
    try { await enqueue(potId, () => deletePot(potId)); } catch (e) { fail()(e); }
  }

  return { setDay, createPot, updatePot, removePot, error, clearError: () => setError(null) };
}

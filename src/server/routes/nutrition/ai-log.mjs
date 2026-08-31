import { callGemini, extractJson } from "../../services/gemini.mjs";
import { loadLog, saveLog, addMeal } from "../../services/nutrition-log.mjs";
import { writeEntry } from "../../services/nutrition-notes.mjs";
import { loadCatalog, saveCatalog, addOrUpdateItem, upsertLoggedMeal } from "../../services/nutrition-catalog.mjs";
import { saveMicrosForMeal, MICRO_KEYS } from "../../services/nutrition-micros.mjs";
import { todayISO } from "../../../shared/utils/validation.mjs";

export default async function aiLogRoute(app) {
  app.post("/nutrition/ai-log", async (req, reply) => {
    const { text, date: dateArg } = req.body || {};
    const date = dateArg || todayISO();
    if (!text?.trim()) return reply.status(400).send({ ok: false, error: "text fehlt" });

    const prompt = `Analysiere diesen Text. Ist es ein Nahrungs- oder Supplement-Eintrag für heute (meal)? Oder eine Anweisung für den Katalog (Gericht definieren - catalog)? Gib JSON zurück:
      {"type": "meal" | "catalog", "meal": {"description", "kcal", "protein", "carbs", "fat", "micros": {${MICRO_KEYS.join(", ")}}}?}
      Ignoriere Text, der sich nicht auf Ernährung oder Supplemente bezieht.
      Text: ${text}`;
      
    try {
      const raw = await callGemini(prompt);
      const result = JSON.parse(extractJson(raw));
      
      const mealName = result.meal.description;
      if (result.meal.micros) {
        saveMicrosForMeal(mealName, result.meal.kcal || 0, result.meal.micros, "gemini-ai-log");
      }

      if (result.type === "meal") {
        const log = loadLog(date, req.paths.nutrition);
        addMeal(log, result.meal);
        saveLog(log, req.paths.nutrition, {
          nutritionDbPath: req.paths.nutritionDb,
          uid: req.uid,
        });
        upsertLoggedMeal(loadCatalog(req.paths.nutrition, { uid: req.uid }), result.meal);
        return reply.send({ ok: true, type: "meal" });
      } else if (result.type === "catalog") {
        const catalog = loadCatalog(req.paths.nutrition, { uid: req.uid });
        addOrUpdateItem(catalog, { ...result.meal, source: "gemini" });
        saveCatalog(catalog, req.paths.nutrition, { uid: req.uid });
        return reply.send({ ok: true, type: "catalog" });
      } else {
        return reply.status(400).send({ ok: false, error: "Keine Ernährungsinformation erkannt" });
      }
    } catch (e) {
      console.error("ai-log error:", e);
      return reply.status(500).send({ ok: false, error: e.message });
    }
  });
}

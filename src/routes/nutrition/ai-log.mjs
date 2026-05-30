import { callGemini, extractJson } from "../../services/gemini.mjs";
import { loadLog, saveLog, addMeal } from "../../services/nutrition-log.mjs";
import { writeEntry } from "../../services/nutrition-journal.mjs";
import { loadCatalog, saveCatalog } from "../../services/nutrition-catalog.mjs";
import { todayISO } from "../../lib/validation.mjs";

export default async function aiLogRoute(app) {
  app.post("/nutrition/ai-log", async (req, reply) => {
    const { text, date: dateArg } = req.body || {};
    const date = dateArg || todayISO();
    if (!text?.trim()) return reply.status(400).send({ ok: false, error: "text fehlt" });

    const prompt = `Analysiere diesen Text. Entscheide, ob es ein 'meal' (Eintrag für heute), ein 'journal' (Tagebuch) oder eine Anweisung für den 'catalog' (Gericht definieren) ist. Gib JSON zurück:
      {"type": "meal" | "journal" | "catalog", "meal": {"description", "kcal", "protein", "carbs", "fat"}?, "content": "..."?}
      Text: ${text}`;
      
    try {
      const raw = await callGemini(prompt);
      const result = JSON.parse(extractJson(raw));
      
      if (result.type === "meal") {
        const log = loadLog(date);
        addMeal(log, result.meal);
        saveLog(log);
        return reply.send({ ok: true, type: "meal" });
      } else if (result.type === "catalog") {
        const catalog = loadCatalog();
        catalog.items.push({ ...result.meal, id: result.meal.description.toLowerCase().replace(/ /g, "_") });
        saveCatalog(catalog);
        return reply.send({ ok: true, type: "catalog" });
      } else {
        writeEntry(date, result.content || text);
        return reply.send({ ok: true, type: "journal" });
      }
    } catch (e) {
      console.error("ai-log error:", e);
      return reply.status(500).send({ ok: false, error: e.message });
    }
  });
}

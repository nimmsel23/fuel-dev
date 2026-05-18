import { composeMeal } from "../../services/nutrition-compose.mjs";
import { upsertIngredient, createMeal, getMeal } from "../../services/nutrition-db.mjs";
import { loadCatalog, saveCatalog, addOrUpdateItem } from "../../services/nutrition-catalog.mjs";
import { estimateMicros } from "../../services/nutrition-estimate-micros.mjs";
import { loadMicrosCatalog, saveMicrosCatalog, addOrUpdateMicroItem } from "../../services/nutrition-micros.mjs";

export default async function composeRoute(app) {
  // POST /nutrition/estimate — Gemini-powered macro estimation
  app.post("/nutrition/estimate", async (req, reply) => {
    try {
      const { description } = req.body || {};
      if (!description || typeof description !== "string" || description.trim().length === 0) {
        return reply.status(400).send({ ok: false, error: "description required" });
      }

      const { estimateMacros } = await import("../../services/nutrition-estimate.mjs");
      const macros = await estimateMacros(description);
      return reply.send({ ok: true, description, macros });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });

  // POST /nutrition/compose — Compose meal from wger + Gemini (saves to catalog)
  app.post("/nutrition/compose", async (req, reply) => {
    try {
      const { description, save_catalog } = req.body || {};
      if (!description || typeof description !== "string" || description.trim().length === 0) {
        return reply.status(400).send({ ok: false, error: "description required" });
      }

      const composed = await composeMeal(description);

      // Save to catalog if requested
      if (save_catalog && composed.kcal > 0) {
        const catalog = loadCatalog();
        const catalogItem = {
          name: description,
          description: description,
          kcal: composed.kcal,
          protein: composed.protein,
          carbs: composed.carbs,
          fat: composed.fat,
          components: composed.components,
        };
        addOrUpdateItem(catalog, catalogItem);
        saveCatalog(catalog);

        // Also save to SQLite for micronutrient tracking
        for (const comp of composed.components || []) {
          upsertIngredient(comp.wger_id, {
            name: comp.name,
            brand: comp.brand,
            kcal: comp.kcal / (comp.quantity_g / 100),
            protein: comp.protein / (comp.quantity_g / 100),
            carbs: comp.carbs / (comp.quantity_g / 100),
            fat: comp.fat / (comp.quantity_g / 100),
            sodium_mg: comp.sodium_mg ? comp.sodium_mg / (comp.quantity_g / 100) : 0,
          });
        }

        const mealId = createMeal(description, description, composed.components);

        // Estimate and save micronutrients
        const micros = await estimateMicros(description);
        if (Object.keys(micros).length > 0) {
          const microsCatalog = loadMicrosCatalog();
          addOrUpdateMicroItem(microsCatalog, catalogItem, micros);
          saveMicrosCatalog(microsCatalog);
        }

        return reply.send({ ok: true, description, ...composed, saved: true, meal_id: mealId, micros });
      }

      return reply.send({ ok: true, description, ...composed, saved: false });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });

  // GET /nutrition/meal/:id — Get meal with micronutrient data
  app.get("/nutrition/meal/:id", async (req, reply) => {
    try {
      const { id } = req.params;
      const mealId = parseInt(id);
      if (!mealId) {
        return reply.status(400).send({ ok: false, error: "id required" });
      }

      const meal = getMeal(mealId);
      if (!meal) {
        return reply.status(404).send({ ok: false, error: "meal not found" });
      }

      return reply.send({ ok: true, meal });
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ ok: false, error: "Internal server error" });
    }
  });
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { format } from "date-fns";

export const useApp = create((set) => ({
  activeTab: "dashboard",
  activeDate: format(new Date(), "yyyy-MM-dd"),
  setActiveTab: (activeTab) => set({ activeTab }),
  setActiveDate: (activeDate) => set({ activeDate }),
}));

export const useSettings = create(
  persist(
    (set, get) => ({
      kcal_goal: 2000,
      protein_goal: 150,
      water_goal: 2500,
      age: 30,
      gender: "m",
      height_cm: 175,
      weight_kg: 80,
      activity_level: 1.6,
      protein_per_kg: 1.6,
      // Ernährungsspezifische Anamnese — hinter Dropdown im Account-Bereich
      // (FuelProfile.jsx), nicht Pflichtfelder, dienen dem Coach als Kontext.
      nutrition_goal: "halten",
      diet_type: "omnivor",
      // OMAD = eine große Mahlzeit/Tag (z.B. Kaffee tagsüber, spät nach dem
      // Training essen), NOMAD = mehrere Mahlzeiten verteilt, flexibel = mal
      // so mal so. Wird genutzt, um "wenig geloggt heute"-Warnungen nicht
      // fälschlich bei legitimen Ein-Mahlzeit-Tagen zu triggern (User-Hinweis
      // 2026-07-30: das ist bei ihm der Normalfall, kein Rand-Fall).
      eating_pattern: "flexibel",
      weight_goal: "",
      nutrition_focus: "",
      energy_level: "",
      hunger_notes: "",
      nutrition_satisfaction: "",
      intolerances: "",
      chronic_conditions: "",
      medications: "",
      digestive_notes: "",
      nutrition_working: "",
      nutrition_not_working: "",
      supplement_push_enabled: true,
      supplement_push_morning_time: "08:00",
      supplement_push_midday_time: "13:00",
      supplement_push_evening_time: "19:00",
      supplement_push_night_time: "21:00",
      setSetting: (key, val) => {
        set({ [key]: val });
        // Im Hintergrund zu Firestore syncen, falls eingeloggt
        import("./lib/db.firestore.js").then((db) => {
          if (db.getUidOrNull?.()) {
            const current = get();
            db.saveUserSettings({
              kcal_goal: current.kcal_goal,
              protein_goal: current.protein_goal,
              water_goal: current.water_goal,
              age: current.age,
              gender: current.gender,
              height_cm: current.height_cm,
              weight_kg: current.weight_kg,
              activity_level: current.activity_level,
              protein_per_kg: current.protein_per_kg,
              nutrition_goal: current.nutrition_goal,
              diet_type: current.diet_type,
              eating_pattern: current.eating_pattern,
              weight_goal: current.weight_goal,
              nutrition_focus: current.nutrition_focus,
              energy_level: current.energy_level,
              hunger_notes: current.hunger_notes,
              nutrition_satisfaction: current.nutrition_satisfaction,
              intolerances: current.intolerances,
              chronic_conditions: current.chronic_conditions,
              medications: current.medications,
              digestive_notes: current.digestive_notes,
              nutrition_working: current.nutrition_working,
              nutrition_not_working: current.nutrition_not_working,
              supplement_push_enabled: current.supplement_push_enabled,
              supplement_push_morning_time: current.supplement_push_morning_time,
              supplement_push_midday_time: current.supplement_push_midday_time,
              supplement_push_evening_time: current.supplement_push_evening_time,
              supplement_push_night_time: current.supplement_push_night_time,
            }).catch(err => console.error("Cloud sync failed:", err));
          }
        });
      },
      hydrateFromCloud: async () => {
        try {
          const db = await import("./lib/db.firestore.js");
          if (db.getUidOrNull?.()) {
            const cloudSettings = await db.getUserSettings();
            if (cloudSettings) {
              set(cloudSettings);
            }
          }
        } catch (err) {
          console.error("Failed to fetch settings from cloud:", err);
        }
      }
    }),
    { name: "fuel-settings" }
  )
);

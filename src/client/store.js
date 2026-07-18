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

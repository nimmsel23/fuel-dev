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
      setSetting: (key, val) => {
        set({ [key]: val });
        // Im Hintergrund zu Firestore syncen, falls eingeloggt
        import("./lib/db.firestore.js").then((db) => {
          if (db.getUid()) {
            const current = get();
            db.saveUserSettings({
              kcal_goal: current.kcal_goal,
              protein_goal: current.protein_goal,
              water_goal: current.water_goal,
              age: current.age,
              gender: current.gender,
            }).catch(err => console.error("Cloud sync failed:", err));
          }
        });
      },
      hydrateFromCloud: async () => {
        try {
          const db = await import("./lib/db.firestore.js");
          if (db.getUid()) {
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

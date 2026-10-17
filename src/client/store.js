import { create } from "zustand";
import { persist } from "zustand/middleware";
import { format } from "date-fns";

export const useApp = create((set) => ({
  activeTab: "dashboard",
  activeDate: format(new Date(), "yyyy-MM-dd"),
  // Cloud: true, sobald hydrateFromCloud() den Geräte-Eintrag (Schnelleinstieg)
  // aufgelöst hat — vorher darf der FrontdoorChooser nicht erscheinen.
  frontdoorResolved: false,
  setFrontdoorResolved: (frontdoorResolved) => set({ frontdoorResolved }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setActiveDate: (activeDate) => set({ activeDate }),
}));

// fuel-Settings-Key → Feld im app-übergreifenden Profil (users/{uid}/meta/profile,
// lib/db/firestore/profile.js). Diese Keys landen nicht mehr in meta/settings.
const PROFILE_MAP = {
  gender: "gender",
  age: "age",
  height_cm: "heightCm",
  weight_kg: "weightKg",
  chronic_conditions: "chronicConditions",
  medications: "medications",
};

export const useSettings = create(
  persist(
    (set, get) => ({
      kcal_goal: 2000,
      protein_goal: 150,
      water_goal: 2500,
      // Protein steht als Gramm-Ziel fest (g/kg-Faustregel, s.u.) — carb_ratio
      // legt fest, wie sich die nach Protein verbleibenden kcal auf Carbs/Fett
      // aufteilen (% davon als Carbs, Rest als Fett). Presets siehe GoalsSection.jsx.
      carb_ratio: 50,
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
      daily_fuel_quick_log_enabled: true,
      daily_fuel_quick_log_time: "09:30",
      daily_journal_entry_enabled: true,
      daily_journal_entry_time: "20:30",
      // Welche der drei Log-Ansichten (Liste/Dashboard/Timeline) im Log-Tab
      // gerendert wird — siehe LogView.jsx + Log/components/MealList*.jsx.
      log_view_mode: "minimal",
      // Schnelleinstieg beim App-Start: "tapboard" | "shutter" | "tagesfaden"
      // | "classic". null = auf diesem Gerät noch nie gewählt → FrontdoorChooser
      // (views/Frontdoor/). Gilt pro Gerät: in der Cloud liegt er nicht in
      // meta/settings, sondern in users/{uid}/devices/{deviceId}
      // (lib/db/firestore/devices.js) — ein neues Gerät wird neu gefragt.
      frontdoor: null,
      setSetting: (key, val) => {
        set({ [key]: val });
        if (key === "frontdoor") {
          import("./lib/db.firestore.js").then((db) => {
            if (db.getUidOrNull?.()) {
              db.saveDevice(val).catch(err => console.error("Device sync failed:", err));
            }
          });
          return;
        }
        if (PROFILE_MAP[key]) {
          import("./lib/db.firestore.js").then((db) => {
            if (db.getUidOrNull?.()) {
              db.saveSharedProfile({ [PROFILE_MAP[key]]: val }).catch(err => console.error("Profile sync failed:", err));
            }
          });
          return;
        }
        // Im Hintergrund zu Firestore syncen, falls eingeloggt
        import("./lib/db.firestore.js").then((db) => {
          if (db.getUidOrNull?.()) {
            const current = get();
            db.saveUserSettings({
              kcal_goal: current.kcal_goal,
              protein_goal: current.protein_goal,
              water_goal: current.water_goal,
              carb_ratio: current.carb_ratio,
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
              digestive_notes: current.digestive_notes,
              nutrition_working: current.nutrition_working,
              nutrition_not_working: current.nutrition_not_working,
              supplement_push_enabled: current.supplement_push_enabled,
              supplement_push_morning_time: current.supplement_push_morning_time,
              supplement_push_midday_time: current.supplement_push_midday_time,
              supplement_push_evening_time: current.supplement_push_evening_time,
              supplement_push_night_time: current.supplement_push_night_time,
              daily_fuel_quick_log_enabled: current.daily_fuel_quick_log_enabled,
              daily_fuel_quick_log_time: current.daily_fuel_quick_log_time,
              daily_journal_entry_enabled: current.daily_journal_entry_enabled,
              daily_journal_entry_time: current.daily_journal_entry_time,
              log_view_mode: current.log_view_mode,
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
              // frontdoor ist geräte-, nicht kontoweit (Altbestand im Settings-Doc ignorieren).
              const { frontdoor: _legacyFrontdoor, ...rest } = cloudSettings;
              set(rest);
            }
            // Gemeinsames Profil: gewinnt gegen Altwerte aus meta/settings; fehlende
            // Felder werden aus diesen Altwerten einmalig ins Profil übernommen.
            const profile = await db.getSharedProfile();
            const backfill = {};
            for (const [key, pKey] of Object.entries(PROFILE_MAP)) {
              if (profile?.[pKey] !== undefined) set({ [key]: profile[pKey] });
              else if (cloudSettings?.[key] !== undefined && cloudSettings[key] !== "") backfill[pKey] = cloudSettings[key];
            }
            if (Object.keys(backfill).length) {
              // await: das nächste saveUserSettings() überschreibt meta/settings ohne diese Felder.
              await db.saveSharedProfile(backfill);
            }
            const device = await db.getDevice();
            const deviceFrontdoor = device?.prefs?.fuel?.frontdoor;
            if (deviceFrontdoor) {
              set({ frontdoor: deviceFrontdoor });
              db.saveDevice(deviceFrontdoor).catch(() => {}); // last_seen_at
            } else if (get().frontdoor) {
              // Gerät kennt seine Wahl lokal, hat aber noch keinen Eintrag
              // (Altbestand / offline gewählt) → still registrieren, nicht neu fragen.
              db.saveDevice(get().frontdoor).catch(err => console.error("Device sync failed:", err));
            }
            // sonst: neues Gerät → frontdoor bleibt null → FrontdoorChooser
          }
        } catch (err) {
          console.error("Failed to fetch settings from cloud:", err);
        } finally {
          useApp.getState().setFrontdoorResolved(true);
        }
      }
    }),
    { name: "fuel-settings" }
  )
);

import { STORE_BUILD } from "./cloudEnv.js";

// KI (Gemini/Vertex) ist im Store-Build aus: Datenschutzerklärung und Data Safety sagen,
// dass keine Nutzerdaten an KI-Dienste gehen. UI-Einstiege prüfen AI_ENABLED, der Guard
// unten ist das Sicherheitsnetz für jeden Aufrufpfad.
export const AI_ENABLED = !STORE_BUILD;

export function assertLegacyAiAvailable(product = STORE_BUILD) {
  if (product) throw new Error("Diese KI-Funktion ist in VitalOS derzeit nicht verfügbar. Nutze Smart Log im Journal oder erfasse die Daten manuell.");
}

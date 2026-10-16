import { changeLog } from "./cloudLogState.js";

// Optimistische Anzeige für Mahlzeit-Änderungen: den Tages-Cache ["nutrition", date] sofort mit dem Befehl patchen —
// derselbe changeLog wie bei der Outbox-Projektion und der Firestore-Transaktion, Anzeige und späteres Ergebnis sind
// also identisch. Das Speichern selbst quittiert die Outbox schon nach dem lokalen Sichern (api.cloud.js, background).
// Bei einem Fehler wird nur neu geladen — nie ein alter Tages-Snapshot zurückgeschrieben (würde parallele Änderungen
// anderer Befehle überschreiben).
export async function patchNutritionDay(qc, date, command) {
  const key = ["nutrition", date];
  await qc.cancelQueries({ queryKey: key, exact: true });
  qc.setQueryData(key, current => {
    try { return changeLog("nutrition", current || { date, meals: [] }, command); }
    catch { return current; } // z. B. Eintrag schon gelöscht — die echte Antwort zeigt der Refetch
  });
  return { key };
}

export const reloadNutritionDay = (qc, date) => qc.invalidateQueries({ queryKey: ["nutrition", date], exact: true });

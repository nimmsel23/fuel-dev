// Reine Formular-Helfer der Mahlzeit-Eingabe (aus LogView.jsx herausgelöst, Verhalten unverändert).

export function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function emptyForm() {
  return { id: null, type: "breakfast", description: "", notes: "", kcal: "", protein: "", carbs: "", fat: "", grams: "", time: nowHHMM() };
}

// HH:MM (lokal) aus einem gespeicherten ISO-Timestamp, für den Edit-Modus.
export function hhmmFromISO(iso) {
  if (!iso) return nowHHMM();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return nowHHMM();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

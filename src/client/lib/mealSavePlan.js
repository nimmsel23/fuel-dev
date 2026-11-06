import { normalizeMealMacros } from "./mealMacros.js";
import { mealDetails } from "./mealDetails.js";

// date (YYYY-MM-DD) + HH:MM (lokal) → ISO-Timestamp, wie ihn der Server
// erwartet (logged_at/time). Ohne "Z"-Suffix parst der Date-Constructor
// YYYY-MM-DDTHH:MM als lokale Zeit, toISOString() normalisiert auf UTC.
export function toLoggedAt(date, hhmm) {
  if (!date || !hhmm) return new Date().toISOString();
  const d = new Date(`${date}T${hhmm}:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// Speicher-Plan: Request-Body UND der optimistische Befehl aus denselben Werten (inkl. vorab erzeugter ID),
// damit der sofort angezeigte Eintrag exakt dem entspricht, was später in die Cloud geschrieben wird.
// Aus LogView.jsx herausgelöst (unverändertes Verhalten); newId ist injizierbar für Tests.
export function buildMealSavePlan({ form, date, moveDate, newId = () => crypto.randomUUID() }) {
  const isEditing = Boolean(form.id);
  const fields = {
    ...mealDetails(form), type: form.type, description: form.description, notes: form.notes,
    ...normalizeMealMacros(form),
    grams: Number(form.grams) || null,
  };
  if (isEditing) {
    const body = { date, meal_id: form.id, meal: { ...fields, time: toLoggedAt(moveDate || date, form.time) } };
    if (moveDate && moveDate !== date) body.new_date = moveDate;
    // Verschieben auf einen anderen Tag bleibt ohne optimistische Anzeige (zwei Tage betroffen) — der Refetch zeigt es.
    return { edit: true, body, optimistic: body.new_date ? null : { meal_id: form.id, meal: { ...body.meal, logged_at: body.meal.time } } };
  }
  const meal = { ...fields, id: newId(), time: toLoggedAt(date, form.time) };
  return { edit: false, body: { date, meal }, optimistic: { meal: { ...meal, logged_at: meal.time } } };
}

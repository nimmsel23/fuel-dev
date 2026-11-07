// Journal-Abgleich (reine Logik — bewusst ohne Firebase-/Vertex-Import, damit sie testbar ist;
// Muster wie lib/kitchenLogic.js). Der Gemini-Aufruf liegt in lib/journalCheckAi.js.

export function buildJournalCheckPrompt(journalText, meals) {
  const loggedList = meals.length
    ? meals.map((m) => `- ${m.description}`).join("\n")
    : "(nichts geloggt)";

  return `Hier ist ein Freitext-Tagebucheintrag und die Liste der für heute bereits geloggten Mahlzeiten.
Prüfe, ob im Tagebuch Essen, Getränke oder Supplemente erwähnt werden, die NICHT in der Log-Liste stehen.
Gib nur eindeutig erwähnte, konkrete Ernährungs-Infos zurück, keine Vermutungen. Schätze für jeden fehlenden Punkt die Makros.

Tagebuch:
"""
${journalText}
"""

Bereits geloggt:
${loggedList}`;
}

export function parseJournalCheckResponse(rawText) {
  const parsed = JSON.parse(rawText);
  return parsed?.missing || [];
}

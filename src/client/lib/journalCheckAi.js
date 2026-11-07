// Vergleicht Journal-Freitext gegen die bereits geloggten Mahlzeiten des Tages
// und liefert nur eindeutig erwähnte, aber nicht geloggte Ernährungs-Infos zurück.
// Herausgelöst aus views/Log/LogView.jsx (Schritt 3 der LogView-Zerlegung);
// Muster wie lib/kitchenAi.js: Firebase-Import nur hier, reine Prompt-/Parse-Logik
// in lib/journalCheck.js (dort getestet).
import { assertLegacyAiAvailable } from "./aiAvailability.js";
import { vertexAI } from "./firebase.js";
import { getGenerativeModel, SchemaType } from "firebase/ai";
import { withAiRetry } from "./aiRetry.js";
import { buildJournalCheckPrompt, parseJournalCheckResponse } from "./journalCheck.js";

export async function checkJournalAgainstLog(journalText, meals) {
  assertLegacyAiAvailable();
  const model = getGenerativeModel(vertexAI, {
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          missing: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                kcal: { type: SchemaType.NUMBER },
                protein: { type: SchemaType.NUMBER },
                carbs: { type: SchemaType.NUMBER },
                fat: { type: SchemaType.NUMBER },
              }
            }
          }
        }
      }
    }
  });

  const prompt = buildJournalCheckPrompt(journalText, meals);
  const result = await withAiRetry(() => model.generateContent(prompt));
  return parseJournalCheckResponse(result.response.text());
}

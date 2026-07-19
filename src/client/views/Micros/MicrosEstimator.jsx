import React, { useState } from "react";
import { X, Wand2, Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postJson } from "@api";
import { NUTRIENTS } from "./utils.js";
import { MICRO_KEYS } from "../../lib/db/firestore/utils.js";
import { vertexAI } from "../../lib/firebase.js";
import { getGenerativeModel, SchemaType } from "firebase/vertexai";
import { withAiRetry } from "../../lib/aiRetry.js";

const isCloud = () => window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com");

export default function MicrosEstimator({ missingMeals, onClose }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [remaining, setRemaining] = useState(null);

  const mutation = useMutation({
    mutationFn: (items) => postJson("/nutrition/micros", { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nutrition-weekly"] });
    },
  });

  async function estimateMeals(mealsToProcess = missingMeals) {
    if (mealsToProcess.length === 0) return;
    setLoading(true);
    setError(null);
    setProgress(0);

    const estimatedItems = [];
    const cloud = isCloud();
    let failedAt = -1;
    let failureMessage = "";

    for (let i = 0; i < mealsToProcess.length; i++) {
      const mealName = mealsToProcess[i];

      try {
        let estimatedMicros;
        if (cloud && vertexAI) {
          const model = getGenerativeModel(vertexAI, {
            model: "gemini-2.5-flash",
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                  kcal: { type: SchemaType.NUMBER, description: "Geschätzte Gesamtkalorien" },
                  ...Object.fromEntries(MICRO_KEYS.map(k => [k, { type: SchemaType.NUMBER, description: `Wert in der jeweiligen Einheit` }]))
                },
              }
            }
          });

          const prompt = `Du bist Ernährungs-Experte. Schätze die absoluten Mikronährstoffe für: "${mealName}".
Antworte exakt in den folgenden Einheiten (Zahlenwert als Number):
${NUTRIENTS.map(n => `- ${n.key}: in ${n.unit}`).join("\\n")}

Beispiel: {"kcal": 450, "vitamin_c_mg": 12.5, "iron_mg": 2.1, ...}`;

          const result = await withAiRetry(() => model.generateContent(prompt));
          estimatedMicros = JSON.parse(result.response.text());
        } else {
          // Local Stub / Throw Error
          throw new Error("Vertex AI (Local) currently not implemented. Please use Cloud Mode.");
        }

        estimatedItems.push({
          meal_name: mealName,
          kcal: estimatedMicros.kcal || 0,
          ...Object.fromEntries(MICRO_KEYS.map(k => [k, estimatedMicros[k] || 0]))
        });

        setProgress(Math.round(((i + 1) / mealsToProcess.length) * 100));
      } catch (e) {
        console.error(e);
        failedAt = i;
        failureMessage = e.message || "Fehler bei der Schätzung";
        break;
      }
    }

    // Bereits geschätzte Items sichern, auch wenn ein späteres Item fehlschlägt —
    // bei einem Bulk-Nachtrag über viele Mahlzeiten (z.B. abends für den ganzen
    // Tag) darf ein einzelner Fehler nicht den bisherigen Fortschritt kosten.
    if (estimatedItems.length > 0) {
      try {
        await mutation.mutateAsync(estimatedItems);
      } catch (e) {
        console.error(e);
        setLoading(false);
        setError(`Speichern fehlgeschlagen: ${e.message || "Unbekannter Fehler"}`);
        setRemaining(mealsToProcess);
        return;
      }
    }

    setLoading(false);

    if (failedAt >= 0) {
      setRemaining(mealsToProcess.slice(failedAt));
      setError(
        `${estimatedItems.length} von ${mealsToProcess.length} gespeichert. ` +
        `Fehler bei "${mealsToProcess[failedAt]}": ${failureMessage}`
      );
    } else {
      setRemaining(null);
      setSuccess(true);
      setTimeout(onClose, 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-white/10">

        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <div className="flex items-center gap-2 text-violet-400">
            <Wand2 className="h-5 w-5" />
            <h3 className="font-semibold text-slate-100">Vertex AI Estimator</h3>
          </div>
          <button onClick={onClose} disabled={loading} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100 disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-sm text-slate-300">
          {success ? (
            <div className="flex flex-col items-center py-8 text-emerald-400">
              <CheckCircle2 className="mb-3 h-12 w-12" />
              <p className="text-center font-medium">Lücken erfolgreich gefüllt!</p>
              <p className="mt-1 text-xs text-slate-400">Die Heatmap wird aktualisiert...</p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-slate-400">
                Es wurden <strong>{missingMeals.length} Mahlzeiten</strong> in den letzten Wochen gefunden, für die noch keine Mikronährstoff-Daten hinterlegt sind.
              </p>
              <ul className="mb-6 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-3 font-mono text-xs text-slate-400">
                {(remaining || missingMeals).map((m, i) => (
                  <li key={i} className="truncate pb-1 border-b border-white/5 last:border-0 last:pb-0 pt-1 first:pt-0">
                    - {m}
                  </li>
                ))}
              </ul>

              {error && (
                <div className="mb-4 rounded-lg bg-rose-500/10 p-3 text-rose-400">{error}</div>
              )}

              <button
                onClick={() => estimateMeals(remaining || missingMeals)}
                disabled={loading || missingMeals.length === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-3 font-medium text-white transition-transform active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Schätze... ({progress}%)
                  </>
                ) : remaining ? (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Weiter schätzen & Speichern ({remaining.length})
                  </>
                ) : (
                  <>Schätzen & Speichern</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

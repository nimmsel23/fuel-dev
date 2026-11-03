import { missingMealMacros } from "../lib/mealMacros.js";
import { AlertTriangle } from "lucide-react";

export default function NutritionDataNotice({ nutrition, error, onRetry }) {
  const partial = nutrition?.local_base_unavailable;
  const missing = missingMealMacros(nutrition?.meals);
  const labels = { kcal: "Kalorien", protein: "Protein", carbs: "Kohlenhydrate", fat: "Fett" };
  const missingLabels = Object.keys(labels).filter(key => missing[key] > 0).map(key => labels[key]);
  if (!partial && !error && !missingLabels.length) return null;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {(partial || error) && <p>{partial
          ? "Nur lokal vorgemerkte Einträge sind sichtbar. Der gespeicherte Tagesstand fehlt auf diesem Gerät; Summen und Liste können unvollständig sein."
          : "Der Tagesstand konnte nicht geladen werden. Angezeigte Werte können fehlen oder veraltet sein."} Verbinde dich und lade den Tag erneut.</p>}
        {missingLabels.length > 0 && <p>Für mindestens eine Mahlzeit fehlen Werte: {missingLabels.join(", ")}. Die angezeigten Summen und Zielanzeigen enthalten nur bekannte Werte.</p>}
      </div>
      {(partial || error) && onRetry && <button type="button" onClick={() => onRetry()} className="rounded-lg border border-amber-300/30 px-3 py-1.5 text-xs font-semibold hover:bg-amber-300/10">Erneut laden</button>}
    </div>
  );
}

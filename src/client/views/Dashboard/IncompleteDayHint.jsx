import { AlertTriangle } from "lucide-react";
import { useSettings } from "../../store.js";

// Warnt abends, wenn die Tagessumme deutlich unter dem Ziel liegt — NICHT
// nach Anzahl Mahlzeiten (User-Hinweis 2026-07-30: OMAD-Tage mit einer
// einzigen riesigen Portion nach spätem Training sind legitim und dürfen
// nicht als "unvollständig" markiert werden, nur echte Logging-Lücken).
// Datengrundlage: 30-Tage-Auswertung zeigte Tage mit wenigen Einträgen im
// Schnitt bei 746 kcal vs. 2022 kcal an Tagen mit vollständigerem Log.
const EVENING_HOUR = 18;
const LOW_THRESHOLD = 0.5; // unter 50% vom Ziel

export default function IncompleteDayHint({ totalKcal, isToday }) {
  const { kcal_goal } = useSettings();
  const hour = new Date().getHours();

  if (!isToday || hour < EVENING_HOUR) return null;
  if (!kcal_goal || totalKcal >= kcal_goal * LOW_THRESHOLD) return null;

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        Erst {Math.round(totalKcal)} von {kcal_goal} kcal geloggt, und es ist schon Abend — sicher dass
        das schon alles war heute?
      </span>
    </div>
  );
}

import { AlertTriangle } from "lucide-react";

export default function NutritionDataNotice({ nutrition, error, onRetry }) {
  const partial = nutrition?.local_base_unavailable;
  if (!partial && !error) return null;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {partial
          ? "Nur lokal vorgemerkte Einträge sind sichtbar. Der gespeicherte Tagesstand fehlt auf diesem Gerät; Summen und Liste können unvollständig sein."
          : "Der Tagesstand konnte nicht geladen werden. Angezeigte Werte können fehlen oder veraltet sein."}
        {" "}Verbinde dich und lade den Tag erneut.
      </div>
      {onRetry && <button type="button" onClick={() => onRetry()} className="rounded-lg border border-amber-300/30 px-3 py-1.5 text-xs font-semibold hover:bg-amber-300/10">Erneut laden</button>}
    </div>
  );
}

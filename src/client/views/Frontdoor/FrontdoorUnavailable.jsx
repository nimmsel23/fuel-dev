import { Info } from "lucide-react";

// Platzhalter für Schnelleinstiege, die im Store-Build nicht laufen (KI-Erkennung aus).
// Wird nur erreicht, wenn die Shell den Einstieg noch in ihrer Navigation führt oder auf dem
// Gerät noch ein früher gewählter Einstieg gespeichert ist.
export default function FrontdoorUnavailable({ onOpenApp, title = "Nicht in dieser Version" }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur">
      <Info className="mx-auto h-6 w-6 text-slate-400" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-semibold text-slate-100">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
        Foto- und Texterkennung per KI gibt es in dieser Version nicht. Mahlzeiten trägst du per Schnellwahl, Katalog, Barcode oder von Hand ein.
      </p>
      <button
        type="button"
        onClick={() => onOpenApp?.("log")}
        className="mt-5 rounded-full bg-sky-300 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-sky-200"
      >
        Zum Log
      </button>
    </section>
  );
}

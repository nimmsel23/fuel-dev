import React, { Suspense } from "react";
import { ChevronDown, Loader2, Settings2 } from "lucide-react";
import { getFrontdoor } from "./frontdoors.js";
import { useFrontdoorLog } from "./useFrontdoorLog.js";

function greeting(h = new Date().getHours()) {
  if (h < 10) return "Morgen";
  if (h < 14) return "Mahlzeit";
  if (h < 18) return "Nachmittag";
  return "Abend";
}

// Rahmen um den gewählten Frontdoor: Kopfzeile, Datum, Ausgang in die volle
// App. Die Frontdoors selbst kümmern sich nur ums Loggen.
export default function FrontdoorHost({ frontdoorKey, userName, onEnterApp, onOpenApp }) {
  const fd = useFrontdoorLog();
  const entry = getFrontdoor(frontdoorKey);
  if (!entry?.View) return null;
  const View = entry.View;

  const dateLabel = new Date(fd.date).toLocaleDateString("de-AT", { weekday: "short", day: "numeric", month: "short" });

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {greeting()}{userName ? `, ${userName}` : ""}.
            </h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
              {dateLabel} · {entry.label}
            </p>
          </div>
          <button
            onClick={() => onOpenApp("settings")}
            aria-label="Setup"
            className="rounded-full p-2 text-slate-500 transition hover:bg-white/10 hover:text-white"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </header>

        <Suspense fallback={
          <div className="flex items-center justify-center gap-3 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> lädt …
          </div>
        }>
          <View fd={fd} onOpenApp={onOpenApp} />
        </Suspense>

        <button
          onClick={onEnterApp}
          className="mx-auto mt-8 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs uppercase tracking-[0.16em] text-slate-400 transition hover:bg-white/10 hover:text-slate-200"
        >
          <ChevronDown className="h-4 w-4" />
          Alles anzeigen
        </button>
      </div>
    </div>
  );
}

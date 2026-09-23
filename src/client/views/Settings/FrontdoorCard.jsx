import React from "react";
import { Check } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { FRONTDOORS, ACCENT } from "../Frontdoor/frontdoors.js";
import { useSettings } from "../../store.js";

// Schnelleinstieg jederzeit umstellbar — dieselbe Auswahl wie beim ersten
// Start (views/Frontdoor/FrontdoorChooser.jsx).
export default function FrontdoorCard({ sectionCls }) {
  const frontdoor = useSettings((s) => s.frontdoor);
  const setSetting = useSettings((s) => s.setSetting);
  const active = frontdoor || "classic";

  return (
    <section className={sectionCls}>
      <div>
        <h3 className="text-lg font-semibold text-slate-100">Schnelleinstieg</h3>
        <p className="mt-1 text-sm text-slate-400">
          Was die App beim Öffnen zeigt. Über „Alles anzeigen" kommst du aus jedem Einstieg in die volle App.
        </p>
      </div>

      <div className="grid gap-2">
        {FRONTDOORS.map((f) => {
          const a = ACCENT[f.accent];
          const on = active === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setSetting("frontdoor", f.key)}
              aria-pressed={on}
              className={twMerge(
                "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border p-4 text-left transition",
                on ? a.ring : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]",
              )}
            >
              <span className={twMerge("grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-slate-950", a.text)}>
                <f.Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-100">{f.label}</span>
                <span className="block text-xs text-slate-400">{f.tagline}</span>
              </span>
              <span className={twMerge(
                "grid h-5 w-5 place-items-center rounded-full border",
                on ? "border-transparent bg-slate-100 text-slate-950" : "border-white/20 text-transparent",
              )}>
                <Check className="h-3 w-3" />
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

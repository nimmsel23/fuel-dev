import React from "react";
import { Check } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { FRONTDOORS, ACCENT } from "./frontdoors.js";
import { useSettings } from "../../store.js";

// Erster Start: der Nutzer legt fest, womit die App aufgeht. Änderbar
// jederzeit im Setup-Tab (Settings/FrontdoorCard.jsx).
export default function FrontdoorChooser() {
  const setSetting = useSettings((s) => s.setSetting);
  // Vorauswahl bewusst Shutter: für Klienten, die selten loggen, ist "Foto
  // machen" die niedrigste Hürde. Wer ohnehin Routine-Esser ist, wechselt mit
  // einem Klick auf Tap Board.
  const [picked, setPicked] = React.useState("shutter");

  const confirm = () => setSetting("frontdoor", picked);

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950">
      <div className="mx-auto grid w-full max-w-3xl gap-6 px-5 py-10">
        <header>
          <p className="text-xs uppercase tracking-[0.25em] text-orange-300">Einmalige Einrichtung</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">
            Womit soll Fuel aufgehen?
          </h1>
          <p className="mt-3 max-w-xl text-sm text-slate-400">
            Der Schnelleinstieg entscheidet, wie viele Schritte zwischen „App auf" und „geloggt" liegen.
            Du kannst ihn jederzeit im Setup wechseln.
          </p>
        </header>

        <div className="grid gap-3">
          {FRONTDOORS.map((f) => {
            const a = ACCENT[f.accent];
            const active = picked === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setPicked(f.key)}
                aria-pressed={active}
                className={twMerge(
                  "grid grid-cols-[auto_1fr_auto] items-start gap-4 rounded-3xl border p-5 text-left transition",
                  active ? a.ring : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                )}
              >
                <span className={twMerge("grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-slate-950", a.text)}>
                  <f.Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-slate-100">{f.label}</span>

                  </span>
                  <span className={twMerge("mt-0.5 block text-sm", a.text)}>{f.tagline}</span>
                  <span className="mt-2 block text-sm leading-relaxed text-slate-400">{f.description}</span>
                  <span className="mt-2 block text-[10px] uppercase tracking-[0.14em] text-slate-600">{f.best}</span>
                </span>
                <span className={twMerge(
                  "mt-1 grid h-6 w-6 place-items-center rounded-full border",
                  active ? "border-transparent bg-slate-100 text-slate-950" : "border-white/20 text-transparent",
                )}>
                  <Check className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })}
        </div>

        <button onClick={confirm} className="w-full rounded-2xl bg-orange-400 py-4 text-base font-semibold text-slate-950">
          Los geht's
        </button>
      </div>
    </div>
  );
}

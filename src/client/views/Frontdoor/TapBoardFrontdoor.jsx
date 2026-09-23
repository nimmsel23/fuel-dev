import React from "react";
import { Camera, Mic, Search, Check, Undo2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { SLOT_LABEL, slotOf } from "./useFrontdoorLog.js";

const PORTIONS = [
  { label: "½", factor: 0.5 },
  { label: "1×", factor: 1 },
  { label: "1½", factor: 1.5 },
  { label: "2×", factor: 2 },
];

// Frontdoor "Tap Board": das eigene Essen als Kachelfeld, ein Tap loggt.
// Lange drücken öffnet die Portionswahl — der einzige Wert, der realistisch
// abweicht. Alles andere kommt aus Katalog/Verlauf.
export default function TapBoardFrontdoor({ fd, onOpenApp }) {
  const { suggestions, logMeal, undoLast, lastLogged, clearLastLogged, totals, kcalGoal } = fd;
  const [sheet, setSheet] = React.useState(null);
  const [factor, setFactor] = React.useState(1);
  const holdRef = React.useRef(null);
  const heldRef = React.useRef(false);

  const tiles = suggestions.slice(0, 8);
  const slot = SLOT_LABEL[slotOf()];

  React.useEffect(() => {
    if (!lastLogged) return undefined;
    const t = setTimeout(() => clearLastLogged(), 6000);
    return () => clearTimeout(t);
  }, [lastLogged, clearLastLogged]);

  const startHold = (item) => {
    heldRef.current = false;
    holdRef.current = setTimeout(() => {
      heldRef.current = true;
      setFactor(1);
      setSheet(item);
    }, 320);
  };
  const endHold = (item) => {
    clearTimeout(holdRef.current);
    if (!heldRef.current && !sheet) {
      logMeal.mutate({ ...item, description: item.description });
    }
    heldRef.current = false;
  };

  const scaled = (item, f) => ({
    ...item,
    kcal: (item.kcal || 0) * f,
    protein: (item.protein || 0) * f,
    carbs: (item.carbs || 0) * f,
    fat: (item.fat || 0) * f,
    description: f === 1 ? item.description : `${item.description} (${PORTIONS.find((p) => p.factor === f)?.label || f + "×"})`,
  });

  const pct = Math.min(100, Math.round((totals.kcal / (kcalGoal || 2000)) * 100));

  return (
    <div className="relative grid gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-orange-300">{slot}</span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <KcalRing value={Math.round(totals.kcal)} pct={pct} />
      </div>
      <p className="-mt-2 text-sm text-slate-500">Was du sonst um diese Zeit isst — ein Tap loggt.</p>

      {tiles.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-slate-400">
          Noch keine Kacheln — sie entstehen aus deinen ersten Logs.
          <button onClick={() => onOpenApp("log")} className="mt-3 block w-full rounded-2xl bg-orange-400 px-4 py-3 font-semibold text-slate-950">
            Erste Mahlzeit anlegen
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {tiles.map((item) => (
            <motion.button
              key={item.key}
              whileTap={{ scale: 0.96 }}
              onPointerDown={() => startHold(item)}
              onPointerUp={() => endHold(item)}
              onPointerLeave={() => clearTimeout(holdRef.current)}
              onContextMenu={(e) => e.preventDefault()}
              className={twMerge(
                "relative flex min-h-[118px] flex-col justify-between rounded-2xl border p-4 text-left transition",
                item.slotCount > 0
                  ? "border-orange-400/40 bg-orange-400/10 hover:bg-orange-400/15"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              )}
            >
              {item.count > 0 && (
                <span className="absolute right-3 top-3 font-mono text-[9px] uppercase tracking-[0.12em] text-orange-300/70">
                  {item.count}× / 30 T
                </span>
              )}
              <span className="pr-10 text-sm font-semibold leading-tight text-slate-100">{item.description}</span>
              <span className="mt-2 flex gap-3 font-mono text-[10.5px] tabular-nums text-slate-500">
                <span className="text-slate-200">{Math.round(item.kcal)} kcal</span>
                <span>{Math.round(item.protein)} P</span>
              </span>
            </motion.button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <QuickBtn Icon={Camera} label="Foto" onClick={() => onOpenApp("log")} />
        <QuickBtn Icon={Mic} label="Diktieren" onClick={() => onOpenApp("log")} />
        <QuickBtn Icon={Search} label="Suchen" onClick={() => onOpenApp("food")} />
      </div>

      <p className="text-center text-[11px] text-slate-600">Lange drücken für Portion &amp; Details</p>

      <AnimatePresence>
        {lastLogged && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed inset-x-4 bottom-6 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-emerald-400/40 bg-slate-950/95 p-4 shadow-xl backdrop-blur"
          >
            <Check className="h-5 w-5 shrink-0 text-emerald-400" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-100">{lastLogged.description}</div>
              <div className="text-[11px] tabular-nums text-slate-400">
                {Math.round(lastLogged.kcal)} kcal · {Math.round(lastLogged.protein)} P · {Math.round(lastLogged.carbs)} K · {Math.round(lastLogged.fat)} F
              </div>
            </div>
            <button
              onClick={() => undoLast.mutate()}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-orange-400/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-orange-300"
            >
              <Undo2 className="h-3.5 w-3.5" /> Zurück
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 sm:items-center sm:p-6" onClick={() => setSheet(null)}>
          <div
            className="w-full max-w-md rounded-t-3xl border border-white/10 bg-slate-900 p-6 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-100">{sheet.description}</h3>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-slate-500">
              {sheet.catalog_id ? "aus Katalog" : "aus deinem Verlauf"}
            </p>

            <div className="mt-5 text-[10px] uppercase tracking-[0.18em] text-slate-500">Portion</div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {PORTIONS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setFactor(p.factor)}
                  className={twMerge(
                    "rounded-xl border py-3 text-sm tabular-nums transition",
                    factor === p.factor
                      ? "border-orange-400 bg-orange-400 font-semibold text-slate-950"
                      : "border-white/10 bg-white/5 text-slate-300",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
              {[["kcal", sheet.kcal], ["Prot", sheet.protein], ["KH", sheet.carbs], ["Fett", sheet.fat]].map(([k, v]) => (
                <div key={k} className="bg-slate-950 p-3 text-center">
                  <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">{k}</div>
                  <div className="mt-1 text-base font-semibold tabular-nums text-slate-100">{Math.round((v || 0) * factor)}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => { logMeal.mutate(scaled(sheet, factor)); setSheet(null); }}
              className="mt-5 w-full rounded-2xl bg-orange-400 py-4 font-semibold text-slate-950"
            >
              Loggen
            </button>
            <button onClick={() => setSheet(null)} className="mt-2 w-full py-2 text-xs uppercase tracking-[0.16em] text-slate-500">
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Tagesfortschritt als Ring — die einzige Zahl, die auf dem Board Platz
// bekommt. Alles Weitere steckt hinter "Alles anzeigen".
function KcalRing({ value, pct }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative h-[62px] w-[62px] shrink-0">
      <svg width="62" height="62" viewBox="0 0 62 62" className="-rotate-90">
        <circle cx="31" cy="31" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <circle
          cx="31" cy="31" r={r} fill="none" stroke="#fb923c" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ - (circ * Math.min(100, pct)) / 100}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[13px] font-semibold tabular-nums text-slate-100">{value}</span>
        <span className="font-mono text-[8px] tracking-[0.1em] text-slate-500">KCAL</span>
      </div>
    </div>
  );
}

function QuickBtn({ Icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-3 text-xs font-medium text-slate-300 hover:bg-white/5"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

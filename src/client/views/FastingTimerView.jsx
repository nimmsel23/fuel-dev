import { useEffect, useMemo, useState } from "react";
import { Check, Clock3, Play, RotateCcw, Square, Timer } from "lucide-react";
import { getUidOrNull } from "../lib/db.firestore.js";

const GOALS = [12, 14, 16, 18, 20];
const STORE_BASE = "fuel-fasting-timer-v1";

function storageKey() {
  let uid = "device";
  try { uid = getUidOrNull() || "device"; } catch { /* local-only mode */ }
  return `${STORE_BASE}:${uid}`;
}

function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey()) || "{}");
    return { active: value.active || null, history: Array.isArray(value.history) ? value.history.slice(0, 20) : [] };
  } catch { return { active: null, history: [] }; }
}

function durationLabel(ms) {
  const total = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const seconds = Math.floor((Math.max(0, ms) % 60_000) / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function hoursMinutes(ms) {
  const total = Math.max(0, Math.floor(ms / 60_000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export default function FastingTimerView() {
  const [stored, setStored] = useState(readState);
  const [goalHours, setGoalHours] = useState(null);
  const [now, setNow] = useState(Date.now());
  const elapsed = stored.active ? Math.max(0, now - stored.active.startedAt) : 0;
  const goalMs = stored.active?.goalHours ? stored.active.goalHours * 3_600_000 : 0;
  const progress = goalMs ? Math.min(100, (elapsed / goalMs) * 100) : 0;
  const remaining = goalMs ? Math.max(0, goalMs - elapsed) : 0;
  const startedLabel = useMemo(() => stored.active ? new Date(stored.active.startedAt).toLocaleString("de-AT", { dateStyle: "medium", timeStyle: "short" }) : "", [stored.active]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(storageKey(), JSON.stringify(stored)); } catch { /* Timer remains active in memory for this view. */ }
  }, [stored]);

  function start() {
    if (stored.active) return;
    const active = { startedAt: Date.now(), goalHours };
    setNow(active.startedAt);
    setStored((current) => ({ ...current, active }));
  }

  function finish() {
    if (!stored.active) return;
    const endedAt = Date.now();
    const entry = { startedAt: stored.active.startedAt, endedAt, durationMs: endedAt - stored.active.startedAt, goalHours: stored.active.goalHours };
    setStored((current) => ({ active: null, history: [entry, ...current.history].slice(0, 20) }));
    setGoalHours(null);
  }

  function discard() {
    if (!window.confirm("Laufenden Timer wirklich verwerfen?")) return;
    setStored((current) => ({ ...current, active: null }));
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 pb-8">
      <header className="rounded-3xl bg-gradient-to-br from-amber-400/15 via-orange-400/10 to-transparent p-5 sm:p-7">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-300"><Timer size={17} /> Fuel · Fasten</div>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Dein Fastentimer</h1>
        <p className="mt-2 max-w-lg text-sm text-base-content/70">Eine persönliche Zeitmessung. Sie bewertet nicht, ob eine Dauer für dich geeignet ist.</p>
      </header>

      <section className="rounded-3xl border border-base-300 bg-base-100 p-5 sm:p-7" aria-live="polite">
        {stored.active ? (
          <>
            <div className="flex items-center justify-between gap-3 text-sm text-base-content/65"><span>Gestartet {startedLabel}</span><span className="rounded-full bg-amber-400/10 px-3 py-1 font-semibold text-amber-300">Läuft</span></div>
            <div className="my-6 text-center">
              <div className="font-mono text-5xl font-black tracking-tight tabular-nums sm:text-6xl">{durationLabel(elapsed)}<span className="ml-2 text-base font-semibold text-base-content/50">h:min:sek</span></div>
              <p className="mt-2 text-sm text-base-content/65">vergangene Zeit</p>
            </div>
            {stored.active.goalHours && <div className="space-y-2"><div className="flex justify-between text-xs text-base-content/65"><span>Persönliches Ziel · {stored.active.goalHours} h</span><span>{progress.toFixed(0)} %</span></div><progress className="progress progress-warning w-full" value={progress} max="100" /><p className="text-center text-sm text-base-content/65">{remaining ? `${hoursMinutes(remaining)} h:min bis zum Ziel` : "Zielzeit erreicht"}</p></div>}
            <div className="mt-6 grid grid-cols-2 gap-3"><button onClick={finish} className="btn btn-warning"><Square size={16} /> Fasten beenden</button><button onClick={discard} className="btn btn-ghost border border-base-300"><RotateCcw size={16} /> Verwerfen</button></div>
          </>
        ) : (
          <>
            <div className="text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-400/10 text-amber-300"><Clock3 size={26} /></div><h2 className="mt-4 text-xl font-bold">Timer vorbereiten</h2><p className="mt-1 text-sm text-base-content/65">Ein Ziel ist optional. Der Timer startet erst auf deine Auswahl.</p></div>
            <div className="mt-5"><div className="mb-2 text-sm font-semibold">Optionales Zeit-Ziel</div><div className="grid grid-cols-3 gap-2 sm:grid-cols-6"><button onClick={() => setGoalHours(null)} aria-pressed={goalHours === null} className={`btn btn-sm ${goalHours === null ? "btn-warning" : "btn-outline"}`}>Ohne Ziel</button>{GOALS.map((hours) => <button key={hours} onClick={() => setGoalHours(hours)} aria-pressed={goalHours === hours} className={`btn btn-sm ${goalHours === hours ? "btn-warning" : "btn-outline"}`}>{hours} h</button>)}</div></div>
            <button onClick={start} className="btn btn-warning mt-5 w-full"><Play size={17} /> Fasten-Timer starten</button>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-base-300 bg-base-100 p-5"><h2 className="font-bold">Deine letzten Sitzungen</h2>{stored.history.length ? <ol className="mt-3 divide-y divide-base-300">{stored.history.map((item) => <li key={`${item.startedAt}-${item.endedAt}`} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{new Date(item.startedAt).toLocaleString("de-AT", { dateStyle: "medium", timeStyle: "short" })}</span><span className="font-semibold tabular-nums">{hoursMinutes(item.durationMs)} h:min</span></li>)}</ol> : <p className="mt-2 text-sm text-base-content/60">Beendete Timer erscheinen hier.</p>}</section>

      <p className="rounded-2xl bg-base-200/70 p-4 text-xs leading-relaxed text-base-content/65"><Check size={14} className="mr-1 inline" /> Der Fastentimer speichert Startzeit und Verlauf lokal auf diesem Gerät und getrennt je angemeldetem Konto. Er verändert keine Mahlzeiteneinträge und gibt keine Ernährungs- oder Gesundheitsempfehlung.</p>
    </div>
  );
}

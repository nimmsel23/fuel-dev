import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

const SupplementsApp = React.lazy(() => import("./SupplementsApp.jsx"));
import { TAB_CONFIG } from "./routes.js";
import TabContent from "./components/TabContent.jsx";
import { IosInstallHint } from "./components/IosInstallHint.jsx";
import { InstallPromptHandler } from "./components/InstallPromptHandler.jsx";
import { useApp } from "./store.js";
import { useNutritionData } from "./hooks/useNutrition.js";
import { useAppData } from "./hooks/useAppData.js";
import { sumMetric, formatMetric } from "../shared/utils/utils.js";
import { captureNotificationIntentFromLocation } from "./lib/notification-intents.js";
import { watchAuth, signIn, signOut } from "./lib/db.firestore.js";

// Schlanke Shell der Fuel-Mini-Apps (VITE_SOLO=log|supplements|micros|report): genau ein Tab,
// kein Frontdoor, keine Tab-Leiste, keine Heatmap. Läuft immer als Cloud-Build (Firestore),
// darum Login-Pflicht. Der Rest (Splash, Icons, Manifest) kommt aus @vos/mini-app-shell (stamp-solo.mjs).
const SOLO = import.meta.env.VITE_SOLO || "";

// date: Tagesnavigation im Header; totals: kcal/Makros des Tages im Header
const META = {
  log: { date: true, totals: true },
  supplements: { date: true },
  micros: {},
  report: {},
};

function DateNav({ date, setDate }) {
  const d = parseISO(date);
  const today = format(new Date(), "yyyy-MM-dd");
  const step = (n) => setDate(format(addDays(d, n), "yyyy-MM-dd"));
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => step(-1)} aria-label="Vortag" className="rounded-full p-1.5 text-slate-300 hover:bg-white/10">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => setDate(today)}
        title="Zu heute springen"
        className="min-w-[8.5rem] rounded-full px-2 py-1 text-center text-sm font-medium text-slate-100 hover:bg-white/10"
      >
        {date === today ? "Heute" : format(d, "EEE, d. MMM", { locale: de })}
      </button>
      <label className="sr-only" htmlFor="solo-date">Datum wählen</label>
      <input id="solo-date" type="date" value={date} onChange={e => e.target.value && setDate(e.target.value)} className="w-9 rounded-lg border border-white/10 bg-slate-950/60 p-1 text-xs text-slate-300" />
      <button onClick={() => step(1)} aria-label="Folgetag" className="rounded-full p-1.5 text-slate-300 hover:bg-white/10">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

export default function SoloShell() {
  const qc = useQueryClient();
  const meta = META[SOLO] || {};
  const tab = TAB_CONFIG.find((t) => t.key === SOLO);
  const { activeDate, setActiveDate, setActiveTab } = useApp();
  const [authError, setAuthError] = React.useState("");
  const [user, setUser] = React.useState(null);
  const [authReady, setAuthReady] = React.useState(false);
  const [needRefresh, setNeedRefresh] = React.useState(false);

  React.useEffect(() => {
    if (SOLO !== "supplements") return;
    const intent = captureNotificationIntentFromLocation();
    if (intent?.date) setActiveDate(intent.date);
  }, [setActiveDate]);
  React.useEffect(() => watchAuth((u) => { qc.clear(); setUser(u); setAuthReady(true); }), [qc]);
  React.useEffect(() => {
    const onUpdate = () => setNeedRefresh(true);
    window.addEventListener("sw-update-available", onUpdate);
    return () => window.removeEventListener("sw-update-available", onUpdate);
  }, []);


  if (!tab) return <div className="p-6 text-sm text-red-300">Unbekannte Mini-App „{SOLO}“.</div>;

  const reload = () => {
    const w = window.__swRegistration?.waiting;
    if (w) w.postMessage({ type: "SKIP_WAITING" });
    else window.location.reload();
  };

  return (
    <>
      <InstallPromptHandler />
      <IosInstallHint />
      <div className="min-h-screen text-slate-100" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto w-full max-w-[1100px] px-3 py-3 sm:px-6">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-3">
              <tab.Icon className={`h-5 w-5 ${SOLO === "supplements" ? "text-lime-300" : "text-orange-300"}`} />
              <h1 className="text-lg font-semibold tracking-tight">{tab.label}</h1>
              {needRefresh && (
                <button
                  onClick={reload}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-amber-200"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Update
                </button>
              )}
            </div>
            {meta.date && user && <DateNav date={activeDate} setDate={setActiveDate} />}
            <div className="flex items-center gap-3">
              {meta.totals && user && <FuelSoloTotals date={activeDate} />}
              {user && (
                <button onClick={signOut} className="text-[10px] uppercase tracking-widest text-slate-500 hover:text-white">
                  Logout ({user.displayName?.split(" ")[0]})
                </button>
              )}
            </div>
          </header>

          <main>
            {!authReady ? (
              <div className="py-20 text-center text-sm text-slate-500 animate-pulse">Laden…</div>
            ) : !user ? (
              <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
                <p className="mb-4 text-sm text-slate-300">Mit deinem VitalOS-Konto anmelden, um {tab.label} zu nutzen.</p>
                <button
                  onClick={() => { setAuthError(""); signIn().catch(error => setAuthError(error.message)); }}
                  className="rounded-full bg-orange-400 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-orange-300"
                >
                  Mit Google anmelden
                </button>
                {authError && <p role="alert" className="mt-3 text-sm text-rose-300">{authError}</p>}
              </div>
            ) : (
              SOLO === "supplements" ? <React.Suspense fallback={<p role="status">Laden…</p>}><SupplementsApp date={activeDate} onDateChange={setActiveDate} /></React.Suspense> : <FuelSoloContent activeDate={activeDate} setActiveDate={setActiveDate} setActiveTab={setActiveTab} />
            )}
          </main>
        </div>
      </div>
    </>
  );
}

function FuelSoloContent({ activeDate, setActiveDate, setActiveTab }) {
  const data = useAppData(activeDate);
  return <TabContent activeTab={SOLO} ctx={{ ...data, activeDate, setActiveDate, setActiveTab }} />;
}

function FuelSoloTotals({ date }) {
  const { data: nutrition } = useNutritionData(date);
  const meals = nutrition?.meals || [];
  return <div className="text-right text-xs text-slate-400">
    <span className="text-base font-semibold text-orange-300">{formatMetric(sumMetric(meals, "kcal"))}</span> kcal
    <span className="ml-2"><span className="text-emerald-300">{formatMetric(sumMetric(meals, "protein"))}</span> P</span>
    <span className="ml-1.5"><span className="text-sky-300">{formatMetric(sumMetric(meals, "carbs"))}</span> K</span>
    <span className="ml-1.5"><span className="text-violet-300">{formatMetric(sumMetric(meals, "fat"))}</span> F</span>
  </div>;
}

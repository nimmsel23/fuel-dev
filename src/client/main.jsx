import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw } from "lucide-react";

import "./styles.css";
import { TAB_CONFIG } from "./routes.js";
import TabContent from "./components/TabContent.jsx";
import NutritionHeatmap from "./components/NutritionHeatmap.jsx";
import { IosInstallHint } from "./components/IosInstallHint.jsx";
import { InstallPromptHandler } from "./components/InstallPromptHandler.jsx";
import { useApp, useSettings } from "./store.js";
import { useAppData } from "./hooks/useAppData.js";
import { sumMetric, formatMetric } from "../shared/utils/utils.js";
import { watchAuth, signIn, signOut, getUid } from "./lib/db.firestore.js";
import { fetchJson } from "@api";



const qc = new QueryClient();

function localToday() {
  return new Date().toISOString().slice(0, 10);
}

function parseHashState() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  if (!raw) return { tab: null, date: null };

  const [tab = null, rawDate = null] = raw.split("/");
  if (!tab) return { tab: null, date: null };

  if (!rawDate) return { tab, date: null };
  if (rawDate === "today") return { tab, date: localToday() };
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return { tab, date: rawDate };

  return { tab, date: null };
}

function buildHashState(tab, date) {
  if (!tab) return "#";
  if (!date) return `#${tab}`;
  return `#${tab}/${date === localToday() ? "today" : date}`;
}

if (typeof window !== "undefined") {
  window.fuelDebug = {
    version: "3.0.0",
    getUid: () => getUid(),
    forceSync: () => qc.invalidateQueries(),
  };
}

function App() {
  const { activeTab, setActiveTab, activeDate, setActiveDate } = useApp();
  const [user, setUser] = React.useState(null);
  const isCloud = window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com");
  const isClientBuild = import.meta.env.VITE_APP_MODE === "client";
  const isCloudFrontend = isCloud || isClientBuild;

  const [localMode, setLocalMode] = React.useState(null); // "dev" | "prod" | null
  const [hasV4, setHasV4] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetchJson("/coach/health"),
      fetchJson("/v4/health"),
    ]).then(([coachResult, v4Result]) => {
      if (cancelled) return;
      setLocalMode(coachResult.status === "fulfilled" ? (coachResult.value?.server?.mode || null) : null);
      setHasV4(v4Result.status === "fulfilled" && v4Result.value?.status === "ok");
    });
    return () => { cancelled = true; };
  }, []);

  const [needRefresh, setNeedRefresh] = React.useState(false);
  React.useEffect(() => {
    const onUpdate = () => setNeedRefresh(true);
    window.addEventListener('sw-update-available', onUpdate);
    return () => window.removeEventListener('sw-update-available', onUpdate);
  }, []);
  const updateServiceWorker = () => {
    if (window.__swRegistration?.waiting) {
      window.__swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  };

  // The update button is rendered in the header when needRefresh is true.
  React.useEffect(() => {
    return watchAuth((u) => {
      setUser(u);
      if (u) {
        useSettings.getState().hydrateFromCloud();
      }
    });
  }, []);

  // URL Hashing for Tab + Datum
  React.useEffect(() => {
    const handleHashChange = () => {
      const { tab: hashTab, date } = parseHashState();
      const isCloudNow = window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com") || import.meta.env.VITE_APP_MODE === "client";
      const tab = TAB_CONFIG.find((t) => t.key === hashTab);
      if (tab && !(tab.cloudHidden && isCloudNow)) {
        setActiveTab(hashTab);
      }
      if (date) {
        setActiveDate(date);
      }
    };

    // Initial check
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [setActiveDate, setActiveTab]);

  React.useEffect(() => {
    if (activeTab) {
      const nextHash = buildHashState(activeTab, activeDate);
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      }
    }
  }, [activeDate, activeTab]);

  const { nutrition, sup, suppCatalog, suppLog, journal, macroTrend } = useAppData(activeDate);

  const meals = nutrition?.meals || [];
  const totalKcal = sumMetric(meals, "kcal");
  const totalProtein = sumMetric(meals, "protein");
  const totalCarbs = sumMetric(meals, "carbs");
  const totalFat = sumMetric(meals, "fat");

  const visibleTabs = TAB_CONFIG.filter((t) => !t.localOnly || localMode !== null).filter((t) => !(t.cloudHidden && isCloudFrontend));
  const runtimeBadge = isCloudFrontend ? "Fuel Centre V3" : (hasV4 ? "Fuel Centre V3 / V4" : "Fuel Centre V3");
  const runtimeTitle = isCloudFrontend
    ? "Fuel Centre V3 (Firebase PWA)"
    : (hasV4
      ? `Fuel Centre V3 / V4 (${localMode === "prod" ? "Local Prod" : "Dev"})`
      : `Fuel Centre V3 (${localMode === "prod" ? "Local Prod" : "Dev"})`);

  React.useEffect(() => {
    const tab = TAB_CONFIG.find((t) => t.key === activeTab);
    document.title = tab?.label || runtimeTitle;
  }, [activeTab, runtimeTitle]);

  const tabCtx = { nutrition, sup, suppCatalog, suppLog, journal, macroTrend, activeDate, setActiveDate, setActiveTab };

  return (
    <>
      <InstallPromptHandler />
      <IosInstallHint />
      <div className="min-h-screen text-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <header className="mb-6 grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-orange-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  {runtimeBadge}
                </p>
                {needRefresh && (
                  <button
                    onClick={() => updateServiceWorker(true)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-amber-200 hover:border-amber-400/60 hover:bg-amber-400/20 transition"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Update
                  </button>
                )}
                {isCloud && (
                  user ? (
                    <button onClick={signOut} className="text-[10px] text-slate-500 hover:text-white uppercase tracking-widest">
                      Logout ({user.displayName?.split(" ")[0]})
                    </button>
                  ) : (
                    <button onClick={signIn} className="text-[10px] text-orange-400 hover:text-orange-300 font-bold uppercase tracking-widest">
                      Cloud Login
                    </button>
                  )
                )}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Fuel Control Deck</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-300 md:text-base">
                Krankheit hat viele Väter, aber die Mutter ist immer die Ernährung. -Hippokrates
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Tagessumme</div>
              <div className="mt-2 text-3xl font-semibold text-orange-300">{formatMetric(totalKcal)} kcal</div>
              <div className="mt-1 flex justify-end gap-3 text-sm text-slate-400">
                <span><span className="text-emerald-300">{formatMetric(totalProtein)}</span> P</span>
                <span><span className="text-sky-300">{formatMetric(totalCarbs)}</span> K</span>
                <span><span className="text-violet-300">{formatMetric(totalFat)}</span> F</span>
              </div>
            </div>
          </div>

          <NutritionHeatmap selectedDate={activeDate} onSelectDate={setActiveDate} />

          <nav className="flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-1 px-1">
            {visibleTabs
              .map(({ key, label, Icon, localOnly }) => (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={twMerge(
                    "inline-flex shrink-0 snap-start items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                    activeTab === key
                      ? "border-orange-400/40 bg-orange-400 text-slate-950"
                      : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                    localOnly && localMode === "prod" && "ring-1 ring-emerald-400/40",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {localOnly ? (localMode === "prod" ? "Prod" : "Dev") : label}
                </motion.button>
              ))}
          </nav>
        </header>

        <main>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
            >
              <TabContent activeTab={activeTab} ctx={tabCtx} />
            </motion.div>
          </AnimatePresence>
        </main>
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

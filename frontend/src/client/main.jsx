import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { motion, AnimatePresence } from "framer-motion";

import "./styles.css";
import { TAB_CONFIG } from "./routes.js";
import TabContent from "./components/TabContent.jsx";
import NutritionHeatmap from "./components/NutritionHeatmap.jsx";
import { ChunkErrorBoundary } from "./components/ErrorBoundary.jsx";
import { useApp } from "./store.js";
import { useAppData } from "./hooks/useAppData.js";
import { sumMetric, formatMetric } from "../shared/utils/utils.js";

import { useRegisterSW } from "virtual:pwa-register/react";

const qc = new QueryClient();

if (typeof window !== "undefined") {
  window.fuelDebug = {
    version: "4.0.0",
    forceSync: () => qc.invalidateQueries(),
  };
}

function App() {
  const { activeTab, setActiveTab, activeDate, setActiveDate } = useApp();

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegistered(r) {
      if (r) setInterval(() => r.update(), 60 * 60 * 1000);
    },
  });

  React.useEffect(() => {
    if (needRefresh) updateServiceWorker(true);
  }, [needRefresh, updateServiceWorker]);

  // URL Hashing for Tabs
  React.useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash && TAB_CONFIG.some((t) => t.key === hash)) {
        setActiveTab(hash);
      }
    };

    // Initial check
    handleHashChange();

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [setActiveTab]);

  React.useEffect(() => {
    if (activeTab) {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  const { nutrition, sup, suppCatalog, suppLog, macroTrend, mealCatalog } = useAppData(activeDate);

  const meals = nutrition?.meals || [];
  const totalKcal = sumMetric(meals, "calories");
  const totalProtein = sumMetric(meals, "protein");
  const totalCarbs = sumMetric(meals, "carbs");
  const totalFat = sumMetric(meals, "fat");

  React.useEffect(() => {
    const tab = TAB_CONFIG.find((t) => t.key === activeTab);
    document.title = tab?.label || "Fuel Centre";
  }, [activeTab]);

  const tabCtx = { nutrition, sup, suppCatalog, suppLog, macroTrend, mealCatalog, activeDate, setActiveDate, setActiveTab };

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <header className="mb-6 grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-orange-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  Fuel Centre
                </p>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Nutrition Journal Control Deck</h1>
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

          <nav className="flex flex-wrap gap-2">
            {TAB_CONFIG.map(({ key, label, Icon }) => (
              <motion.button
                whileTap={{ scale: 0.96 }}
                key={key}
                onClick={() => setActiveTab(key)}
                className={twMerge(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                  activeTab === key
                    ? "border-orange-400/40 bg-orange-400 text-slate-950"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
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
              <ChunkErrorBoundary>
                <TabContent activeTab={activeTab} ctx={tabCtx} />
              </ChunkErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

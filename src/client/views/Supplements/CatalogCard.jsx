import { useState, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2, Sparkles } from "lucide-react";
import { Empty } from "../../components/ui.jsx";
import { formatMetric } from "../../../shared/utils/utils.js";

const GeminiCatalogModal = import.meta.env.VITE_APP_MODE === "client"
  ? () => null
  : lazy(() => import("../../components/GeminiCatalogModal.jsx"));

export default function CatalogCard({ catalog }) {
  const queryClient = useQueryClient();
  const [geminiOpen, setGeminiOpen] = useState(false);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-slate-300" />
          <h3 className="text-lg font-semibold">Catalog</h3>
        </div>
        {import.meta.env.VITE_APP_MODE !== "client" && (
          <button
            onClick={() => setGeminiOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-200 transition hover:bg-violet-400/20"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Gemini
          </button>
        )}
      </div>
      <div className="grid gap-3">
        {catalog.length ? catalog.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <strong>{item.name}</strong>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.default_time_of_day}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Default: {formatMetric(item.default_dose ?? 0)} {item.unit}
            </p>
          </div>
        )) : <Empty text="Kein Supplement-Katalog geladen." />}
      </div>
      {geminiOpen && import.meta.env.VITE_APP_MODE !== "client" && (
        <Suspense fallback={null}>
          <GeminiCatalogModal onClose={() => setGeminiOpen(false)} onSaved={() => { setGeminiOpen(false); queryClient.invalidateQueries({ queryKey: ["supp-catalog"] }); }} />
        </Suspense>
      )}
    </section>
  );
}

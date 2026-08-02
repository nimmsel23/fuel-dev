import { useState, lazy, Suspense } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Settings2, Sparkles, Plus, Repeat } from "lucide-react";
import { Empty } from "../../components/ui.jsx";
import { formatMetric } from "../../../shared/utils/utils.js";
import SupplementEditor from "./SupplementEditor.jsx";

const GeminiCatalogModal = import.meta.env.VITE_APP_MODE === "client"
  ? () => null
  : lazy(() => import("../../components/GeminiCatalogModal.jsx"));

const SCHEDULE_LABEL = {
  daily: "täglich",
  weekly: "wöchentlich",
  cyclical: "zyklisch",
};

export default function CatalogCard({ catalog }) {
  const queryClient = useQueryClient();
  const [geminiOpen, setGeminiOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // Objekt = Edit, "new" = Add, null = zu
  const closeEditor = () => setEditingItem(null);
  const onSaved = () => { closeEditor(); queryClient.invalidateQueries({ queryKey: ["supp-catalog"] }); };

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-slate-300" />
          <h3 className="text-lg font-semibold">Catalog</h3>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setEditingItem("new")}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10"
          >
            <Plus className="h-3.5 w-3.5" />
            Manuell
          </button>
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
      </div>
      <div className="grid gap-3">
        {catalog.length ? catalog.map((item) => (
          <button
            key={item.id}
            onClick={() => setEditingItem(item)}
            className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left transition hover:border-violet-400/30 hover:bg-slate-900"
          >
            <div className="flex items-center justify-between gap-3">
              <strong>{item.name}</strong>
              <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.default_time_of_day}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-slate-400">
              <span>{formatMetric(item.default_dose ?? 0)} {item.unit}</span>
              {item.schedule && (
                <span className="flex items-center gap-1 text-[11px] text-violet-300">
                  <Repeat className="h-3 w-3" />
                  {SCHEDULE_LABEL[item.schedule.type] || item.schedule.type}
                </span>
              )}
            </div>
          </button>
        )) : <Empty text="Kein Supplement-Katalog geladen." />}
      </div>

      {editingItem && (
        <SupplementEditor
          item={editingItem === "new" ? null : editingItem}
          onClose={closeEditor}
          onSaved={onSaved}
        />
      )}

      {geminiOpen && import.meta.env.VITE_APP_MODE !== "client" && (
        <Suspense fallback={null}>
          <GeminiCatalogModal onClose={() => setGeminiOpen(false)} onSaved={() => { setGeminiOpen(false); queryClient.invalidateQueries({ queryKey: ["supp-catalog"] }); }} />
        </Suspense>
      )}
    </section>
  );
}

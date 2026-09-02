import { useEffect, useRef } from "react";
import { Sparkles, RotateCcw, RefreshCw } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { useAiMealLogger } from "../hooks/useAiMealLogger.js";
import { consumeNotificationIntent } from "../lib/notification-intents.js";

// Kompaktes Freitext-Log-Widget fürs Dashboard. Nutzt denselben
// useAiMealLogger-Hook wie der volle Log-Tab (Log/LogView.jsx) — also
// gleicher Katalog-Match, gleiche Mikros-Schätzung, gleiches Pending-Entry-
// Sicherheitsnetz. Unterschied ist nur die kompaktere Darstellung, nicht
// mehr die zugrundeliegende Logik.
export default function QuickAiLog({ date }) {
  const { text, setText, loading, error, submit, pendingEntries, reanalyzePending, cloud } = useAiMealLogger(date);
  const inputRef = useRef(null);

  useEffect(() => {
    const applyIntent = (payload) => {
      if (!payload || payload.intent !== "fuel.quick-log") return;
      if (payload.draft) setText(payload.draft);
      requestAnimationFrame(() => inputRef.current?.focus());
    };

    applyIntent(consumeNotificationIntent("fuel.quick-log"));
    const onIntent = (event) => applyIntent(event.detail);
    window.addEventListener("fuel-notification-intent", onIntent);
    return () => window.removeEventListener("fuel-notification-intent", onIntent);
  }, [setText]);

  return (
    <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur grid gap-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-violet-300" />
        <h2 className="text-lg font-semibold">Schnell loggen</h2>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          id="quick-ai-log"
          className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-400"
          placeholder="z.B. 2 Eier mit Toast und Butter"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="shrink-0 rounded-2xl bg-violet-400 px-5 py-3 text-sm font-semibold text-slate-950 transition disabled:opacity-40"
        >
          {loading ? "Verarbeite…" : "Loggen"}
        </button>
      </div>
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
          <span>{error}</span>
          {text.trim() && (
            <button
              type="button"
              onClick={() => submit()}
              className="flex shrink-0 items-center gap-1 rounded-full bg-rose-500/20 px-2 py-1 font-semibold hover:bg-rose-500/30"
            >
              <RotateCcw className="h-3 w-3" /> Retry
            </button>
          )}
        </div>
      )}
      {cloud && pendingEntries.length > 0 && (
        <div className="grid gap-1.5">
          {pendingEntries.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
              <span className="min-w-0 flex-1 truncate">{entry.text}</span>
              <button
                type="button"
                onClick={() => reanalyzePending.mutate(entry)}
                disabled={reanalyzePending.isPending && reanalyzePending.variables?.id === entry.id}
                title="Neu analysieren"
                className="flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 font-semibold hover:bg-amber-500/25"
              >
                <RefreshCw className={twMerge("h-3 w-3", reanalyzePending.isPending && reanalyzePending.variables?.id === entry.id && "animate-spin")} />
              </button>
            </div>
          ))}
        </div>
      )}
    </form>
  );
}

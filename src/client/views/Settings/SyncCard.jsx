import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { fetchJson, postJson } from "@api";

export default function SyncCard({ sectionCls }) {
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchJson("/api/fuel-firestore/status")
      .then(setSyncStatus)
      .catch(() => setSyncStatus({ ok: false, firestore: "unreachable" }));
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await postJson("/api/fuel-firestore/ping", {});
      const r = await fetchJson("/api/fuel-firestore/status");
      setSyncStatus(r);
    } catch {
      setSyncStatus({ ok: false, firestore: "unreachable" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <section className={sectionCls}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-5 w-5 text-violet-300" />
        <h2 className="text-lg font-semibold">Firestore Sync</h2>
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
        <span className="text-sm text-slate-400">Status</span>
        {syncStatus === null
          ? <span className="text-xs text-slate-500">Prüfe…</span>
          : syncStatus.ok
            ? <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">verbunden</span>
            : <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-300">{syncStatus.firestore}</span>
        }
      </div>
      {syncStatus?.ok && (
        <p className="text-xs text-slate-500">{syncStatus.sa}</p>
      )}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="mt-1 rounded-2xl border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-sm text-violet-200 transition hover:bg-violet-400/20 disabled:opacity-40"
      >
        {syncing ? "Synchronisiere…" : "Jetzt synchronisieren (heute)"}
      </button>
    </section>
  );
}

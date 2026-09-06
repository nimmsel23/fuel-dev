import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, UploadCloud, DownloadCloud, Sparkles, Server, Database, CircleCheck, CircleX, CircleDashed } from "lucide-react";
import { fetchJson, postJson } from "@api";

const sectionCls = "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur grid gap-4";

function timeAgo(iso) {
  if (!iso) return "nie";
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `vor ${sec}s`;
  if (sec < 3600) return `vor ${Math.round(sec / 60)}min`;
  return `vor ${Math.round(sec / 3600)}h`;
}

function StatusDot({ ok }) {
  if (ok === null || ok === undefined) return <CircleDashed className="h-4 w-4 text-slate-500" />;
  return ok ? <CircleCheck className="h-4 w-4 text-emerald-400" /> : <CircleX className="h-4 w-4 text-red-400" />;
}

function Row({ label, value, ok }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-slate-400">
        {ok !== undefined && <StatusDot ok={ok} />}
        {label}
      </span>
      <span className="font-mono text-xs text-slate-200">{value}</span>
    </div>
  );
}

export default function DevView() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(null); // "push" | "pull" | "enrich" | null
  const [result, setResult] = useState(null);

  const { data: health, isError, isLoading } = useQuery({
    queryKey: ["coach-health"],
    queryFn: () => fetchJson("/coach/health"),
    refetchInterval: 15_000,
  });

  async function runSync(direction) {
    setBusy(direction);
    setResult(null);
    try {
      const r = await postJson(`/coach/sync/${direction}`, {});
      setResult({ ok: r.ok !== false, direction, detail: r });
    } catch (e) {
      setResult({ ok: false, direction, detail: { error: e.message } });
    } finally {
      setBusy(null);
      qc.invalidateQueries({ queryKey: ["coach-health"] });
    }
  }

  async function runEnrich() {
    setBusy("enrich");
    setResult(null);
    try {
      const r = await postJson("/coach/enrich", { days: 2 });
      const changed = (r.results || []).filter((d) => d.changed).length;
      setResult({ ok: r.ok !== false, direction: "enrich", detail: { ...r, changed } });
    } catch (e) {
      setResult({ ok: false, direction: "enrich", detail: { error: e.message } });
    } finally {
      setBusy(null);
      qc.invalidateQueries({ queryKey: ["coach-health"] });
    }
  }

  if (isLoading) return <div className="py-20 text-center text-sm text-slate-500 animate-pulse">Lade Health-Status…</div>;
  if (isError || !health) {
    return (
      <div className={sectionCls}>
        <p className="text-sm text-red-300">Server nicht erreichbar — /coach/health antwortet nicht.</p>
      </div>
    );
  }

  const { server, firestoreAdmin, catalogs } = health;
  const modeLabel = server.mode === "prod" ? "Prod" : "Dev";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={sectionCls}>
        <div className="flex items-center gap-2 mb-1">
          <Server className="h-5 w-5 text-orange-300" />
          <h2 className="text-lg font-semibold">
            Server — <span className={server.mode === "prod" ? "text-emerald-300" : "text-amber-300"}>{modeLabel}-Modus</span>
          </h2>
        </div>
        <Row label="Port" value={server.port} />
        <Row label="NODE_ENV" value={server.nodeEnv || "(nicht gesetzt)"} />
        <Row label="Uptime" value={`${Math.floor(server.uptimeSec / 60)}min`} />
        <Row label="Host / PID" value={`${server.hostname} · ${server.pid}`} />
        <Row label="Meal-Katalog" value={`${catalogs.nutrition} Einträge`} />
        <Row label="Supplement-Katalog" value={`${catalogs.supplements} Einträge`} />

        <button
          onClick={runEnrich}
          disabled={busy !== null}
          className="flex items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200 transition hover:bg-amber-400/20 disabled:opacity-40"
        >
          {busy === "enrich" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Enrichment jetzt laufen lassen (letzte 2 Tage)
        </button>
        {result?.direction === "enrich" && (
          <p className={`text-xs ${result.ok ? "text-emerald-300" : "text-red-300"}`}>
            {result.ok
              ? `Enrichment fertig — ${result.detail.changed} von ${result.detail.results?.length ?? 0} Tagen geändert.`
              : `Enrichment fehlgeschlagen: ${result.detail?.error}`}
          </p>
        )}
      </section>

      <section className={sectionCls}>
        <div className="flex items-center gap-2 mb-1">
          <Database className="h-5 w-5 text-violet-300" />
          <h2 className="text-lg font-semibold">Firestore Admin Sync</h2>
        </div>
        <Row label="Konfiguriert" ok={firestoreAdmin.configured} value={firestoreAdmin.configured ? firestoreAdmin.uid : "kein FUEL_CLOUD_UID"} />
        <Row label="Service-Account" ok={firestoreAdmin.saExists} value={firestoreAdmin.saExists ? "gefunden" : "fehlt"} />
        <Row label="Verbindung" ok={firestoreAdmin.connected} value={firestoreAdmin.connected ? "aktiv" : "kein Firestore"} />
        <Row
          label="Letzter Push"
          ok={firestoreAdmin.lastPushError ? false : (firestoreAdmin.lastPushAt ? true : undefined)}
          value={
            `${timeAgo(firestoreAdmin.lastPushAt)}` +
            `${firestoreAdmin.lastPushError ? " — " + firestoreAdmin.lastPushError : ""} ` +
            `(catalog ${firestoreAdmin.catalogPushCount ?? 0}×, runtime ${firestoreAdmin.runtimePushCount ?? 0}×, total ${firestoreAdmin.pushCount ?? 0}×)`
          }
        />
        <Row
          label="Letzter Pull"
          ok={firestoreAdmin.lastPullError ? false : (firestoreAdmin.lastPullAt ? true : undefined)}
          value={`${timeAgo(firestoreAdmin.lastPullAt)}${firestoreAdmin.lastPullError ? " — " + firestoreAdmin.lastPullError : ""} (${firestoreAdmin.pullCount}×)`}
        />
        <Row label="Pull-Intervall" value={`alle ${Math.round(firestoreAdmin.pullIntervalMs / 60000)}min`} />

        <div className="flex gap-2">
          <button
            onClick={() => runSync("push")}
            disabled={busy !== null || !firestoreAdmin.connected}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-sm text-violet-200 transition hover:bg-violet-400/20 disabled:opacity-40"
          >
            {busy === "push" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            Katalog jetzt pushen
          </button>
          <button
            onClick={() => runSync("pull")}
            disabled={busy !== null || !firestoreAdmin.connected}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-200 transition hover:bg-sky-400/20 disabled:opacity-40"
          >
            {busy === "pull" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
            Logs jetzt pullen
          </button>
        </div>

        {(result?.direction === "push" || result?.direction === "pull") && (
          <p className={`text-xs ${result.ok ? "text-emerald-300" : "text-red-300"}`}>
            {result.direction === "push" ? "Push" : "Pull"} {result.ok ? "erfolgreich" : "fehlgeschlagen"}
            {result.detail?.error ? `: ${result.detail.error}` : ""}
          </p>
        )}
      </section>
    </div>
  );
}

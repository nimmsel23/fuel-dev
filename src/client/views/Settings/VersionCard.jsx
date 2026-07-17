import { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function VersionCard({ sectionCls }) {
  const [swVersion, setSwVersion] = useState(null);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
  const [swChecking, setSwChecking] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    const onMsg = (e) => { if (e.data?.type === "VERSION") setSwVersion(e.data.version); };
    sw.addEventListener("message", onMsg);
    if (sw.controller) sw.controller.postMessage({ type: "GET_VERSION" });
    const reg = window.__swRegistration;
    if (reg?.waiting) setSwUpdateAvailable(true);
    const onUpdate = () => setSwUpdateAvailable(true);
    window.addEventListener("sw-update-available", onUpdate);
    return () => {
      sw.removeEventListener("message", onMsg);
      window.removeEventListener("sw-update-available", onUpdate);
    };
  }, []);

  async function handleSwCheck() {
    setSwChecking(true);
    try {
      const reg = window.__swRegistration || await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.update();
      if (reg?.waiting) setSwUpdateAvailable(true);
    } catch {}
    setTimeout(() => setSwChecking(false), 600);
  }

  function handleSwApply() {
    const reg = window.__swRegistration;
    if (reg?.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    else window.location.reload();
  }

  return (
    <section className={sectionCls}>
      <div className="flex items-center gap-2 mb-1">
        <RefreshCw className={`h-5 w-5 text-sky-300 ${swChecking ? "animate-spin" : ""}`} />
        <h2 className="text-lg font-semibold">App Version</h2>
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
        <span className="text-sm text-slate-400">Installiert</span>
        <span className="font-mono text-xs text-sky-200">{swVersion || "—"}</span>
      </div>
      {swUpdateAvailable && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-center text-xs font-semibold uppercase tracking-widest text-amber-200">
          Update bereit
        </div>
      )}
      {swUpdateAvailable ? (
        <button
          onClick={handleSwApply}
          className="rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
        >
          Jetzt aktualisieren & neu laden
        </button>
      ) : (
        <button
          onClick={handleSwCheck}
          disabled={swChecking}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
        >
          {swChecking ? "Suche Update…" : "Auf Update prüfen"}
        </button>
      )}
    </section>
  );
}

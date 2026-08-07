import { useEffect, useState } from "react";
import { Activity, Flame, RefreshCw, Settings2 } from "lucide-react";
import { useSettings } from "../store.js";
import { fetchJson } from "@api";

const sectionCls = "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur grid gap-4";
const labelCls = "text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 block";
const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";

export default function SettingsView() {
  const { kcal_goal, protein_goal, water_goal, age, gender, setSetting } = useSettings();
  const [health, setHealth] = useState(null);
  const [swVersion, setSwVersion] = useState(null);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
  const [swChecking, setSwChecking] = useState(false);

  useEffect(() => {
    fetchJson("/health").then(setHealth).catch(() => setHealth({ status: "error" }));
  }, []);

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
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={sectionCls}>
        <div className="flex items-center gap-2 mb-1">
          <Flame className="h-5 w-5 text-orange-300" />
          <h2 className="text-lg font-semibold">Tagesziele</h2>
        </div>
        <div className="grid gap-3">
          <div>
            <label className={labelCls}>Kalorien (kcal)</label>
            <input
              type="number" value={kcal_goal} min={500} max={6000}
              onChange={e => setSetting("kcal_goal", Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Protein (g)</label>
            <input
              type="number" value={protein_goal} min={30} max={400}
              onChange={e => setSetting("protein_goal", Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Wasser (ml)</label>
            <input
              type="number" value={water_goal} min={500} max={6000} step={250}
              onChange={e => setSetting("water_goal", Number(e.target.value))}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      <section className={sectionCls}>
        <div className="flex items-center gap-2 mb-1">
          <Activity className="h-5 w-5 text-emerald-300" />
          <h2 className="text-lg font-semibold">Profil</h2>
        </div>
        <div className="grid gap-3">
          <div>
            <label className={labelCls}>Alter</label>
            <input
              type="number" value={age} min={15} max={99}
              onChange={e => setSetting("age", Number(e.target.value))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Geschlecht</label>
            <select
              value={gender}
              onChange={e => setSetting("gender", e.target.value)}
              className={inputCls}
            >
              <option value="m">Männlich</option>
              <option value="f">Weiblich</option>
            </select>
          </div>
          <p className="text-xs text-slate-500">Wird für DACH-Referenzwerte im Mikros-Tab verwendet.</p>
        </div>
      </section>

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

      <section className={sectionCls}>
        <div className="flex items-center gap-2 mb-1">
          <Settings2 className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold">System</h2>
        </div>
        <div className="grid gap-2 text-sm">
          {[
            ["Backend (FastAPI)", health?.status === "ok" ? "online" : health ? "error" : "prüfe…", health?.status === "ok"],
            ["Data", "Lokale Datenbank", true],
          ].map(([label, val, ok]) => (
            <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
              <span className="text-slate-400">{label}</span>
              <span className={ok ? "text-slate-300" : "text-red-400"}>{val}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

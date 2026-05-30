import { useEffect, useState } from "react";
import { Activity, Flame, LogIn, LogOut, Settings2, Sparkles } from "lucide-react";
import { useSettings } from "../store.js";
import { signIn, signOut, watchAuth } from "../lib/firestore-db.js";

const sectionCls = "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur grid gap-4";
const labelCls = "text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 block";
const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";

export default function SettingsView() {
  const { kcal_goal, protein_goal, water_goal, age, gender, setSetting } = useSettings();
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/health").then(r => r.json()).then(setHealth).catch(() => setHealth({ status: "error" }));
    fetch("/api/fuel-firestore/status").then(r => r.json()).then(setSyncStatus).catch(() => setSyncStatus({ ok: false, firestore: "unreachable" }));
    return watchAuth(setUser);
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/fuel-firestore/ping", { method: "POST" });
      const r = await fetch("/api/fuel-firestore/status");
      setSyncStatus(await r.json());
    } catch {
      setSyncStatus({ ok: false, firestore: "unreachable" });
    } finally {
      setSyncing(false);
    }
  }

  const isCloud = window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={sectionCls}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-sky-300" />
          <h2 className="text-lg font-semibold">Account</h2>
        </div>
        {user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              {user.photoURL && <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full" />}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-100">{user.displayName}</div>
                <div className="truncate text-xs text-slate-500">{user.email}</div>
                <div className="mt-1 font-mono text-[9px] text-slate-600">UID: {user.uid}</div>
              </div>
              <span className="rounded-full bg-sky-500/20 px-3 py-1 text-[10px] uppercase tracking-widest text-sky-300">Cloud</span>
            </div>
            <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10">
              <LogOut className="h-4 w-4" />
              Abmelden
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">Melde dich an, um deine Daten in der Cloud (Firestore) zu speichern und geräteübergreifend zu synchronisieren.</p>
            <button onClick={signIn} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300">
              <LogIn className="h-4 w-4" />
              Mit Google anmelden
            </button>
          </div>
        )}
      </section>

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

      <section className={sectionCls}>
        <div className="flex items-center gap-2 mb-1">
          <Settings2 className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold">System</h2>
        </div>
        <div className="grid gap-2 text-sm">
          {[
            ["fuel-dev", health?.status === "ok" ? "online :9000" : health ? "error" : "prüfe…", health?.status === "ok"],
            ["Bridge", syncStatus !== null ? (syncStatus.ok || syncStatus.firestore !== "unreachable" ? "online :9080" : "offline") : "prüfe…", syncStatus?.ok || (syncStatus && syncStatus.firestore !== "unreachable")],
            ["Data", "~/.aos/fuel/", true],
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

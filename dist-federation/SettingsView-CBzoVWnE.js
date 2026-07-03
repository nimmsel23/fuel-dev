import { importShared } from './__federation_fn_import-BlZWqUMR.js';
import { j as jsxRuntimeExports } from './jsx-runtime-CsM3lTE3.js';
import { u as useSettings } from './store-Dha0LYKG.js';
import { f as fetchJson, w as watchAuth, s as signOut, b as signIn, p as postJson } from './api-BbKnJ9mL.js';

const {useEffect,useState} = await importShared('react');

const {Activity,Flame,LogIn,LogOut,RefreshCw,Settings2,Sparkles} = await importShared('lucide-react');
const sectionCls = "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur grid gap-4";
const labelCls = "text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 block";
const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";
function SettingsView() {
  const { kcal_goal, protein_goal, water_goal, age, gender, setSetting } = useSettings();
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState(null);
  const [swVersion, setSwVersion] = useState(null);
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
  const [swChecking, setSwChecking] = useState(false);
  useEffect(() => {
    fetchJson("/health").then(setHealth).catch(() => setHealth({ status: "error" }));
    fetchJson("/api/fuel-firestore/status").then(setSyncStatus).catch(() => setSyncStatus({ ok: false, firestore: "unreachable" }));
    return watchAuth(setUser);
  }, []);
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    const onMsg = (e) => {
      if (e.data?.type === "VERSION") setSwVersion(e.data.version);
    };
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
    } catch {
    }
    setTimeout(() => setSwChecking(false), 600);
  }
  function handleSwApply() {
    const reg = window.__swRegistration;
    if (reg?.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    else window.location.reload();
  }
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
  window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com");
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-6 lg:grid-cols-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: sectionCls, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "h-5 w-5 text-sky-300" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold", children: "Account" })
      ] }),
      user ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4", children: [
          user.photoURL && /* @__PURE__ */ jsxRuntimeExports.jsx("img", { src: user.photoURL, alt: "", className: "h-10 w-10 rounded-full" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-semibold text-slate-100", children: user.displayName }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "truncate text-xs text-slate-500", children: user.email }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-1 font-mono text-[9px] text-slate-600", children: [
              "UID: ",
              user.uid
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rounded-full bg-sky-500/20 px-3 py-1 text-[10px] uppercase tracking-widest text-sky-300", children: "Cloud" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { onClick: signOut, className: "flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LogOut, { className: "h-4 w-4" }),
          "Abmelden"
        ] })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-slate-400", children: "Melde dich an, um deine Daten in der Cloud (Firestore) zu speichern und geräteübergreifend zu synchronisieren." }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { onClick: signIn, className: "flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LogIn, { className: "h-4 w-4" }),
          "Mit Google anmelden"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: sectionCls, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Flame, { className: "h-5 w-5 text-orange-300" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold", children: "Tagesziele" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: labelCls, children: "Kalorien (kcal)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "number",
              value: kcal_goal,
              min: 500,
              max: 6e3,
              onChange: (e) => setSetting("kcal_goal", Number(e.target.value)),
              className: inputCls
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: labelCls, children: "Protein (g)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "number",
              value: protein_goal,
              min: 30,
              max: 400,
              onChange: (e) => setSetting("protein_goal", Number(e.target.value)),
              className: inputCls
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: labelCls, children: "Wasser (ml)" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "number",
              value: water_goal,
              min: 500,
              max: 6e3,
              step: 250,
              onChange: (e) => setSetting("water_goal", Number(e.target.value)),
              className: inputCls
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: sectionCls, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Activity, { className: "h-5 w-5 text-emerald-300" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold", children: "Profil" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: labelCls, children: "Alter" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "input",
            {
              type: "number",
              value: age,
              min: 15,
              max: 99,
              onChange: (e) => setSetting("age", Number(e.target.value)),
              className: inputCls
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: labelCls, children: "Geschlecht" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            "select",
            {
              value: gender,
              onChange: (e) => setSetting("gender", e.target.value),
              className: inputCls,
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "m", children: "Männlich" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value: "f", children: "Weiblich" })
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-slate-500", children: "Wird für DACH-Referenzwerte im Mikros-Tab verwendet." })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: sectionCls, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "h-5 w-5 text-violet-300" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold", children: "Firestore Sync" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-slate-400", children: "Status" }),
        syncStatus === null ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-slate-500", children: "Prüfe…" }) : syncStatus.ok ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300", children: "verbunden" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-300", children: syncStatus.firestore })
      ] }),
      syncStatus?.ok && /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-xs text-slate-500", children: syncStatus.sa }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: handleSync,
          disabled: syncing,
          className: "mt-1 rounded-2xl border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-sm text-violet-200 transition hover:bg-violet-400/20 disabled:opacity-40",
          children: syncing ? "Synchronisiere…" : "Jetzt synchronisieren (heute)"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: sectionCls, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: `h-5 w-5 text-sky-300 ${swChecking ? "animate-spin" : ""}` }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold", children: "App Version" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-sm text-slate-400", children: "Installiert" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-xs text-sky-200", children: swVersion || "—" })
      ] }),
      swUpdateAvailable && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "rounded-2xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-center text-xs font-semibold uppercase tracking-widest text-amber-200", children: "Update bereit" }),
      swUpdateAvailable ? /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: handleSwApply,
          className: "rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300",
          children: "Jetzt aktualisieren & neu laden"
        }
      ) : /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: handleSwCheck,
          disabled: swChecking,
          className: "rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10 disabled:opacity-40",
          children: swChecking ? "Suche Update…" : "Auf Update prüfen"
        }
      )
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: sectionCls, children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 mb-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Settings2, { className: "h-5 w-5 text-slate-400" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold", children: "System" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-2 text-sm", children: [
        ["fuel-dev", health?.status === "ok" ? "online :9000" : health ? "error" : "prüfe…", health?.status === "ok"],
        ["Bridge", syncStatus !== null ? syncStatus.ok || syncStatus.firestore !== "unreachable" ? "online :9080" : "offline" : "prüfe…", syncStatus?.ok || syncStatus && syncStatus.firestore !== "unreachable"],
        ["Data", "~/.aos/fuel/", true]
      ].map(([label, val, ok]) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-slate-400", children: label }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: ok ? "text-slate-300" : "text-red-400", children: val })
      ] }, label)) })
    ] })
  ] });
}

export { SettingsView as default };

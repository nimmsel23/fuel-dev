import { useState, useEffect } from "react";
import { Settings2 } from "lucide-react";
import { fetchJson } from "@api";

const isCloud = () =>
  typeof window !== "undefined" &&
  (window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com"));

// Detaillierter Sync-/Server-Status (Firestore Admin, Uptime, Katalog-
// Zählungen) lebt im lokalen Dev/Prod-Tab (routes.js: key "dev") — dieser
// Card bleibt bewusst ein simpler Ping, der auch im Cloud-Build funktioniert.
// Zeigt je nach Channel unterschiedliche Zeilen — vorher stand hier immer
// "fuel-dev" + "~/.aos/fuel/", auch im Cloud-Build, wo beides nicht existiert.
export default function SystemHealthCard({ sectionCls }) {
  const [health, setHealth] = useState(null);
  const [firestoreOk, setFirestoreOk] = useState(null); // null = prüft noch
  const cloud = isCloud();

  useEffect(() => {
    if (cloud) return;
    fetchJson("/health").then(setHealth).catch(() => setHealth({ status: "error" }));
  }, [cloud]);

  useEffect(() => {
    if (!cloud) return;
    let cancelled = false;
    (async () => {
      try {
        const [{ doc, getDoc }, { db }] = await Promise.all([
          import("firebase/firestore"),
          import("../../lib/firebase.js"),
        ]);
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000));
        // Ping-Doc muss nicht existieren — getDoc() erreicht Firestore
        // trotzdem, exists()===false ist ok, ein Timeout/Netzwerkfehler nicht.
        await Promise.race([getDoc(doc(db, "_health", "ping")), timeout]);
        if (!cancelled) setFirestoreOk(true);
      } catch {
        if (!cancelled) setFirestoreOk(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cloud]);

  const rows = cloud
    ? [
        ["Fuel Centre", "Cloud (fuel-vos.web.app)", true],
        ["Data", firestoreOk === null ? "prüfe…" : firestoreOk ? "Firestore online" : "Firestore offline", firestoreOk !== false],
      ]
    : [
        ["fuel-dev", health?.status === "ok" || health?.ok ? "online" : health ? "error" : "prüfe…", health?.status === "ok" || health?.ok],
        ["Data", "~/.aos/fuel/", true],
      ];

  return (
    <section className={sectionCls}>
      <div className="flex items-center gap-2 mb-1">
        <Settings2 className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold">System</h2>
      </div>
      <div className="grid gap-2 text-sm">
        {rows.map(([label, val, ok]) => (
          <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
            <span className="text-slate-400">{label}</span>
            <span className={ok ? "text-slate-300" : "text-red-400"}>{val}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

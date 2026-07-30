import { useState, useEffect } from "react";
import { Settings2 } from "lucide-react";
import { fetchJson } from "@api";

// Detaillierter Sync-/Server-Status (Firestore Admin, Uptime, Katalog-
// Zählungen) lebt im lokalen Dev/Prod-Tab (routes.js: key "dev") — dieser
// Card bleibt bewusst ein simpler Ping, der auch im Cloud-Build funktioniert.
export default function SystemHealthCard({ sectionCls }) {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetchJson("/health").then(setHealth).catch(() => setHealth({ status: "error" }));
  }, []);

  return (
    <section className={sectionCls}>
      <div className="flex items-center gap-2 mb-1">
        <Settings2 className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold">System</h2>
      </div>
      <div className="grid gap-2 text-sm">
        {[
          ["fuel-dev", health?.status === "ok" || health?.ok ? "online" : health ? "error" : "prüfe…", health?.status === "ok" || health?.ok],
          ["Data", "~/.aos/fuel/", true],
        ].map(([label, val, ok]) => (
          <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
            <span className="text-slate-400">{label}</span>
            <span className={ok ? "text-slate-300" : "text-red-400"}>{val}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

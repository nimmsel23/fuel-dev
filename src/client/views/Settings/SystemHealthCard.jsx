import { useState, useEffect } from "react";
import { Settings2 } from "lucide-react";
import { fetchJson } from "@api";

const isCloud = () =>
  typeof window !== "undefined" &&
  (window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com"));

// Nur lokal relevant (Fastify-Backend + Dateisystem) — im Cloud-Build gibt's
// nichts Sinnvolles zu zeigen. Ein Firestore-Erreichbarkeits-Ping wurde
// probiert, war aber unzuverlässig (false "offline") und brachte dem User
// keinen echten Mehrwert — einfach weglassen statt raten.
export default function SystemHealthCard({ sectionCls }) {
  const [health, setHealth] = useState(null);
  const cloud = isCloud();

  useEffect(() => {
    if (cloud) return;
    fetchJson("/health").then(setHealth).catch(() => setHealth({ status: "error" }));
  }, [cloud]);

  if (cloud) return null;

  const rows = [
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

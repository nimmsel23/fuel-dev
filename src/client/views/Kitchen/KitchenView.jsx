import { lazy, Suspense, useState } from "react";
import { Refrigerator, ShoppingCart } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { ChunkErrorBoundary } from "../../components/ErrorBoundary.jsx";

// Küche (seit 2026-10-26, Cloud-Kanal): Subtabs Einkauf (Bon-Scan, Einkaufszettel, Empfehlungen, Aktionen)
// und Vorrat (Bestand, KI-Rezeptideen). Daten: users/{uid}/fuel_* (lib/db/firestore/pantry.js).
const ShoppingTab = lazy(() => import("./ShoppingTab.jsx"));
const PantryTab = lazy(() => import("./PantryTab.jsx"));

const SUBTABS = [
  { key: "shopping", label: "Einkauf", Icon: ShoppingCart, View: ShoppingTab },
  { key: "pantry", label: "Vorrat", Icon: Refrigerator, View: PantryTab },
];
const STORAGE_KEY = "fuel:kitchen:subtab";

function loadSubtab() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUBTABS.some((t) => t.key === stored) ? stored : "shopping";
  } catch { return "shopping"; }
}

export default function KitchenView() {
  const [active, setActive] = useState(loadSubtab);
  const select = (key) => {
    setActive(key);
    try { localStorage.setItem(STORAGE_KEY, key); } catch { /* Speicher gesperrt — Subtab bleibt nur im State */ }
  };
  const { View } = SUBTABS.find((t) => t.key === active);

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Küche" className="flex gap-2">
        {SUBTABS.map(({ key, label, Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={active === key} onClick={() => select(key)}
            className={twMerge("flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
              active === key ? "border-orange-400/60 bg-orange-400/10 text-orange-200" : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200")}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>
      <ChunkErrorBoundary>
        <Suspense fallback={<div className="py-16 text-center text-sm text-slate-500 animate-pulse">Laden …</div>}>
          <View />
        </Suspense>
      </ChunkErrorBoundary>
    </div>
  );
}

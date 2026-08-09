import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { fetchJson } from "../lib/api.js";

const LABELS = {
  if: "Intervallfasten-Fenster",
  omad: "OMAD-Fenster",
  extended_fast: "Langzeitfasten",
};

export default function FastingWindowBadge() {
  const { data } = useQuery({
    queryKey: ["fasting-windows"],
    queryFn: async () => {
      const res = await fetchJson("/nutrition/fasting?days=3");
      return res.windows || [];
    },
    staleTime: 60_000,
  });

  // Nimm den letzten Eintrag mit firstMealAt !== null
  const latest = (data || [])
    .filter((w) => w.firstMealAt)
    .slice(-1)[0];

  if (!latest || latest.classification === "normal" || latest.classification === "no_log") {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-2 text-sm text-amber-200">
      <Flame className="h-4 w-4 shrink-0" />
      <span>
        {LABELS[latest.classification]} — {latest.fastingHoursBeforeThisDay}h seit letzter Mahlzeit
      </span>
    </div>
  );
}

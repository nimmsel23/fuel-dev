import { Activity, UtensilsCrossed, Waves } from "lucide-react";
import { Card } from "../../components/ui.jsx";
import { formatMetric } from "../../../shared/utils/utils.js";

export default function StatsGrid({ mealsCount, totalProtein, waterMl }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card icon={UtensilsCrossed} title="Meals" value={mealsCount} hint="heutige Einträge" />
      <Card icon={Activity} title="Protein" value={`${formatMetric(totalProtein)} g`} hint="aus allen Meals des Tages" />
      <Card icon={Waves} title="Water" value={`${waterMl} ml`} hint="Tageshydration" />
    </div>
  );
}

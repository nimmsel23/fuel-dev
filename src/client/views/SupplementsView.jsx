import DailyChecklist from "./Supplements/DailyChecklist.jsx";
import QuickLog from "./Supplements/QuickLog.jsx";
import SupplementLogger from "./Supplements/SupplementLogger.jsx";
import TodayStack from "./Supplements/TodayStack.jsx";
import StatsCard from "./Supplements/StatsCard.jsx";
import CatalogCard from "./Supplements/CatalogCard.jsx";

export default function SupplementsView({ date, sup, catalog, suppLog }) {
  const stats = sup?.stats || [];
  const intakes = suppLog?.intakes || [];

  return (
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="grid gap-6">
        <DailyChecklist date={date} catalog={catalog} intakes={intakes} />
        <QuickLog date={date} catalog={catalog} stats={stats} />
        <SupplementLogger date={date} catalog={catalog} intakes={intakes} />
        <TodayStack date={date} intakes={intakes} />
      </div>
      <div className="grid gap-6">
        <StatsCard stats={stats} />
        <CatalogCard catalog={catalog} />
      </div>
    </section>
  );
}

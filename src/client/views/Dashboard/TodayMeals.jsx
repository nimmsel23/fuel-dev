import { Leaf } from "lucide-react";
import { MealRow, Empty } from "../../components/ui.jsx";

export default function TodayMeals({ meals, setActiveTab }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur flex flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Leaf className="h-5 w-5 text-emerald-300" />
          <h2 className="text-lg font-semibold">Today</h2>
        </div>
        <button
          onClick={() => setActiveTab("log")}
          className="rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          + Quick Log
        </button>
      </div>
      <div className="space-y-3 flex-1">
        {meals?.length ? (
          meals.map((meal) => <MealRow key={meal.id} meal={meal} />)
        ) : (
          <Empty text="Keine Mahlzeiten geloggt" />
        )}
      </div>
    </section>
  );
}

import { CheckSquare } from "lucide-react";


export default function HabitVosView(props) {
  return (
    <section className="space-y-6">
      <header className="flex items-center gap-3 rounded-3xl border border-orange-400/15 bg-orange-400/5 px-6 py-4">
        <CheckSquare className="h-5 w-5 text-orange-300" />
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-orange-300">Habits · Fuel</div>
          <h2 className="text-base font-semibold text-slate-100">Tägliche Gewohnheiten</h2>
        </div>
      </header>
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-6 text-center text-slate-500">
        <p>Habits Tracking wird in Kürze in das FastAPI Backend migriert...</p>
      </div>
    </section>
  );
}

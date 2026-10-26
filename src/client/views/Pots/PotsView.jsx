import { useState } from "react";
import { CookingPot, Plus } from "lucide-react";
import { usePots, usePotActions } from "../../hooks/usePots.js";
import { isFinished } from "../../lib/potsLogic.js";
import PotCard from "./PotCard.jsx";
import NewPotForm from "./NewPotForm.jsx";

// Töpfe — was man gekocht hat, als Gericht angelegt; je Tag wird festgehalten, wie viel vom Topf gegessen ist.
// Jeder Tagesanteil landet als Mahlzeit (skalierte Makros/Mikros) im Tages-Log.
export default function PotsView() {
  const { data: pots = [], isLoading, error: loadError } = usePots();
  const { setDay, createPot, removePot, error } = usePotActions();
  const [showForm, setShowForm] = useState(false);

  const active = pots.filter((p) => !isFinished(p));
  const done = pots.filter(isFinished);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CookingPot className="h-5 w-5 text-orange-300" />
            <h2 className="text-xl font-semibold">Töpfe</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">Einmal gekocht, mehrere Tage gegessen: Tagesanteile wandern als Mahlzeit ins Log.</p>
        </div>
        {!showForm && (
          <button type="button" onClick={() => setShowForm(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-orange-400 px-3 py-2 text-sm font-semibold text-slate-950 transition hover:bg-orange-300">
            <Plus className="h-4 w-4" /> Neuer Topf
          </button>
        )}
      </div>

      {showForm && (
        <NewPotForm onCancel={() => setShowForm(false)}
          onCreate={async (input, first) => { await createPot(input, first); setShowForm(false); }} />
      )}

      {(error || loadError) && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error || loadError.message}</p>}
      {isLoading && <div className="py-10 text-center text-sm text-slate-500 animate-pulse">Laden…</div>}

      {!isLoading && pots.length === 0 && !showForm && (
        <div className="rounded-3xl border border-dashed border-white/10 px-6 py-12 text-center text-sm text-slate-500">
          Noch kein Topf angelegt. Leg das Gericht an, das du gekocht hast — danach trägst du je Tag ein, wie viel davon weg ist.
        </div>
      )}

      {active.map((pot) => <PotCard key={pot.id} pot={pot} onSetDay={setDay} onDelete={removePot} />)}

      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none text-sm text-slate-500 hover:text-slate-300">Aufgegessen ({done.length})</summary>
          <div className="mt-3 space-y-4">
            {done.map((pot) => <PotCard key={pot.id} pot={pot} onSetDay={setDay} onDelete={removePot} />)}
          </div>
        </details>
      )}
    </div>
  );
}

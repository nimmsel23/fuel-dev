import { Pill } from "lucide-react";
import { Empty } from "../../components/ui.jsx";
import { formatMetric } from "../../../shared/utils/utils.js";
import { useSupplementMutations } from "./useSupplementMutations.js";

export default function TodayStack({ date, intakes }) {
  const { deleteIntake } = useSupplementMutations(date);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center gap-2">
        <Pill className="h-5 w-5 text-violet-300" />
        <h3 className="text-lg font-semibold">Today stack</h3>
      </div>
      <div className="grid gap-3">
        {intakes.length ? intakes.slice().reverse().map((intake) => (
          <div key={intake.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-slate-100">{intake.name}</div>
                <div className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                  {formatMetric(intake.dose)} {intake.unit} · {intake.time_of_day}
                </div>
                <div className="mt-2 text-sm text-slate-400">{intake.notes || "Keine Notizen"}</div>
              </div>
              <button
                type="button"
                onClick={() => deleteIntake.mutate({ delete_id: intake.id })}
                disabled={deleteIntake.isPending}
                className="rounded-full border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-rose-100 disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          </div>
        )) : <Empty text="Fuer dieses Datum sind noch keine Supplements geloggt." />}
      </div>
      {deleteIntake.isError && <p className="mt-3 text-sm text-rose-300">{deleteIntake.error.message}</p>}
    </section>
  );
}

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postJson } from "@api";

export default function WaterTracker({ date, waterMl }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState(250);
  const [error, setError] = useState("");
  const save = useMutation({
    mutationFn: (next) => postJson("/nutrition/log", { date, water_ml: next }),
    onSuccess: (_result, next) => {
      qc.setQueryData(["nutrition", date], (old) => ({ ...old, date, water_ml: next }));
      qc.invalidateQueries({ queryKey: ["nutrition", date] });
      setError("");
    },
    onError: () => setError("Wasser konnte nicht gespeichert werden."),
  });

  const add = (ml) => save.mutate(Math.max(0, waterMl + ml));
  return (
    <section className="rounded-3xl border border-sky-400/20 bg-sky-400/5 p-5" aria-label="Wasser erfassen">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Wasser erfassen</h2>
        <span className="text-sm text-sky-200">{waterMl} ml heute</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[250, 500].map((ml) => (
          <button key={ml} type="button" disabled={save.isPending} onClick={() => add(ml)}
            className="rounded-xl bg-sky-500 px-4 py-2 font-medium text-white disabled:opacity-50">
            +{ml} ml
          </button>
        ))}
        <button type="button" disabled={save.isPending || waterMl === 0} onClick={() => add(-250)}
          className="rounded-xl border border-white/20 px-4 py-2 disabled:opacity-50">−250 ml</button>
      </div>
      <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => {
        event.preventDefault();
        save.mutate(waterMl + Number(amount));
      }}>
        <label className="text-sm">Andere Menge (ml)
          <input type="number" min="1" max="5000" step="1" required value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="mt-1 block w-28 rounded-lg border border-white/20 bg-transparent px-3 py-2" />
        </label>
        <button type="submit" disabled={save.isPending} className="rounded-xl border border-sky-400/50 px-4 py-2 disabled:opacity-50">Hinzufügen</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
    </section>
  );
}

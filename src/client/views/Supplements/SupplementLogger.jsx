import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pill } from "lucide-react";
import { Field, Input, inputClassName } from "../../components/ui.jsx";
import { normalizeSupplementUnit } from "../../../shared/utils/utils.js";
import { useSupplementMutations } from "./useSupplementMutations.js";

const supplementSchema = z.object({
  date: z.string().min(1),
  supplement_id: z.string().min(1, "Bitte ein Supplement waehlen."),
  dose: z.coerce.number().min(0),
  unit: z.string().min(1),
  time_of_day: z.string().min(1),
  notes: z.string().optional().default(""),
});

export default function SupplementLogger({ date, catalog, intakes }) {
  const { createIntake } = useSupplementMutations(date);

  const form = useForm({
    resolver: zodResolver(supplementSchema),
    defaultValues: {
      date,
      supplement_id: catalog[0]?.id || "",
      dose: catalog[0]?.default_dose ?? 0,
      unit: catalog[0]?.unit || "mg",
      time_of_day: catalog[0]?.default_time_of_day || "any",
      notes: "",
    },
  });

  useEffect(() => {
    const selected = catalog.find((item) => item.id === form.getValues("supplement_id")) || catalog[0];
    form.reset({
      date,
      supplement_id: selected?.id || "",
      dose: selected?.default_dose ?? 0,
      unit: normalizeSupplementUnit(selected?.unit),
      time_of_day: selected?.default_time_of_day || "any",
      notes: "",
    });
  }, [date, catalog, form]);

  const selectedSupplementId = form.watch("supplement_id");
  useEffect(() => {
    const selected = catalog.find((item) => item.id === selectedSupplementId);
    if (!selected) return;
    form.setValue("unit", normalizeSupplementUnit(selected.unit));
    form.setValue("time_of_day", selected.default_time_of_day || "any");
    form.setValue("dose", selected.default_dose ?? 0);
  }, [selectedSupplementId, catalog, form]);

  function onSubmit(values) {
    createIntake.mutate(values, {
      onSuccess: () => {
        const selected = catalog.find((item) => item.id === values.supplement_id);
        form.reset({
          date: values.date,
          supplement_id: values.supplement_id,
          dose: selected?.default_dose ?? values.dose ?? 0,
          unit: normalizeSupplementUnit(selected?.unit || values.unit),
          time_of_day: selected?.default_time_of_day || values.time_of_day,
          notes: "",
        });
      }
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Pill className="h-5 w-5 text-violet-300" />
            <h2 className="text-xl font-semibold">Supplement logger</h2>
          </div>
          <p className="text-sm text-slate-400">Loggt direkt für das gewählte Datum.</p>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">
          {intakes.length} intakes
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Datum">
          <Input type="date" {...form.register("date")} />
        </Field>
        <Field label="Supplement">
          <select className={inputClassName} {...form.register("supplement_id")}>
            {catalog.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Dose">
          <Input type="number" min="0" step="0.1" {...form.register("dose")} />
        </Field>
        <Field label="Unit">
          <Input {...form.register("unit")} />
        </Field>
        <Field label="Time of day">
          <select className={inputClassName} {...form.register("time_of_day")}>
            <option value="morning">Morning</option>
            <option value="midday">Midday</option>
            <option value="evening">Evening</option>
            <option value="night">Night</option>
            <option value="any">Any</option>
          </select>
        </Field>
        <Field label="Notizen">
          <Input placeholder="optional" {...form.register("notes")} />
        </Field>
      </div>
      {form.formState.errors.supplement_id && (
        <p className="mt-3 text-sm text-rose-300">{form.formState.errors.supplement_id.message}</p>
      )}
      {createIntake.isError && (
        <p className="mt-3 text-sm text-rose-300">{createIntake.error.message}</p>
      )}
      {createIntake.isSuccess && (
        <p className="mt-3 text-sm text-emerald-300">Supplement gespeichert.</p>
      )}
      <button disabled={createIntake.isPending || catalog.length === 0} className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-300 px-5 py-3 font-medium text-slate-950 disabled:opacity-60">
        <Pill className="h-4 w-4" />
        {createIntake.isPending ? "Saving..." : "Log supplement"}
      </button>
    </form>
  );
}

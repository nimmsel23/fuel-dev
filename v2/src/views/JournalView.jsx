import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Droplets, Flame, NotebookPen, UtensilsCrossed } from "lucide-react";
import { Field, Input, MealRow, Empty, inputClassName } from "../components/ui.jsx";
import FoodSearch from "../components/FoodSearch.jsx";
import { postJson } from "../lib/api.js";

const mealSchema = z.object({
  date: z.string().min(1),
  type: z.string().min(1),
  description: z.string().min(1, "Bitte eine Mahlzeit eintragen."),
  notes: z.string().optional().default(""),
  kcal: z.coerce.number().min(0),
  protein: z.coerce.number().min(0),
  carbs: z.coerce.number().min(0),
  fat: z.coerce.number().min(0),
});

const journalSchema = z.object({
  date: z.string().min(1),
  content: z.string().default(""),
});

const waterSchema = z.object({
  date: z.string().min(1),
  water_ml: z.coerce.number().min(0),
});

export default function JournalView({ date, nutrition, journal }) {
  const queryClient = useQueryClient();
  const meals = nutrition?.meals || [];
  const waterMl = nutrition?.water_ml || 0;

  const mealForm = useForm({
    resolver: zodResolver(mealSchema),
    defaultValues: {
      date,
      type: "breakfast",
      description: "",
      notes: "",
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    },
  });

  const journalForm = useForm({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      date,
      content: journal,
    },
  });

  const waterForm = useForm({
    resolver: zodResolver(waterSchema),
    defaultValues: {
      date,
      water_ml: waterMl,
    },
  });

  useEffect(() => {
    mealForm.reset({
      date,
      type: "breakfast",
      description: "",
      notes: "",
      kcal: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  }, [date]);

  useEffect(() => {
    journalForm.reset({ date, content: journal });
  }, [date, journal]);

  useEffect(() => {
    waterForm.reset({ date, water_ml: waterMl });
  }, [date, waterMl]);

  const mealMutation = useMutation({
    mutationFn: (values) =>
      postJson("/nutrition/log", {
        date: values.date,
        meal: {
          type: values.type,
          description: values.description,
          notes: values.notes,
          kcal: values.kcal,
          protein: values.protein,
          carbs: values.carbs,
          fat: values.fat,
        },
      }),
    onSuccess: (_, values) => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", values.date] });
      mealForm.reset({
        date: values.date,
        type: values.type,
        description: "",
        notes: "",
        kcal: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      });
    },
  });

  const journalMutation = useMutation({
    mutationFn: (values) => postJson("/nutrition/journal", values),
    onSuccess: (_, values) => {
      queryClient.invalidateQueries({ queryKey: ["journal", values.date] });
    },
  });

  const waterMutation = useMutation({
    mutationFn: (values) => postJson("/nutrition/log", values),
    onSuccess: (_, values) => {
      queryClient.invalidateQueries({ queryKey: ["nutrition", values.date] });
    },
  });

  return (
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="grid gap-6">
        <form onSubmit={mealForm.handleSubmit((values) => mealMutation.mutate(values))} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Meal Logger</h2>
              <p className="text-sm text-slate-400">Schreibt direkt nach `/nutrition/log`.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">
              {meals.length} meals
            </span>
          </div>

          <FoodSearch
            onSelect={({ description, kcal, protein, carbs, fat }) => {
              mealForm.setValue("description", description);
              mealForm.setValue("kcal", kcal);
              mealForm.setValue("protein", protein);
              mealForm.setValue("carbs", carbs);
              mealForm.setValue("fat", fat);
            }}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Datum">
              <Input type="date" {...mealForm.register("date")} />
            </Field>
            <Field label="Meal type">
              <select className={inputClassName} {...mealForm.register("type")}>
                <option value="breakfast">Frühstück</option>
                <option value="lunch">Mittagessen</option>
                <option value="dinner">Abendessen</option>
                <option value="snack">Snack</option>
              </select>
            </Field>
            <Field label="Beschreibung" className="md:col-span-2">
              <Input placeholder="zB Skyr mit Beeren und Hafer" {...mealForm.register("description")} />
            </Field>
            <Field label="kcal">
              <Input type="number" min="0" step="1" {...mealForm.register("kcal")} />
            </Field>
            <Field label="Protein (g)">
              <Input type="number" min="0" step="0.1" {...mealForm.register("protein")} />
            </Field>
            <Field label="Carbs (g)">
              <Input type="number" min="0" step="0.1" {...mealForm.register("carbs")} />
            </Field>
            <Field label="Fat (g)">
              <Input type="number" min="0" step="0.1" {...mealForm.register("fat")} />
            </Field>
          </div>

          <Field label="Notizen" className="mt-3">
            <textarea className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4" {...mealForm.register("notes")} />
          </Field>

          {mealForm.formState.errors.description ? (
            <p className="mt-3 text-sm text-rose-300">{mealForm.formState.errors.description.message}</p>
          ) : null}
          {mealMutation.isError ? <p className="mt-3 text-sm text-rose-300">{mealMutation.error.message}</p> : null}
          {mealMutation.isSuccess ? <p className="mt-3 text-sm text-emerald-300">Meal gespeichert.</p> : null}

          <button disabled={mealMutation.isPending} className="mt-4 inline-flex items-center gap-2 rounded-full bg-orange-400 px-5 py-3 font-medium text-slate-950 disabled:opacity-60">
            <UtensilsCrossed className="h-4 w-4" />
            {mealMutation.isPending ? "Saving..." : "Save meal"}
          </button>
        </form>

        <form onSubmit={waterForm.handleSubmit((values) => waterMutation.mutate(values))} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <Droplets className="h-5 w-5 text-sky-300" />
            <h3 className="text-lg font-semibold">Hydration</h3>
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <Field label="Wasser ml" className="flex-1">
              <Input type="number" min="0" step="50" {...waterForm.register("water_ml")} />
            </Field>
            <button disabled={waterMutation.isPending} className="inline-flex items-center justify-center rounded-full border border-sky-300/30 bg-sky-300/10 px-5 py-3 font-medium text-sky-100 disabled:opacity-60">
              {waterMutation.isPending ? "Saving..." : "Update water"}
            </button>
          </div>
          {waterMutation.isError ? <p className="mt-3 text-sm text-rose-300">{waterMutation.error.message}</p> : null}
        </form>
      </div>

      <div className="grid gap-6">
        <form onSubmit={journalForm.handleSubmit((values) => journalMutation.mutate(values))} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Journal Editor</h2>
              <p className="text-sm text-slate-400">Schreibt direkt nach `/nutrition/journal`.</p>
            </div>
            <NotebookPen className="h-5 w-5 text-sky-300" />
          </div>
          <Field label="Text">
            <textarea className="min-h-80 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4" {...journalForm.register("content")} />
          </Field>
          {journalMutation.isError ? <p className="mt-3 text-sm text-rose-300">{journalMutation.error.message}</p> : null}
          {journalMutation.isSuccess ? <p className="mt-3 text-sm text-emerald-300">Journal gespeichert.</p> : null}
          <button disabled={journalMutation.isPending} className="mt-4 inline-flex items-center gap-2 rounded-full bg-sky-300 px-5 py-3 font-medium text-slate-950 disabled:opacity-60">
            <NotebookPen className="h-4 w-4" />
            {journalMutation.isPending ? "Saving..." : "Save journal"}
          </button>
        </form>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-300" />
            <h3 className="text-lg font-semibold">Latest meals</h3>
          </div>
          <div className="grid gap-3">
            {meals.length ? meals.slice().reverse().map((meal) => <MealRow key={meal.id} meal={meal} />) : <Empty text="Für dieses Datum gibt es noch keine Meals." />}
          </div>
        </section>
      </div>
    </section>
  );
}

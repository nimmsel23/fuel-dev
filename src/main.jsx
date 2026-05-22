import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { Activity, CalendarDays, Droplets, Flame, Leaf, Microscope, NotebookPen, Pill, PlusCircle, Settings2, Sparkles, TrendingUp, UtensilsCrossed, Waves } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { twMerge } from "tailwind-merge";
import "./styles.css";
import FoodView from "./views/FoodView.jsx";
import MicrosView from "./views/MicrosView.jsx";
import NutritionHeatmap from "./components/NutritionHeatmap.jsx";
import FoodSearch from "./components/FoodSearch.jsx";

const qc = new QueryClient();

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

const supplementSchema = z.object({
  date: z.string().min(1),
  supplement_id: z.string().min(1, "Bitte ein Supplement waehlen."),
  dose: z.coerce.number().min(0),
  unit: z.string().min(1),
  time_of_day: z.string().min(1),
  notes: z.string().optional().default(""),
});

const useApp = create((set) => ({
  activeTab: "dashboard",
  activeDate: format(new Date(), "yyyy-MM-dd"),
  setActiveTab: (activeTab) => set({ activeTab }),
  setActiveDate: (activeDate) => set({ activeDate }),
}));

const useSettings = create(
  persist(
    (set) => ({
      kcal_goal: 2000,
      protein_goal: 150,
      water_goal: 2500,
      age: 30,
      gender: "m",
      setSetting: (key, val) => set({ [key]: val }),
    }),
    { name: "fuel-settings" }
  )
);

async function fetchJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function postJson(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // keep fallback
    }
    throw new Error(message);
  }
  return res.json();
}

function useNutritionData(date) {
  return useQuery({
    queryKey: ["nutrition", date],
    queryFn: async () => {
      const data = await fetchJson(`/nutrition/log?date=${date}`);
      return data.data;
    },
    staleTime: 30_000,
  });
}

function useSuppStats(date) {
  return useQuery({
    queryKey: ["supp-stats", date],
    queryFn: () => fetchJson(`/supplements/stats?days=30&anchor=${date}`),
    staleTime: 30_000,
  });
}

function useSuppCatalog() {
  return useQuery({
    queryKey: ["supp-catalog"],
    queryFn: async () => {
      const data = await fetchJson("/supplements/catalog");
      return data.items || [];
    },
    staleTime: 300_000,
  });
}

function useSuppLog(date) {
  return useQuery({
    queryKey: ["supp-log", date],
    queryFn: async () => {
      const data = await fetchJson(`/supplements/log?date=${date}`);
      return data.data;
    },
    staleTime: 30_000,
  });
}

function useJournal(date) {
  return useQuery({
    queryKey: ["journal", date],
    queryFn: async () => {
      const data = await fetchJson(`/nutrition/journal?date=${date}`);
      return data.content;
    },
    staleTime: 30_000,
  });
}


function sumMetric(meals, key) {
  return meals.reduce((sum, meal) => sum + (Number(meal[key]) || 0), 0);
}

function formatMetric(value, unit = "") {
  const rounded = Math.round((Number(value) || 0) * 10) / 10;
  const output = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return unit ? `${output}${unit}` : output;
}

function normalizeSupplementUnit(unit) {
  const value = String(unit || "").trim();
  if (!value) return "mg";
  const parts = value.split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : value;
}

function App() {
  const { activeTab, setActiveTab, activeDate, setActiveDate } = useApp();
  const { data: nutrition } = useNutritionData(activeDate);
  const { data: sup } = useSuppStats(activeDate);
  const { data: suppCatalog } = useSuppCatalog();
  const { data: suppLog } = useSuppLog(activeDate);
  const { data: journal } = useJournal(activeDate);

  const meals = nutrition?.meals || [];
  const totalKcal = sumMetric(meals, "kcal");
  const totalProtein = sumMetric(meals, "protein");
  const totalCarbs = sumMetric(meals, "carbs");
  const totalFat = sumMetric(meals, "fat");
  const macroSeries = [
    { name: "Kcal", value: totalKcal },
    { name: "Protein", value: totalProtein },
    { name: "Carbs", value: totalCarbs },
    { name: "Fat", value: totalFat },
  ];

  return (
    <div className="min-h-screen text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        <header className="mb-6 grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-400/30 bg-orange-400/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-orange-200">
                <Sparkles className="h-3.5 w-3.5" />
                FuelCtx v2
              </p>
              <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">Nutrition Journal Control Deck</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-300 md:text-base">
                Fuel Studio schreibt jetzt direkt in die Nutrition- und Journal-Daten statt nur Mock-UI zu zeigen.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-right">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Tagessumme</div>
              <div className="mt-2 text-3xl font-semibold text-orange-300">{formatMetric(totalKcal)}</div>
              <div className="text-sm text-slate-400">kcal geloggt</div>
            </div>
          </div>

          <NutritionHeatmap selectedDate={activeDate} onSelectDate={setActiveDate} />

          <nav className="flex flex-wrap gap-2">
            {[
              ["dashboard", "Dashboard", Flame],
              ["food", "Food", UtensilsCrossed],
              ["calendar", "Big Calendar", CalendarDays],
              ["journal", "Journal", NotebookPen],
              ["supplements", "Supplements", Pill],
              ["micros", "Mikros", Microscope],
              ["settings", "Setup", Settings2],
            ].map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={twMerge(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition",
                  activeTab === key
                    ? "border-orange-400/40 bg-orange-400 text-slate-950"
                    : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </header>

        {activeTab === "dashboard" && (
          <Dashboard
            nutrition={nutrition}
            sup={sup}
            journal={journal}
            macroSeries={macroSeries}
          />
        )}
        {activeTab === "food" && <FoodView activeDate={activeDate} setActiveDate={setActiveDate} />}
        {activeTab === "calendar" && <CalendarView date={activeDate} nutrition={nutrition} />}
        {activeTab === "journal" && (
          <JournalView
            date={activeDate}
            nutrition={nutrition}
            journal={journal || ""}
          />
        )}
        {activeTab === "supplements" && (
          <SupplementsView
            date={activeDate}
            sup={sup}
            catalog={suppCatalog || []}
            suppLog={suppLog}
          />
        )}
        {activeTab === "micros" && <MicrosView />}
        {activeTab === "settings" && <SettingsView />}
      </div>
    </div>
  );
}

function Card({ icon: Icon, title, value, hint, className }) {
  return (
    <section className={twMerge("rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{title}</p>
          <div className="mt-3 text-3xl font-semibold">{value}</div>
          <p className="mt-2 text-sm text-slate-400">{hint}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-orange-300">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </section>
  );
}

function GoalBar({ label, value, goal, unit, color = "bg-orange-400" }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span className="uppercase tracking-[0.15em]">{label}</span>
        <span>{formatMetric(value)}{unit} / {goal}{unit}</span>
      </div>
      <div className="h-2 rounded-full bg-white/10">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Dashboard({ nutrition, sup, journal, macroSeries }) {
  const meals = nutrition?.meals || [];
  const streak = sup?.stats?.[0]?.current_streak || 0;
  const totalKcal = sumMetric(meals, "kcal");
  const totalProtein = sumMetric(meals, "protein");
  const { kcal_goal, protein_goal, water_goal } = useSettings();
  const waterMl = nutrition?.water_ml || 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
      <div className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card icon={UtensilsCrossed} title="Meals" value={meals.length} hint="heutige Einträge" />
          <Card icon={Activity} title="Protein" value={`${formatMetric(totalProtein)} g`} hint="aus allen Meals des Tages" />
          <Card icon={Waves} title="Water" value={`${waterMl} ml`} hint="Tageshydration" />
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <h2 className="mb-4 text-lg font-semibold">Tagesziele</h2>
          <div className="grid gap-3">
            <GoalBar label="Kalorien" value={totalKcal} goal={kcal_goal} unit=" kcal" color="bg-orange-400" />
            <GoalBar label="Protein" value={totalProtein} goal={protein_goal} unit="g" color="bg-emerald-400" />
            <GoalBar label="Wasser" value={waterMl} goal={water_goal} unit=" ml" color="bg-sky-400" />
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Day Macros</h2>
              <p className="text-sm text-slate-400">Direkt aus den Nutrition-Logs berechnet.</p>
            </div>
            <TrendingUp className="h-5 w-5 text-orange-300" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={macroSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <aside className="grid gap-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <Leaf className="h-5 w-5 text-emerald-300" />
            <h2 className="text-lg font-semibold">Today</h2>
          </div>
          <div className="space-y-3">
            {meals.length ? meals.map((meal) => <MealRow key={meal.id} meal={meal} />) : <Empty text="Keine Mahlzeiten geloggt" />}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <NotebookPen className="h-5 w-5 text-sky-300" />
              <h2 className="text-lg font-semibold">Journal</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">
              streak {streak}d
            </span>
          </div>
          <p className="text-sm leading-6 text-slate-300 whitespace-pre-wrap">{journal || "Kein Journaleintrag geladen."}</p>
        </section>
      </aside>
    </div>
  );
}

function MealRow({ meal }) {
  const details = [
    meal.kcal ? `${formatMetric(meal.kcal)} kcal` : null,
    meal.protein ? `${formatMetric(meal.protein)}g P` : null,
    meal.carbs ? `${formatMetric(meal.carbs)}g C` : null,
    meal.fat ? `${formatMetric(meal.fat)}g F` : null,
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <strong>{meal.description || meal.speise || "Meal"}</strong>
        <span className="text-xs uppercase tracking-[0.2em] text-orange-300">{meal.type || meal.mahlzeit}</span>
      </div>
      {details.length ? <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{details.join(" · ")}</div> : null}
      <div className="mt-2 text-sm text-slate-400">{meal.notes || meal.notizen || "No notes"}</div>
    </div>
  );
}

function Empty({ text }) {
  return <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">{text}</div>;
}

function CalendarView({ date, nutrition }) {
  const initialMonth = parseISO(`${date}T00:00:00`);
  const range = {
    start: format(startOfMonth(initialMonth), "yyyy-MM-dd"),
    end: format(endOfMonth(initialMonth), "yyyy-MM-dd"),
  };
  const meals = nutrition?.meals || [];
  const events = meals.map((meal) => ({
    title: `${meal.type}: ${meal.description}`,
    date,
  }));

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Big Calendar</h2>
          <p className="text-sm text-slate-400">Für den gewählten Tag werden echte Meal-Logs als Events gespiegelt.</p>
        </div>
        <PlusCircle className="h-5 w-5 text-orange-300" />
      </div>
      <div className="mb-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
        Monat: {range.start} bis {range.end}
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={date}
          height="auto"
          events={events}
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
        />
      </div>
    </section>
  );
}

function JournalView({ date, nutrition, journal }) {
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

function SupplementsView({ date, sup, catalog, suppLog }) {
  const queryClient = useQueryClient();
  const stats = sup?.stats || [];
  const intakes = suppLog?.intakes || [];
  const intakeCountBySupplement = intakes.reduce((map, intake) => {
    map[intake.supplement_id] = (map[intake.supplement_id] || 0) + 1;
    return map;
  }, {});
  const quickCatalog = catalog.filter((item) => [
    "melatonin",
    "glycin",
    "magnesium",
    "kollagen",
    "vitamin_d3",
    "omega3",
    "zink",
    "kreatin",
  ].includes(item.id));

  const supplementForm = useForm({
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
    const selected = catalog.find((item) => item.id === supplementForm.getValues("supplement_id")) || catalog[0];
    supplementForm.reset({
      date,
      supplement_id: selected?.id || "",
      dose: selected?.default_dose ?? 0,
      unit: normalizeSupplementUnit(selected?.unit),
      time_of_day: selected?.default_time_of_day || "any",
      notes: "",
    });
  }, [date, catalog]);

  const createSupplementMutation = useMutation({
    mutationFn: (values) =>
      postJson("/supplements/log", {
        date: values.date,
        intake: {
          supplement_id: values.supplement_id,
          dose: values.dose,
          unit: values.unit,
          time_of_day: values.time_of_day,
          notes: values.notes,
        },
      }),
    onSuccess: (_, values) => {
      queryClient.invalidateQueries({ queryKey: ["supp-log", values.date] });
      queryClient.invalidateQueries({ queryKey: ["supp-stats", values.date] });
      const selected = catalog.find((item) => item.id === values.supplement_id);
      supplementForm.reset({
        date: values.date,
        supplement_id: values.supplement_id,
        dose: selected?.default_dose ?? values.dose ?? 0,
        unit: normalizeSupplementUnit(selected?.unit || values.unit),
        time_of_day: selected?.default_time_of_day || values.time_of_day,
        notes: "",
      });
    },
  });

  const deleteSupplementMutation = useMutation({
    mutationFn: ({ date: intakeDate, delete_id }) =>
      postJson("/supplements/log", { date: intakeDate, delete_id }),
    onSuccess: (_, values) => {
      queryClient.invalidateQueries({ queryKey: ["supp-log", values.date] });
      queryClient.invalidateQueries({ queryKey: ["supp-stats", values.date] });
    },
  });

  const selectedSupplementId = supplementForm.watch("supplement_id");
  useEffect(() => {
    const selected = catalog.find((item) => item.id === selectedSupplementId);
    if (!selected) return;
    supplementForm.setValue("unit", normalizeSupplementUnit(selected.unit));
    supplementForm.setValue("time_of_day", selected.default_time_of_day || "any");
    supplementForm.setValue("dose", selected.default_dose ?? 0);
  }, [selectedSupplementId, catalog]);

  function quickLogSupplement(item) {
    createSupplementMutation.mutate({
      date,
      supplement_id: item.id,
      dose: item.default_dose ?? 0,
      unit: normalizeSupplementUnit(item.unit),
      time_of_day: item.default_time_of_day || "any",
      notes: "",
    });
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="grid gap-6">
        <form onSubmit={supplementForm.handleSubmit((values) => createSupplementMutation.mutate(values))} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Pill className="h-5 w-5 text-violet-300" />
                <h2 className="text-xl font-semibold">Supplement logger</h2>
              </div>
              <p className="text-sm text-slate-400">Loggt direkt nach `/supplements/log` fuer das gewaehlte Datum.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">
              {intakes.length} intakes
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Datum">
              <Input type="date" {...supplementForm.register("date")} />
            </Field>
            <Field label="Supplement">
              <select className={inputClassName} {...supplementForm.register("supplement_id")}>
                {catalog.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dose">
              <Input type="number" min="0" step="0.1" {...supplementForm.register("dose")} />
            </Field>
            <Field label="Unit">
              <Input {...supplementForm.register("unit")} />
            </Field>
            <Field label="Time of day">
              <select className={inputClassName} {...supplementForm.register("time_of_day")}>
                <option value="morning">Morning</option>
                <option value="midday">Midday</option>
                <option value="evening">Evening</option>
                <option value="night">Night</option>
                <option value="any">Any</option>
              </select>
            </Field>
            <Field label="Notizen">
              <Input placeholder="optional" {...supplementForm.register("notes")} />
            </Field>
          </div>

          {supplementForm.formState.errors.supplement_id ? (
            <p className="mt-3 text-sm text-rose-300">{supplementForm.formState.errors.supplement_id.message}</p>
          ) : null}
          {createSupplementMutation.isError ? <p className="mt-3 text-sm text-rose-300">{createSupplementMutation.error.message}</p> : null}
          {createSupplementMutation.isSuccess ? <p className="mt-3 text-sm text-emerald-300">Supplement gespeichert.</p> : null}

          <button disabled={createSupplementMutation.isPending || catalog.length === 0} className="mt-4 inline-flex items-center gap-2 rounded-full bg-violet-300 px-5 py-3 font-medium text-slate-950 disabled:opacity-60">
            <Pill className="h-4 w-4" />
            {createSupplementMutation.isPending ? "Saving..." : "Log supplement"}
          </button>
        </form>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-300" />
                <h3 className="text-lg font-semibold">Quick log</h3>
              </div>
              <p className="text-sm text-slate-400">Ein Tap mit den Katalog-Defaults. Gut fuer die Standard-Stack-Routine.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">
              {date}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {quickCatalog.length ? quickCatalog.map((item) => {
              const count = intakeCountBySupplement[item.id] || 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => quickLogSupplement(item)}
                  disabled={createSupplementMutation.isPending}
                  className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-left transition hover:bg-slate-900 disabled:opacity-60"
                >
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-slate-100">{item.name}</strong>
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.default_time_of_day}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    {formatMetric(item.default_dose ?? 0)} {normalizeSupplementUnit(item.unit)}
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-[0.18em] text-orange-200">
                    {count > 0 ? `${count}x heute im Stack` : "heute noch nicht im Stack"}
                  </div>
                </button>
              );
            }) : <Empty text="Kein Quick-Log-Katalog verfuegbar." />}
          </div>
          {createSupplementMutation.isError ? <p className="mt-3 text-sm text-rose-300">{createSupplementMutation.error.message}</p> : null}
        </section>

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
                    onClick={() => deleteSupplementMutation.mutate({ date, delete_id: intake.id })}
                    disabled={deleteSupplementMutation.isPending}
                    className="rounded-full border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs uppercase tracking-[0.18em] text-rose-100 disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )) : <Empty text="Fuer dieses Datum sind noch keine Supplements geloggt." />}
          </div>
          {deleteSupplementMutation.isError ? <p className="mt-3 text-sm text-rose-300">{deleteSupplementMutation.error.message}</p> : null}
        </section>
      </div>

      <div className="grid gap-6">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <Pill className="h-5 w-5 text-violet-300" />
            <h3 className="text-lg font-semibold">30-day stats</h3>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {stats.length ? stats.map((row) => (
              <div key={row.supplement.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong>{row.supplement.name}</strong>
                  <span className="text-xs text-slate-400">{row.days_taken}d</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">Streak {row.current_streak} days</p>
              </div>
            )) : <Empty text="Keine Supplements geladen" />}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="mb-4 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-slate-300" />
            <h3 className="text-lg font-semibold">Catalog</h3>
          </div>
          <div className="grid gap-3">
            {catalog.length ? catalog.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong>{item.name}</strong>
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.default_time_of_day}</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  Default: {formatMetric(item.default_dose ?? 0)} {item.unit}
                </p>
              </div>
            )) : <Empty text="Kein Supplement-Katalog geladen." />}
          </div>
        </section>
      </div>
    </section>
  );
}

function SettingsView() {
  const { kcal_goal, protein_goal, water_goal, age, gender, setSetting } = useSettings();
  const [syncStatus, setSyncStatus] = React.useState(null);
  const [syncing, setSyncing] = React.useState(false);
  const [health, setHealth] = React.useState(null);

  React.useEffect(() => {
    fetch("/health").then(r => r.json()).then(setHealth).catch(() => setHealth({ status: "error" }));
    fetch("/api/fuel-firestore/status").then(r => r.json()).then(setSyncStatus).catch(() => setSyncStatus({ ok: false, firestore: "unreachable" }));
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/fuel-firestore/ping", { method: "POST" });
      const r = await fetch("/api/fuel-firestore/status");
      setSyncStatus(await r.json());
    } catch {
      setSyncStatus({ ok: false, firestore: "unreachable" });
    } finally {
      setSyncing(false);
    }
  }

  const sectionCls = "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur grid gap-4";
  const labelCls = "text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 block";

  return (
    <div className="grid gap-6 lg:grid-cols-2">

      {/* Tagesziele */}
      <section className={sectionCls}>
        <div className="flex items-center gap-2 mb-1">
          <Flame className="h-5 w-5 text-orange-300" />
          <h2 className="text-lg font-semibold">Tagesziele</h2>
        </div>
        <div className="grid gap-3">
          <div>
            <label className={labelCls}>Kalorien (kcal)</label>
            <input
              type="number" value={kcal_goal} min={500} max={6000}
              onChange={e => setSetting("kcal_goal", Number(e.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100"
            />
          </div>
          <div>
            <label className={labelCls}>Protein (g)</label>
            <input
              type="number" value={protein_goal} min={30} max={400}
              onChange={e => setSetting("protein_goal", Number(e.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100"
            />
          </div>
          <div>
            <label className={labelCls}>Wasser (ml)</label>
            <input
              type="number" value={water_goal} min={500} max={6000} step={250}
              onChange={e => setSetting("water_goal", Number(e.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100"
            />
          </div>
        </div>
      </section>

      {/* Profil */}
      <section className={sectionCls}>
        <div className="flex items-center gap-2 mb-1">
          <Activity className="h-5 w-5 text-emerald-300" />
          <h2 className="text-lg font-semibold">Profil</h2>
        </div>
        <div className="grid gap-3">
          <div>
            <label className={labelCls}>Alter</label>
            <input
              type="number" value={age} min={15} max={99}
              onChange={e => setSetting("age", Number(e.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100"
            />
          </div>
          <div>
            <label className={labelCls}>Geschlecht</label>
            <select
              value={gender}
              onChange={e => setSetting("gender", e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100"
            >
              <option value="m">Männlich</option>
              <option value="f">Weiblich</option>
            </select>
          </div>
          <p className="text-xs text-slate-500">Wird für DACH-Referenzwerte im Mikros-Tab verwendet.</p>
        </div>
      </section>

      {/* Firestore Sync */}
      <section className={sectionCls}>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-violet-300" />
          <h2 className="text-lg font-semibold">Firestore Sync</h2>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
          <span className="text-sm text-slate-400">Status</span>
          {syncStatus === null
            ? <span className="text-xs text-slate-500">Prüfe…</span>
            : syncStatus.ok
              ? <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">verbunden</span>
              : <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs text-red-300">{syncStatus.firestore}</span>
          }
        </div>
        {syncStatus?.ok && (
          <p className="text-xs text-slate-500">{syncStatus.sa}</p>
        )}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="mt-1 rounded-2xl border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-sm text-violet-200 transition hover:bg-violet-400/20 disabled:opacity-40"
        >
          {syncing ? "Synchronisiere…" : "Jetzt synchronisieren (heute)"}
        </button>
      </section>

      {/* System */}
      <section className={sectionCls}>
        <div className="flex items-center gap-2 mb-1">
          <Settings2 className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold">System</h2>
        </div>
        <div className="grid gap-2 text-sm">
          {[
            ["fuel-dev", health?.status === "ok" ? "online :9000" : health ? "error" : "prüfe…", health?.status === "ok"],
            ["Bridge", syncStatus !== null ? (syncStatus.ok || syncStatus.firestore !== "unreachable" ? "online :9080" : "offline") : "prüfe…", syncStatus?.ok || (syncStatus && syncStatus.firestore !== "unreachable")],
            ["Data", "~/.aos/fuel/", true],
          ].map(([label, val, ok]) => (
            <div key={label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
              <span className="text-slate-400">{label}</span>
              <span className={ok ? "text-slate-300" : "text-red-400"}>{val}</span>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

function Field({ label, children, className }) {
  return (
    <label className={twMerge("grid gap-2 text-sm text-slate-300", className)}>
      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const inputClassName = "rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";

function Input(props) {
  return <input className={inputClassName} {...props} />;
}


createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

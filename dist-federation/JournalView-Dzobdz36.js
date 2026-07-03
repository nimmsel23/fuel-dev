import { importShared } from './__federation_fn_import-BlZWqUMR.js';
import { j as jsxRuntimeExports } from './jsx-runtime-CsM3lTE3.js';
import { u as useQueryClient } from './QueryClientProvider-j9id1xDJ.js';
import { u as useMutation } from './useMutation-BQx-HQDh.js';
import { t as twMerge } from './bundle-mjs-BTFBU_Un.js';
import { a as patchJson, p as postJson } from './api-BbKnJ9mL.js';
import { F as FoodSearch } from './FoodSearch-CwDjFbaA.js';

const {useState} = await importShared('react');
const {NotebookPen,UtensilsCrossed,Pencil,Trash2,Sparkles} = await importShared('lucide-react');
const MEAL_TYPES = [
  { value: "breakfast", label: "Frühstück" },
  { value: "lunch", label: "Mittagessen" },
  { value: "dinner", label: "Abendessen" },
  { value: "snack", label: "Snack" }
];
const MEAL_LABEL = Object.fromEntries(MEAL_TYPES.map(({ value, label }) => [value, label]));
const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";
const EMPTY_FORM = { id: null, type: "breakfast", description: "", notes: "", kcal: "", protein: "", carbs: "", fat: "" };
function Field({ label, children }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "grid gap-2 text-sm text-slate-300", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs uppercase tracking-[0.18em] text-slate-500", children: label }),
    children
  ] });
}
function JournalView({ date, nutrition, journal }) {
  const qc = useQueryClient();
  const [text, setText] = useState(journal || "");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [moveDate, setMoveDate] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const isEditing = Boolean(form.id);
  const meals = nutrition?.meals || [];
  const cloud = window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com");
  const handleJournalSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await postJson("/nutrition/journal", { date, content: text });
      qc.invalidateQueries({ queryKey: ["journal", date] });
    } catch (err) {
      console.error("Journal save error:", err);
    } finally {
      setLoading(false);
    }
  };
  const handleAiLog = async (e) => {
    e.preventDefault();
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      await postJson("/nutrition/ai-log", { text: aiText, date });
      qc.invalidateQueries({ queryKey: ["nutrition", date] });
      setAiText("");
    } catch (err) {
      console.error("AI Logging error:", err);
    } finally {
      setAiLoading(false);
    }
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const cancelEdit = () => {
    setForm(EMPTY_FORM);
    setMoveDate("");
  };
  function loadForEdit(meal) {
    setForm({
      id: meal.id,
      type: meal.type,
      description: meal.description,
      notes: meal.notes || "",
      kcal: meal.kcal,
      protein: meal.protein,
      carbs: meal.carbs,
      fat: meal.fat
    });
    setMoveDate("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const saveMeal = useMutation({
    mutationFn: () => {
      if (isEditing) {
        const body = {
          date,
          meal_id: form.id,
          meal: {
            type: form.type,
            description: form.description,
            notes: form.notes,
            kcal: form.kcal,
            protein: form.protein,
            carbs: form.carbs,
            fat: form.fat
          }
        };
        if (moveDate && moveDate !== date) body.new_date = moveDate;
        return patchJson("/nutrition/log", body);
      }
      return postJson("/nutrition/log", {
        date,
        meal: {
          type: form.type,
          description: form.description,
          notes: form.notes,
          kcal: form.kcal,
          protein: form.protein,
          carbs: form.carbs,
          fat: form.fat
        }
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", date] });
      if (moveDate) qc.invalidateQueries({ queryKey: ["nutrition", moveDate] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
      setForm(EMPTY_FORM);
      setMoveDate("");
    }
  });
  const saveCatalog = useMutation({
    mutationFn: () => postJson("/nutrition/catalog", {
      item: {
        kind: "meal",
        category: "meal",
        name: form.description.trim(),
        description: form.description.trim(),
        meal_type: form.type,
        notes: form.notes,
        kcal: Number(form.kcal) || 0,
        protein: Number(form.protein) || 0,
        carbs: Number(form.carbs) || 0,
        fat: Number(form.fat) || 0,
        source: "manual"
      }
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition-catalog"] })
  });
  const deleteMeal = useMutation({
    mutationFn: (id) => postJson("/nutrition/log", { date, delete_meal_id: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", date] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
      if (isEditing) setForm(EMPTY_FORM);
    }
  });
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-8 lg:grid-cols-2", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "space-y-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(UtensilsCrossed, { className: "h-6 w-6 text-orange-300" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-2xl font-bold tracking-tight", children: "Ernährung" })
      ] }),
      !cloud && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-glow", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "text-xl font-semibold mb-4 flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "h-5 w-5 text-violet-300" }),
          "AI Logger"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: handleAiLog, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "textarea",
            {
              className: inputCls + " min-h-24 focus:ring-2 focus:ring-sky-400/50 outline-none transition-all",
              placeholder: "Was hast du gegessen? z.B. '200g Skyr mit Beeren'",
              value: aiText,
              onChange: (e) => setAiText(e.target.value)
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              disabled: aiLoading || !aiText.trim(),
              className: "mt-4 w-full bg-sky-300 text-slate-950 rounded-full py-3 font-bold disabled:opacity-50 hover:bg-sky-200 transition-colors shadow-lg active:scale-[0.98]",
              children: aiLoading ? "Verarbeite..." : "Loggen"
            }
          )
        ] })
      ] }),
      !isEditing && /* @__PURE__ */ jsxRuntimeExports.jsx(
        FoodSearch,
        {
          onSelect: ({ description, kcal, protein, carbs, fat }) => setForm((f) => ({ ...f, description, kcal, protein, carbs, fat }))
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: twMerge(
        "rounded-3xl border p-5 space-y-4 transition-all duration-300",
        isEditing ? "border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.2)] bg-orange-400/5 ring-1 ring-orange-400/20" : "border-white/10 bg-white/5 backdrop-blur"
      ), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
            isEditing ? /* @__PURE__ */ jsxRuntimeExports.jsx(Pencil, { className: "h-4 w-4 text-orange-400" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(UtensilsCrossed, { className: "h-4 w-4 text-slate-400" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: twMerge("text-sm font-semibold uppercase tracking-widest", isEditing ? "text-orange-400" : "text-slate-400"), children: isEditing ? "Eintrag bearbeiten" : "Mahlzeit loggen" })
          ] }),
          isEditing && /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: cancelEdit, className: "text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors bg-white/5 px-2 py-1 rounded-md", children: "Abbrechen" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: "Mahlzeit", children: /* @__PURE__ */ jsxRuntimeExports.jsx("select", { className: inputCls, value: form.type, onChange: set("type"), children: MEAL_TYPES.map(({ value, label }) => /* @__PURE__ */ jsxRuntimeExports.jsx("option", { value, children: label }, value)) }) }),
          isEditing && /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: "Datum verschieben", children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "date", className: inputCls, value: moveDate, onChange: (e) => setMoveDate(e.target.value) }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: "Beschreibung", children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { className: inputCls, placeholder: "Mahlzeit…", value: form.description, onChange: set("description") }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-4 gap-3", children: [["kcal", "kcal"], ["protein", "Prot g"], ["carbs", "Carb g"], ["fat", "Fett g"]].map(([k, lbl]) => /* @__PURE__ */ jsxRuntimeExports.jsx(Field, { label: lbl, children: /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "number", min: "0", className: inputCls, value: form[k], onChange: set(k) }) }, k)) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => saveMeal.mutate(),
              disabled: saveMeal.isPending || !form.description,
              className: twMerge(
                "w-full rounded-2xl py-4 font-bold transition shadow-lg",
                saveMeal.isPending || !form.description ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-orange-400 text-slate-950 hover:bg-orange-300 active:scale-[0.98]"
              ),
              children: saveMeal.isPending ? "Speichert…" : isEditing ? "Änderungen speichern" : "Mahlzeit loggen"
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            "button",
            {
              onClick: () => saveCatalog.mutate(),
              disabled: saveCatalog.isPending || !form.description,
              className: twMerge(
                "w-full rounded-2xl border py-4 font-bold transition border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                (saveCatalog.isPending || !form.description) && "opacity-50 cursor-not-allowed"
              ),
              children: "Katalog+"
            }
          )
        ] })
      ] }),
      meals.length > 0 && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "px-1 text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold", children: "Geloggte Mahlzeiten" }),
        meals.map((m) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
          "div",
          {
            className: twMerge(
              "flex items-center justify-between rounded-2xl border px-4 py-3 transition",
              form.id === m.id ? "border-orange-400/40 bg-orange-400/5" : "border-white/5 bg-slate-900/40 hover:bg-slate-900/70"
            ),
            children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0 flex-1", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "truncate font-medium text-slate-100", children: m.description }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-0.5 text-xs text-slate-500", children: [
                  MEAL_LABEL[m.type] || m.type,
                  " · ",
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "text-orange-300", children: [
                    m.kcal,
                    " kcal"
                  ] }),
                  " · ",
                  "P ",
                  m.protein,
                  "g · C ",
                  m.carbs,
                  "g · F ",
                  m.fat,
                  "g"
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "ml-3 flex gap-2 shrink-0", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: () => loadForEdit(m),
                    title: "Bearbeiten",
                    className: twMerge(
                      "rounded-lg border p-2 transition",
                      form.id === m.id ? "border-orange-400 bg-orange-400 text-slate-950" : "border-white/10 bg-white/5 text-slate-400 hover:text-orange-400 hover:bg-orange-400/10"
                    ),
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx(Pencil, { className: "h-3.5 w-3.5" })
                  }
                ),
                /* @__PURE__ */ jsxRuntimeExports.jsx(
                  "button",
                  {
                    onClick: () => deleteMeal.mutate(m.id),
                    title: "Löschen",
                    className: "rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition",
                    children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "h-3.5 w-3.5" })
                  }
                )
              ] })
            ]
          },
          m.id
        ))
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "space-y-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(NotebookPen, { className: "h-6 w-6 text-sky-300" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-2xl font-bold tracking-tight", children: "Tagebuch" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("form", { onSubmit: handleJournalSave, className: "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-glow", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "textarea",
          {
            className: "min-h-[500px] w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-sky-400/50 outline-none transition-all",
            value: text,
            onChange: (e) => setText(e.target.value),
            placeholder: "Was hat dich heute bewegt? Training, Schlaf, Befinden..."
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { disabled: loading, className: "mt-4 w-full rounded-full bg-sky-300 py-4 font-bold text-slate-950 disabled:opacity-60 hover:bg-sky-200 transition-colors shadow-lg active:scale-[0.98]", children: loading ? "Speichere..." : "Journal speichern" })
      ] })
    ] })
  ] });
}

export { JournalView as default };

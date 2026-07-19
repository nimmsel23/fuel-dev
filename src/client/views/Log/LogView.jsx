import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NotebookPen, UtensilsCrossed, Pencil, Trash2, Sparkles, AlertTriangle, RefreshCw, Check, X, ScanSearch } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { postJson, patchJson } from "@api";
import { vertexAI } from "../../lib/firebase.js";
import { getGenerativeModel } from "firebase/vertexai";
import { withAiRetry } from "../../lib/aiRetry.js";
import { usePendingAiEntries } from "../../hooks/useNutrition.js";
import FoodSearch from "../../components/FoodSearch.jsx";
import ScannerModal from "./components/ScannerModal.jsx";
import { Camera, RotateCcw } from "lucide-react";
import { sumMetric, formatMetric } from "../../../shared/utils/utils.js";

// Gemeinsames Response-Schema für Makro/Mikro-Analyse (AI-Logger + Re-Analyse).
async function analyzeMealText(promptText) {
  const { MICRO_KEYS } = await import("../../lib/db/firestore/utils.js");
  const { SchemaType } = await import("firebase/vertexai");
  const model = getGenerativeModel(vertexAI, {
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, description: "Gefundenes Essen" },
          macros: {
            type: SchemaType.OBJECT,
            properties: {
              kcal: { type: SchemaType.NUMBER },
              protein: { type: SchemaType.NUMBER },
              carbs: { type: SchemaType.NUMBER },
              fat: { type: SchemaType.NUMBER }
            }
          },
          micros: {
            type: SchemaType.OBJECT,
            properties: Object.fromEntries(MICRO_KEYS.map(k => [k, { type: SchemaType.NUMBER, description: "Wert in mg oder ug" }]))
          }
        }
      }
    }
  });

  const prompt = `Analysiere folgende Mahlzeit/Lebensmittel und schätze die Makronährstoffe sowie die absoluten Mikronährstoffe (Vitamine, Mineralstoffe) so exakt wie möglich.
Eingabe: "${promptText}"`;

  const result = await withAiRetry(() => model.generateContent(prompt));
  return JSON.parse(result.response.text());
}

// Vergleicht Journal-Freitext gegen die bereits geloggten Mahlzeiten des Tages
// und liefert nur eindeutig erwähnte, aber nicht geloggte Ernährungs-Infos zurück.
async function checkJournalAgainstLog(journalText, meals) {
  const { SchemaType } = await import("firebase/vertexai");
  const model = getGenerativeModel(vertexAI, {
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          missing: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                kcal: { type: SchemaType.NUMBER },
                protein: { type: SchemaType.NUMBER },
                carbs: { type: SchemaType.NUMBER },
                fat: { type: SchemaType.NUMBER },
              }
            }
          }
        }
      }
    }
  });

  const loggedList = meals.length
    ? meals.map((m) => `- ${m.description}`).join("\n")
    : "(nichts geloggt)";

  const prompt = `Hier ist ein Freitext-Tagebucheintrag und die Liste der für heute bereits geloggten Mahlzeiten.
Prüfe, ob im Tagebuch Essen, Getränke oder Supplemente erwähnt werden, die NICHT in der Log-Liste stehen.
Gib nur eindeutig erwähnte, konkrete Ernährungs-Infos zurück, keine Vermutungen. Schätze für jeden fehlenden Punkt die Makros.

Tagebuch:
"""
${journalText}
"""

Bereits geloggt:
${loggedList}`;

  const result = await withAiRetry(() => model.generateContent(prompt));
  const parsed = JSON.parse(result.response.text());
  return parsed?.missing || [];
}

const MEAL_TYPES = [
  { value: "breakfast", label: "Frühstück" },
  { value: "lunch",     label: "Mittagessen" },
  { value: "dinner",    label: "Abendessen" },
  { value: "snack",     label: "Snack" },
];

const MEAL_LABEL = Object.fromEntries(MEAL_TYPES.map(({ value, label }) => [value, label]));

const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";
const EMPTY_FORM = { id: null, type: "breakfast", description: "", notes: "", kcal: "", protein: "", carbs: "", fat: "" };

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export default function LogView({ date, nutrition, notes }) {
  const qc = useQueryClient();
  const [text, setText] = useState(notes || "");
  const [loading, setLoading] = useState(false);
  
  // Food Form State
  const [form, setForm] = useState(EMPTY_FORM);
  const [moveDate, setMoveDate] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [journalSuggestions, setJournalSuggestions] = useState([]);
  const [journalCheckLoading, setJournalCheckLoading] = useState(false);
  const [journalCheckError, setJournalCheckError] = useState("");

  const isEditing = Boolean(form.id);
  const meals = nutrition?.meals || [];
  const cloud = window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com");
  const { data: pendingAiEntries = [] } = usePendingAiEntries(date);

  const handleNotesSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await postJson("/nutrition/notes", { date, content: text });
      qc.invalidateQueries({ queryKey: ["notes", date] });
    } catch (err) {
      console.error("Notes save error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Löst einen wartenden Eintrag auf: Vertex analysiert den Rohtext, bei Erfolg
  // wird daraus ein echtes Meal und der Pending-Eintrag verschwindet aus der
  // Ablage. Scheitert die Analyse, bleibt der Pending-Eintrag unverändert stehen.
  const resolvePendingEntry = async (entry) => {
    const { MICRO_KEYS } = await import("../../lib/db/firestore/utils.js");
    const firestore = await import("../../lib/db.firestore.js");
    const parsed = await analyzeMealText(entry.text);
    if (!parsed?.macros) throw new Error("Gemini hat keine Makros erkannt.");

    const mealName = parsed.name || entry.text;
    await postJson("/nutrition/log", {
      date,
      meal: {
        type: "snack",
        description: mealName,
        notes: "",
        kcal: parsed.macros.kcal || 0,
        protein: parsed.macros.protein || 0,
        carbs: parsed.macros.carbs || 0,
        fat: parsed.macros.fat || 0,
      },
    });

    if (parsed.micros) {
      await postJson("/nutrition/micros", {
        items: [{
          meal_name: mealName,
          kcal: parsed.macros.kcal || 0,
          ...Object.fromEntries(MICRO_KEYS.map(k => [k, parsed.micros[k] || 0]))
        }]
      });
    }

    await firestore.removePendingAiEntry(date, entry);
  };

  const reanalyzePending = useMutation({
    mutationFn: (entry) => resolvePendingEntry(entry),
    onError: (err) => {
      console.error("Pending AI entry analysis error:", err);
      setAiError((err.message || "Analyse fehlgeschlagen.") + " Eintrag bleibt in der Warteliste — jederzeit erneut versuchbar.");
    },
    onSuccess: () => setAiError(""),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", date] });
      qc.invalidateQueries({ queryKey: ["ai-pending", date] });
    },
  });

  const handleAiLog = async (e) => {
    e?.preventDefault();
    if (!aiText.trim()) return;
    setAiLoading(true);
    setAiError("");
    const rawText = aiText.trim();

    try {
      if (cloud) {
        // 1. Optimistic Save — Text landet sofort als Journal/Notiz-Eintrag des
        //    Tages, unabhängig davon ob Vertex AI danach erreichbar ist.
        const firestore = await import("../../lib/db.firestore.js");
        const entry = { id: `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, text: rawText, created_at: new Date().toISOString() };
        await firestore.addPendingAiEntry(date, entry);
        qc.invalidateQueries({ queryKey: ["ai-pending", date] });
        setAiText("");

        // 2. Analyse nachgelagert — Fehler hier verlieren den Text nicht mehr,
        //    er bleibt als wartender Eintrag mit Retry-Button stehen.
        try {
          await resolvePendingEntry(entry);
        } catch (analysisErr) {
          console.error("AI Logging analysis error:", analysisErr);
          setAiError((analysisErr.message || "Analyse fehlgeschlagen.") + " Text wurde als Notiz gespeichert — über \"Neu analysieren\" in der Warteliste erneut versuchen.");
        } finally {
          qc.invalidateQueries({ queryKey: ["nutrition", date] });
          qc.invalidateQueries({ queryKey: ["ai-pending", date] });
        }
      } else {
        // Local via Python server
        await postJson("/nutrition/ai-log", { text: rawText, date });
        qc.invalidateQueries({ queryKey: ["nutrition", date] });
        setAiText("");
      }
    } catch (err) {
      console.error("AI Logging error:", err);
      setAiError(err.message || "Fehler beim KI-Logging.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleJournalCheck = async () => {
    if (!text.trim()) return;
    setJournalCheckLoading(true);
    setJournalCheckError("");
    try {
      const missing = await checkJournalAgainstLog(text, meals);
      setJournalSuggestions(missing);
    } catch (err) {
      console.error("Journal check error:", err);
      setJournalCheckError(err.message || "Abgleich fehlgeschlagen.");
    } finally {
      setJournalCheckLoading(false);
    }
  };

  const acceptJournalSuggestion = useMutation({
    mutationFn: (item) => postJson("/nutrition/log", {
      date,
      meal: {
        type: "snack",
        description: item.name,
        notes: "aus Journal-Abgleich übernommen",
        kcal: item.kcal || 0,
        protein: item.protein || 0,
        carbs: item.carbs || 0,
        fat: item.fat || 0,
      },
    }),
    onSuccess: (_data, item) => {
      qc.invalidateQueries({ queryKey: ["nutrition", date] });
      setJournalSuggestions((prev) => prev.filter((s) => s !== item));
    },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const cancelEdit = () => { setForm(EMPTY_FORM); setMoveDate(""); };

  function loadForEdit(meal) {
    setForm({ id: meal.id, type: meal.type, description: meal.description,
      notes: meal.notes || "", kcal: meal.kcal, protein: meal.protein,
      carbs: meal.carbs, fat: meal.fat });
    setMoveDate("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const saveMeal = useMutation({
    mutationFn: () => {
      if (isEditing) {
        const body = {
          date, meal_id: form.id,
          meal: { type: form.type, description: form.description, notes: form.notes,
            kcal: form.kcal, protein: form.protein, carbs: form.carbs, fat: form.fat },
        };
        if (moveDate && moveDate !== date) body.new_date = moveDate;
        return patchJson("/nutrition/log", body);
      }
      return postJson("/nutrition/log", {
        date,
        meal: { type: form.type, description: form.description, notes: form.notes,
          kcal: form.kcal, protein: form.protein, carbs: form.carbs, fat: form.fat },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", date] });
      if (moveDate) qc.invalidateQueries({ queryKey: ["nutrition", moveDate] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
      setForm(EMPTY_FORM);
      setMoveDate("");
    },
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
        source: "manual",
      }
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition-catalog"] }),
  });

  const deleteMeal = useMutation({
    mutationFn: (id) => postJson("/nutrition/log", { date, delete_meal_id: id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", date] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
      if (isEditing) setForm(EMPTY_FORM);
    },
  });

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left Column: Food Logging */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <UtensilsCrossed className="h-6 w-6 text-orange-300" />
          <h2 className="text-2xl font-bold tracking-tight">Ernährung</h2>
        </div>

        {/* AI Logger — Hybrid (Lokal & Vertex AI in Firebase) */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-glow">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-300" />
              AI Logger
            </h2>
            <form onSubmit={handleAiLog}>
              <textarea
                className={inputCls + " min-h-24 focus:ring-2 focus:ring-sky-400/50 outline-none transition-all"}
                placeholder="Was hast du gegessen? z.B. '200g Skyr mit Beeren'"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
              />
              <div className="flex gap-2 mt-4">
                <button
                  type="submit"
                  disabled={aiLoading || !aiText.trim()}
                  className="flex-1 bg-sky-300 text-slate-950 rounded-full py-3 font-bold disabled:opacity-50 hover:bg-sky-200 transition-colors shadow-lg active:scale-[0.98]"
                >
                  {aiLoading ? "Verarbeite..." : "Loggen"}
                </button>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  className="bg-slate-800 text-sky-400 rounded-full px-5 flex items-center justify-center hover:bg-slate-700 transition-colors shadow-lg active:scale-[0.98] border border-white/10"
                  title="Foto / Barcode scannen"
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
              {aiError && (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                  <span>{aiError}</span>
                  {aiText.trim() && (
                    <button
                      type="button"
                      onClick={() => handleAiLog()}
                      className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/30 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Erneut versuchen
                    </button>
                  )}
                </div>
              )}
            </form>
          </div>
        
        {scannerOpen && (
          <ScannerModal 
            onClose={() => setScannerOpen(false)}
            onResult={(res) => {
              setForm(f => ({
                ...f,
                description: res.description,
                kcal: res.kcal || "",
                protein: res.protein || "",
                carbs: res.carbs || "",
                fat: res.fat || ""
              }));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {!isEditing && (
          <FoodSearch
            onSelect={({ description, kcal, protein, carbs, fat }) =>
              setForm((f) => ({ ...f, description, kcal, protein, carbs, fat }))
            }
          />
        )}

        {/* Manuelles Log-Formular */}
        <div className={twMerge(
          "rounded-3xl border p-5 space-y-4 transition-all duration-300",
          isEditing ? "border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.2)] bg-orange-400/5 ring-1 ring-orange-400/20" : "border-white/10 bg-white/5 backdrop-blur"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isEditing ? <Pencil className="h-4 w-4 text-orange-400" /> : <UtensilsCrossed className="h-4 w-4 text-slate-400" />}
              <h3 className={twMerge("text-sm font-semibold uppercase tracking-widest", isEditing ? "text-orange-400" : "text-slate-400")}>
                {isEditing ? "Eintrag bearbeiten" : "Mahlzeit loggen"}
              </h3>
            </div>
            {isEditing && (
              <button onClick={cancelEdit} className="text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors bg-white/5 px-2 py-1 rounded-md">
                Abbrechen
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mahlzeit">
              <select className={inputCls} value={form.type} onChange={set("type")}>
                {MEAL_TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            {isEditing && (
              <Field label="Datum verschieben">
                <input type="date" className={inputCls} value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
              </Field>
            )}
          </div>
          
          <Field label="Beschreibung">
            <input className={inputCls} placeholder="Mahlzeit…" value={form.description} onChange={set("description")} />
          </Field>

          <div className="grid grid-cols-4 gap-3">
            {[["kcal", "kcal"], ["protein", "Prot g"], ["carbs", "Carb g"], ["fat", "Fett g"]].map(([k, lbl]) => (
              <Field key={k} label={lbl}>
                <input type="number" min="0" className={inputCls} value={form[k]} onChange={set(k)} />
              </Field>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => saveMeal.mutate()} disabled={saveMeal.isPending || !form.description}
              className={twMerge("w-full rounded-2xl py-4 font-bold transition shadow-lg",
                saveMeal.isPending || !form.description
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-orange-400 text-slate-950 hover:bg-orange-300 active:scale-[0.98]"
              )}>
              {saveMeal.isPending ? "Speichert…" : isEditing ? "Änderungen speichern" : "Mahlzeit loggen"}
            </button>
            <button
              onClick={() => saveCatalog.mutate()}
              disabled={saveCatalog.isPending || !form.description}
              className={twMerge(
                "w-full rounded-2xl border py-4 font-bold transition border-white/10 bg-white/5 text-slate-200 hover:bg-white/10",
                (saveCatalog.isPending || !form.description) && "opacity-50 cursor-not-allowed"
              )}
            >
              Katalog+
            </button>
          </div>
        </div>

        {/* Geloggte Mahlzeiten Liste (Heutiges Log) */}
        {meals.length > 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5 text-orange-300" />
                Heutiges Log ({meals.length})
              </h3>
              <div className="text-xs text-slate-400 text-right">
                <span className="font-bold text-orange-300">{formatMetric(sumMetric(meals, "kcal"))} kcal</span>
                <div className="mt-0.5 space-x-2">
                  <span className="text-emerald-300">P {formatMetric(sumMetric(meals, "protein"))}g</span>
                  <span className="text-sky-300">C {formatMetric(sumMetric(meals, "carbs"))}g</span>
                  <span className="text-violet-300">F {formatMetric(sumMetric(meals, "fat"))}g</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {meals.map((m) => (
                <div key={m.id}
                  className={twMerge(
                    "flex items-center justify-between rounded-2xl border px-4 py-3 transition",
                    form.id === m.id
                      ? "border-orange-400/40 bg-orange-400/5"
                      : "border-white/5 bg-slate-900/40 hover:bg-slate-900/70"
                  )}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-100">{m.description}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {MEAL_LABEL[m.type] || m.type}
                      {" · "}<span className="text-orange-300">{m.kcal} kcal</span>
                      {" · "}P {m.protein}g · C {m.carbs}g · F {m.fat}g
                    </div>
                  </div>
                  <div className="ml-3 flex gap-2 shrink-0">
                    <button onClick={() => loadForEdit(m)}
                      title="Bearbeiten"
                      className={twMerge(
                        "rounded-lg border p-2 transition",
                        form.id === m.id
                          ? "border-orange-400 bg-orange-400 text-slate-950"
                          : "border-white/10 bg-white/5 text-slate-400 hover:text-orange-400 hover:bg-orange-400/10"
                      )}>
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => deleteMeal.mutate(m.id)}
                      title="Löschen"
                      className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Wartende AI-Logger-Einträge: Text ist gesichert, Gemini-Analyse steht (noch) aus */}
        {cloud && pendingAiEntries.length > 0 && (
          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/5 p-5 backdrop-blur">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Wartet auf Analyse ({pendingAiEntries.length})
            </h3>
            <div className="space-y-2">
              {pendingAiEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/40 px-4 py-3">
                  <div className="min-w-0 flex-1 truncate text-sm text-slate-200">{entry.text}</div>
                  <button
                    onClick={() => reanalyzePending.mutate(entry)}
                    disabled={reanalyzePending.isPending && reanalyzePending.variables?.id === entry.id}
                    title="Neu analysieren"
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 transition-colors">
                    <RefreshCw className={twMerge("h-3.5 w-3.5", reanalyzePending.isPending && reanalyzePending.variables?.id === entry.id && "animate-spin")} />
                    Neu analysieren
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Right Column: Notizen */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <NotebookPen className="h-6 w-6 text-sky-300" />
          <h2 className="text-2xl font-bold tracking-tight">Tagebuch</h2>
        </div>

        <form onSubmit={handleNotesSave} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-glow">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white tracking-wide">Notizen</h2>
          </div>
          <textarea 
            className="min-h-[500px] w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-sky-400/50 outline-none transition-all" 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder="Was hat dich heute bewegt? Training, Schlaf, Befinden..."
          />
          
          <button disabled={loading} className="mt-4 w-full rounded-full bg-sky-300 py-4 font-bold text-slate-950 disabled:opacity-60 hover:bg-sky-200 transition-colors shadow-lg active:scale-[0.98]">
            {loading ? "Speichere..." : "Notizen speichern"}
          </button>

          {cloud && (
            <button
              type="button"
              onClick={handleJournalCheck}
              disabled={journalCheckLoading || !text.trim()}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-50 transition-colors"
            >
              <ScanSearch className="h-4 w-4" />
              {journalCheckLoading ? "Gleiche ab..." : "Mit Log abgleichen"}
            </button>
          )}
        </form>

        {journalCheckError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {journalCheckError}
          </div>
        )}

        {journalSuggestions.length > 0 && (
          <div className="rounded-3xl border border-sky-400/20 bg-sky-400/5 p-5 backdrop-blur">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-sky-300">
              <ScanSearch className="h-4 w-4" />
              Im Journal erwähnt, aber nicht geloggt
            </h3>
            <div className="space-y-2">
              {journalSuggestions.map((item, idx) => (
                <div key={`${item.name}-${idx}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-slate-900/40 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-100">{item.name}</div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      <span className="text-orange-300">{item.kcal || 0} kcal</span>
                      {" · "}P {item.protein || 0}g · C {item.carbs || 0}g · F {item.fat || 0}g
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => acceptJournalSuggestion.mutate(item)}
                      disabled={acceptJournalSuggestion.isPending}
                      title="Übernehmen"
                      className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-2 text-emerald-300 hover:bg-emerald-400/20 transition">
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setJournalSuggestions((prev) => prev.filter((s) => s !== item))}
                      title="Verwerfen"
                      className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

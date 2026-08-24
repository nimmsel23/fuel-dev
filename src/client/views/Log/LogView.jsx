import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NotebookPen, UtensilsCrossed, Pencil, Trash2, Sparkles, AlertTriangle, RefreshCw, Check, X, ScanSearch, CopyPlus, Clock } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { postJson, patchJson } from "@api";
import { vertexAI } from "../../lib/firebase.js";
import { getGenerativeModel } from "firebase/vertexai";
import { withAiRetry } from "../../lib/aiRetry.js";
import { useAiMealLogger } from "../../hooks/useAiMealLogger.js";
import FoodSearch from "../../components/FoodSearch.jsx";
import ScannerModal from "./components/ScannerModal.jsx";
import { Camera, RotateCcw } from "lucide-react";
import { sumMetric, formatMetric } from "../../../shared/utils/utils.js";

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
const numCls = twMerge(inputCls, "font-ticket tabular-nums tracking-tight");

// Zwei "Ösen" oben an einer Ticket-Karte — rein dekorativ, macht aus der
// generischen abgerundeten Card einen physischen Order-Zettel.
function Grommets() {
  return (
    <>
      <span className="ticket-grommet -top-[5px] left-4" aria-hidden />
      <span className="ticket-grommet -top-[5px] right-4" aria-hidden />
    </>
  );
}

function Kicker({ children, tone = "text-orange-300/80" }) {
  return (
    <span className={twMerge("font-ticket text-[10px] uppercase tracking-[0.28em]", tone)}>
      {children}
    </span>
  );
}

// HH:MM in lokaler Zeit — Basis für die Zeitwahl im Formular. Meals wurden
// bisher serverseitig immer mit "jetzt" gestempelt, unabhängig davon wann
// tatsächlich gegessen wurde (bricht die Fastenfenster-Erkennung, wenn
// nachträglich geloggt wird) — dieses Feld macht die echte Essenszeit
// editierbar, mit "jetzt" nur als Default, nicht als Zwang.
function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function emptyForm() {
  return { id: null, type: "breakfast", description: "", notes: "", kcal: "", protein: "", carbs: "", fat: "", grams: "", time: nowHHMM() };
}

// HH:MM (lokal) aus einem gespeicherten ISO-Timestamp, für den Edit-Modus.
function hhmmFromISO(iso) {
  if (!iso) return nowHHMM();
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return nowHHMM();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// date (YYYY-MM-DD) + HH:MM (lokal) → ISO-Timestamp, wie ihn der Server
// erwartet (logged_at/time). Ohne "Z"-Suffix parst der Date-Constructor
// YYYY-MM-DDTHH:MM als lokale Zeit, toISOString() normalisiert auf UTC —
// exakt dasselbe Format wie das bisherige new Date().toISOString().
function toLoggedAt(date, hhmm) {
  if (!date || !hhmm) return new Date().toISOString();
  const d = new Date(`${date}T${hhmm}:00`);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function Field({ label, children }) {
  return (
    <label className="grid gap-2 text-sm text-slate-300">
      <span className="font-ticket text-[10px] uppercase tracking-[0.22em] text-amber-200/50">{label}</span>
      {children}
    </label>
  );
}

export default function LogView({ date, nutrition, notes }) {
  const qc = useQueryClient();
  const [text, setText] = useState(notes || "");
  const [loading, setLoading] = useState(false);
  
  // Food Form State
  const [form, setForm] = useState(emptyForm);
  // Referenz-Makros aus dem letzten Scan (ScannerModal), damit "Gewicht (g)"
  // korrigieren die Makros proportional mitzieht. Vorher: Foto-Analyse
  // schätzte z.B. 100g, das Gewicht-Feld war rein kosmetisch (nur Katalog-
  // Metadaten) — beim Korrigieren auf die tatsächliche Packungsangabe (z.B.
  // 178g) blieben kcal/Protein/Carbs/Fett unverändert stehen (2026-07-30
  // gemeldet). null = kein aktiver Scan-Bezug, Gewicht-Feld bleibt wie vorher
  // rein deskriptiv.
  const [scanBaseline, setScanBaseline] = useState(null); // { grams, kcal, protein, carbs, fat }
  const [moveDate, setMoveDate] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [journalSuggestions, setJournalSuggestions] = useState([]);
  const [journalCheckLoading, setJournalCheckLoading] = useState(false);
  const [journalCheckError, setJournalCheckError] = useState("");

  const isEditing = Boolean(form.id);
  const meals = nutrition?.meals || [];
  const cloud = window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com");

  const {
    text: aiText, setText: setAiText, loading: aiLoading, error: aiError,
    submit: handleAiLog, pendingEntries: pendingAiEntries, reanalyzePending,
  } = useAiMealLogger(date);

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
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
      setJournalSuggestions((prev) => prev.filter((s) => s !== item));
    },
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Skaliert kcal/protein/carbs/fat proportional mit, wenn eine Scan-Referenz
  // existiert (siehe scanBaseline oben) — sonst reines Textfeld wie vorher.
  const setGrams = (e) => {
    const newGrams = e.target.value;
    setForm((f) => {
      if (!scanBaseline || !newGrams || Number(newGrams) <= 0) {
        return { ...f, grams: newGrams };
      }
      const factor = Number(newGrams) / scanBaseline.grams;
      return {
        ...f,
        grams: newGrams,
        kcal: Math.round(scanBaseline.kcal * factor * 10) / 10,
        protein: Math.round(scanBaseline.protein * factor * 10) / 10,
        carbs: Math.round(scanBaseline.carbs * factor * 10) / 10,
        fat: Math.round(scanBaseline.fat * factor * 10) / 10,
      };
    });
  };
  const cancelEdit = () => { setForm(emptyForm()); setMoveDate(""); };

  function loadForEdit(meal) {
    setForm({ id: meal.id, type: meal.type, description: meal.description,
      notes: meal.notes || "", kcal: meal.kcal, protein: meal.protein,
      carbs: meal.carbs, fat: meal.fat, grams: meal.grams || "",
      time: hhmmFromISO(meal.time || meal.logged_at) });
    setMoveDate("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const saveMeal = useMutation({
    mutationFn: () => {
      if (isEditing) {
        const body = {
          date, meal_id: form.id,
          meal: { type: form.type, description: form.description, notes: form.notes,
            kcal: form.kcal, protein: form.protein, carbs: form.carbs, fat: form.fat,
            grams: Number(form.grams) || null,
            time: toLoggedAt(moveDate || date, form.time) },
        };
        if (moveDate && moveDate !== date) body.new_date = moveDate;
        return patchJson("/nutrition/log", body);
      }
      return postJson("/nutrition/log", {
        date,
        meal: { type: form.type, description: form.description, notes: form.notes,
          kcal: form.kcal, protein: form.protein, carbs: form.carbs, fat: form.fat,
          grams: Number(form.grams) || null,
          time: toLoggedAt(date, form.time) },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", date] });
      if (moveDate) qc.invalidateQueries({ queryKey: ["nutrition", moveDate] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
      setForm(emptyForm());
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
        yield_g: Number(form.grams) || null,
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
      if (isEditing) setForm(emptyForm());
    },
  });

  // "Nochmal loggen" — legt denselben Eintrag ein weiteres Mal an, ohne
  // erneut Text eintippen oder durch den AI Logger zu müssen. Löst den Fall
  // "3x dasselbe Getränk" direkt über einen Klick pro Wiederholung.
  const repeatMeal = useMutation({
    mutationFn: (meal) => postJson("/nutrition/log", {
      date,
      meal: {
        type: meal.type, description: meal.description, notes: meal.notes || "",
        kcal: meal.kcal, protein: meal.protein, carbs: meal.carbs, fat: meal.fat,
        grams: meal.grams ?? null, catalog_item_id: meal.catalog_item_id || null,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition", date] });
      qc.invalidateQueries({ queryKey: ["week-logs"] });
      qc.invalidateQueries({ queryKey: ["nutrition-catalog"] });
    },
  });

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Left Column: Küchenzettel-Rail */}
      <section className="space-y-6">
        <div>
          <Kicker>Order Rail · {date}</Kicker>
          <div className="mt-1 flex items-center gap-3">
            <UtensilsCrossed className="h-6 w-6 text-orange-300" />
            <h2 className="font-display text-3xl font-black tracking-tight text-orange-50">Ernährung</h2>
          </div>
        </div>

        {/* AI Logger — Hybrid (Lokal & Vertex AI in Firebase) */}
        <div className="grain-ember relative rounded-2xl rounded-t-sm border border-orange-400/20 bg-gradient-to-b from-orange-950/40 to-slate-950/60 p-5 pt-6 shadow-glow">
            <Grommets />
            <div className="ticket-perf -mx-5 mb-4" />
            <h2 className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-300" />
              <span className="font-display text-xl font-semibold text-orange-50">Schnellzettel</span>
              <span className="ml-auto font-ticket text-[10px] uppercase tracking-[0.22em] text-violet-300/70">AI</span>
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
                  {aiLoading ? "Verarbeite..." : "An die Küche"}
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
                fat: res.fat || "",
                grams: res.grams || "",
              }));
              // Nur setzen wenn die Analyse eine Mengenangabe mitliefert —
              // sonst bleibt das Gewicht-Feld wie vorher rein deskriptiv.
              setScanBaseline(res.grams
                ? { grams: res.grams, kcal: res.kcal || 0, protein: res.protein || 0, carbs: res.carbs || 0, fat: res.fat || 0 }
                : null);
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
          "relative rounded-2xl rounded-t-sm border p-5 pt-6 space-y-4 transition-all duration-300",
          isEditing ? "border-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.2)] bg-orange-400/5 ring-1 ring-orange-400/20" : "border-white/10 bg-white/5 backdrop-blur"
        )}>
          <Grommets />
          <div className="ticket-perf -mx-5 mb-1 opacity-70" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isEditing ? <Pencil className="h-4 w-4 text-orange-400" /> : <UtensilsCrossed className="h-4 w-4 text-slate-400" />}
              <h3 className={twMerge("font-ticket text-xs font-semibold uppercase tracking-[0.2em]", isEditing ? "text-orange-400" : "text-slate-400")}>
                {isEditing ? "Zettel bearbeiten" : "Handbestellung"}
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

          <Field label="Uhrzeit">
            <div className="flex flex-wrap items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500 shrink-0" />
              <input type="time" className={twMerge(inputCls, "w-auto")} value={form.time} onChange={set("time")} />
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["Jetzt", 0],
                  ["-30m", -30],
                  ["-1h", -60],
                  ["-2h", -120],
                  ["-3h", -180],
                ].map(([label, deltaMin]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      const base = deltaMin === 0 ? new Date() : new Date(`${date}T${form.time || nowHHMM()}:00`);
                      if (deltaMin !== 0) base.setMinutes(base.getMinutes() + deltaMin);
                      setForm((f) => ({ ...f, time: `${String(base.getHours()).padStart(2, "0")}:${String(base.getMinutes()).padStart(2, "0")}` }));
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 transition hover:bg-white/10"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Beschreibung">
              <input className={inputCls} placeholder="Mahlzeit…" value={form.description} onChange={set("description")} />
            </Field>
            <Field label="Gewicht (g)">
              <input type="number" min="0" className={twMerge(inputCls, "sm:w-28")} placeholder="optional" value={form.grams} onChange={setGrams} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["kcal", "kcal"], ["protein", "Prot g"], ["carbs", "Carb g"], ["fat", "Fett g"]].map(([k, lbl]) => (
              <Field key={k} label={lbl}>
                <input type="number" min="0" className={numCls} value={form[k]}
                  onChange={(e) => { setScanBaseline(null); set(k)(e); }} />
              </Field>
            ))}
          </div>
          {scanBaseline && (
            <p className="text-xs text-emerald-400">
              Scan-Referenz aktiv ({scanBaseline.grams}g) — Gewicht ändern skaliert die Makros automatisch mit.
            </p>
          )}
          {form.grams && !scanBaseline && (
            <p className="text-xs text-slate-500">
              Für Katalog+ gespeichert als {form.grams}g-Portion — beim erneuten Loggen aus dem Katalog später anpassbar.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <button onClick={() => saveMeal.mutate()} disabled={saveMeal.isPending || !form.description}
              className={twMerge("w-full rounded-2xl py-4 font-bold transition shadow-lg",
                saveMeal.isPending || !form.description
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-orange-400 text-slate-950 hover:bg-orange-300 active:scale-[0.98]"
              )}>
              {saveMeal.isPending ? "Speichert…" : isEditing ? "Änderungen speichern" : "Auf die Rail"}
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

        {/* Geloggte Mahlzeiten — Order-Rail: jeder Eintrag ein Ticket-Stub */}
        {meals.length > 0 && (
          <div className="relative rounded-2xl rounded-t-sm border border-white/10 bg-white/5 p-5 pt-6 backdrop-blur mt-6">
            <Grommets />
            <div className="ticket-perf -mx-5 mb-4" />
            <div className="mb-4 flex items-center justify-between">
              <div>
                <Kicker tone="text-slate-500">Rail · heute</Kicker>
                <h3 className="mt-0.5 font-display text-lg font-bold text-slate-100">
                  {meals.length} {meals.length === 1 ? "Ticket" : "Tickets"}
                </h3>
              </div>
              <div className="font-ticket text-xs text-slate-400 text-right">
                <span className="font-bold text-orange-300">{formatMetric(sumMetric(meals, "kcal"))} kcal</span>
                <div className="mt-0.5 space-x-2">
                  <span className="text-emerald-300">P {formatMetric(sumMetric(meals, "protein"))}g</span>
                  <span className="text-sky-300">C {formatMetric(sumMetric(meals, "carbs"))}g</span>
                  <span className="text-violet-300">F {formatMetric(sumMetric(meals, "fat"))}g</span>
                </div>
              </div>
            </div>
            <div className="space-y-2.5">
              {meals.map((m, idx) => (
                <div key={m.id}
                  style={{ animationDelay: `${Math.min(idx, 10) * 35}ms` }}
                  className={twMerge(
                    "animate-ticket-in flex items-center gap-3 rounded-xl border px-4 py-3 transition",
                    form.id === m.id
                      ? "border-orange-400/40 bg-orange-400/5"
                      : "border-white/5 bg-slate-900/40 hover:bg-slate-900/70"
                  )}>
                  <span className="shrink-0 -rotate-2 rounded border border-white/10 bg-slate-950/70 px-1.5 py-0.5 font-ticket text-[10px] text-slate-500">
                    {hhmmFromISO(m.time || m.logged_at)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="truncate font-medium text-slate-100">{m.description}</span>
                      <span className="h-px min-w-[10px] flex-1 border-t border-dashed border-white/15" aria-hidden />
                      <span className="shrink-0 font-ticket text-sm font-bold text-orange-300">{m.kcal}<span className="text-[10px] text-orange-300/60"> kcal</span></span>
                    </div>
                    <div className="mt-0.5 font-ticket text-[11px] text-slate-500">
                      {MEAL_LABEL[m.type] || m.type}
                      {" · "}P {m.protein}g · C {m.carbs}g · F {m.fat}g
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => repeatMeal.mutate(m)}
                      disabled={repeatMeal.isPending && repeatMeal.variables?.id === m.id}
                      title="Nochmal loggen"
                      className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 transition">
                      <CopyPlus className="h-3.5 w-3.5" />
                    </button>
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

      {/* Right Column: Journal-Seite */}
      <section className="space-y-6">
        <div>
          <Kicker tone="text-teal-700/70">Seite · {date}</Kicker>
          <div className="mt-1 flex items-center gap-3">
            <NotebookPen className="h-6 w-6 text-sky-300" />
            <h2 className="font-display text-3xl font-black italic tracking-tight text-paper-50">Tagebuch</h2>
          </div>
        </div>

        <form onSubmit={handleNotesSave} className="overflow-hidden rounded-2xl border border-paper-200/30 bg-paper-100 shadow-glow">
          <div className="flex items-center gap-3 border-b border-[#78481866]/20 bg-paper-50 px-5 py-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-700/15 to-teal-700/15 text-emerald-800">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <h2 className="font-display text-xl font-semibold italic text-stone-800">Notizen</h2>
          </div>
          <textarea
            className="paper-ruled min-h-[460px] w-full p-5 pt-2 font-display text-[17px] italic leading-[32px] text-stone-800 placeholder-stone-500/60 outline-none transition-all focus:bg-paper-50/60"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Was hat dich heute bewegt? Training, Schlaf, Befinden…"
          />
          <div className="space-y-2 bg-paper-50 p-5 pt-4">
            <button disabled={loading} className="w-full rounded-full bg-stone-800 py-4 font-bold text-paper-50 disabled:opacity-60 hover:bg-stone-700 transition-colors shadow-lg active:scale-[0.98]">
              {loading ? "Speichere..." : "Notizen speichern"}
            </button>

            {cloud && (
              <button
                type="button"
                onClick={handleJournalCheck}
                disabled={journalCheckLoading || !text.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-full border border-stone-800/15 bg-transparent py-3 text-sm font-semibold text-stone-700 hover:bg-stone-800/5 disabled:opacity-50 transition-colors"
              >
                <ScanSearch className="h-4 w-4" />
                {journalCheckLoading ? "Gleiche ab..." : "Mit Log abgleichen"}
              </button>
            )}
          </div>
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

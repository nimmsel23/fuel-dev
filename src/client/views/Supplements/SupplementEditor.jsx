import { useState } from "react";
import { X, Save, Trash2 } from "lucide-react";
import { postJson, deleteJson } from "@api";
import { Modal } from "../../components/ui.jsx";

const WEEKDAYS = [
  ["mon", "Mo"], ["tue", "Di"], ["wed", "Mi"], ["thu", "Do"],
  ["fri", "Fr"], ["sat", "Sa"], ["sun", "So"],
];

const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100";
const labelCls = "text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 block";

// Manuelles Add/Edit für den Supplement-Katalog — bisher gab es nur den
// AI-Weg (GeminiCatalogModal), der im Cloud-Build sogar ausgeblendet war,
// und keine Möglichkeit bestehende Einträge zu bearbeiten oder ein
// schedule zu setzen (Supplements/utils.js:isDueToday() existierte längst,
// aber item.schedule war nie gesetzt/editierbar — 2026-07-30 entdeckt).
export default function SupplementEditor({ item, onClose, onSaved }) {
  const isEdit = Boolean(item);
  const [name, setName] = useState(item?.name || "");
  const [unit, setUnit] = useState(item?.unit || "mg");
  const [defaultDose, setDefaultDose] = useState(item?.default_dose ?? "");
  const [timeOfDay, setTimeOfDay] = useState(item?.default_time_of_day || "any");
  const [scheduleType, setScheduleType] = useState(item?.schedule?.type || "daily");
  const [days, setDays] = useState(item?.schedule?.days || []);
  const [intervalDays, setIntervalDays] = useState(item?.schedule?.interval_days ?? 2);
  const [startDate, setStartDate] = useState(item?.schedule?.start_date || new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleDay(d) {
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const schedule =
        scheduleType === "weekly" ? { type: "weekly", days }
        : scheduleType === "cyclical" ? { type: "cyclical", interval_days: Number(intervalDays), start_date: startDate }
        : { type: "daily" };

      await postJson("/supplements/catalog", {
        id: item?.id,
        name: name.trim(),
        unit,
        default_dose: defaultDose === "" ? undefined : Number(defaultDose),
        default_time_of_day: timeOfDay,
        schedule,
      });
      onSaved();
    } catch (e) {
      setError(e.message || "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!item?.id) return;
    setSaving(true);
    try {
      await deleteJson(`/supplements/catalog/${item.id}`);
      onSaved();
    } catch (e) {
      setError(e.message || "Löschen fehlgeschlagen.");
      setSaving(false);
    }
  }

  return (
    <Modal
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title={isEdit ? "Supplement bearbeiten" : "Supplement manuell anlegen"}
      description="Name, Dosis und wann es fällig ist."
    >
      <div className="space-y-4">
        <div>
          <label className={labelCls}>Name</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. Magnesium" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Dosis</label>
            <input type="number" min="0" className={inputCls} value={defaultDose} onChange={(e) => setDefaultDose(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Einheit</label>
            <select className={inputCls} value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="mg">mg</option>
              <option value="g">g</option>
              <option value="ml">ml</option>
              <option value="IU">IU</option>
              <option value="µg">µg</option>
              <option value="Stk">Stk</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Tageszeit</label>
          <select className={inputCls} value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value)}>
            <option value="morning">Morgens</option>
            <option value="midday">Mittags</option>
            <option value="evening">Abends</option>
            <option value="night">Nachts</option>
            <option value="any">Egal</option>
          </select>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
          <label className={labelCls}>Rhythmus (für Habit-Tracking)</label>
          <select className={inputCls} value={scheduleType} onChange={(e) => setScheduleType(e.target.value)}>
            <option value="daily">Täglich</option>
            <option value="weekly">Bestimmte Wochentage</option>
            <option value="cyclical">Alle X Tage</option>
          </select>

          {scheduleType === "weekly" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {WEEKDAYS.map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => toggleDay(val)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    days.includes(val) ? "bg-violet-400 text-slate-950" : "bg-white/5 text-slate-400 hover:bg-white/10"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          )}

          {scheduleType === "cyclical" && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Alle X Tage</label>
                <input type="number" min="1" className={inputCls} value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Startdatum</label>
                <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <div className="flex gap-3">
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="flex items-center justify-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-white/10 py-3 text-sm text-slate-300 hover:bg-white/5"
          >
            <X className="mr-1 inline h-4 w-4" /> Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="flex-1 rounded-2xl bg-violet-400 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
          >
            <Save className="mr-1 inline h-4 w-4" /> {saving ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

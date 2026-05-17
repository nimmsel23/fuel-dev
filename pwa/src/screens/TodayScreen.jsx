import { useState } from "react";
import { useDocumentData } from "react-firebase-hooks/firestore";
import { doc } from "firebase/firestore";
import { db } from "../firebase.js";
import { addMeal, setWater } from "../db.js";

const UID = "default";
const MEAL_TYPES = ["Frühstück", "Mittagessen", "Abendessen", "Snack"];
const WATER_GOAL = 2500;

function MacroGrid({ meals }) {
  const totals = meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + (m.kcal || 0),
      protein: acc.protein + (m.protein || 0),
      carbs: acc.carbs + (m.carbs || 0),
      fat: acc.fat + (m.fat || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
  return (
    <div className="macro-row">
      {[
        { lbl: "kcal", val: Math.round(totals.kcal) },
        { lbl: "Protein", val: `${Math.round(totals.protein)}g` },
        { lbl: "Carbs", val: `${Math.round(totals.carbs)}g` },
        { lbl: "Fett", val: `${Math.round(totals.fat)}g` },
      ].map(({ lbl, val }) => (
        <div key={lbl} className="macro-cell">
          <div className="val">{val}</div>
          <div className="lbl">{lbl}</div>
        </div>
      ))}
    </div>
  );
}

function AddMealForm({ date, onDone }) {
  const [form, setForm] = useState({ type: "Frühstück", description: "", kcal: "", protein: "", carbs: "", fat: "" });
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!form.description) return;
    setSaving(true);
    await addMeal(date, form);
    setForm({ type: "Frühstück", description: "", kcal: "", protein: "", carbs: "", fat: "" });
    setSaving(false);
    onDone?.();
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form onSubmit={submit} style={{ marginTop: "0.75rem" }}>
      <div className="form-row">
        <label>Mahlzeit</label>
        <select value={form.type} onChange={set("type")}>
          {MEAL_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>Beschreibung</label>
        <input value={form.description} onChange={set("description")} placeholder="z.B. Haferflocken mit Beeren" required />
      </div>
      <div className="form-grid" style={{ marginBottom: "0.75rem" }}>
        {["kcal", "protein", "carbs", "fat"].map((k) => (
          <input key={k} type="number" min="0" placeholder={k} value={form[k]} onChange={set(k)} />
        ))}
      </div>
      <button type="submit" disabled={saving}>
        {saving ? "…" : "Speichern"}
      </button>
    </form>
  );
}

export default function TodayScreen({ date }) {
  const [log, loading] = useDocumentData(doc(db, "nutrition", UID, "logs", date));
  const [showForm, setShowForm] = useState(false);
  const [waterInput, setWaterInput] = useState("");

  const meals = log?.meals || [];
  const water = log?.water_ml || 0;
  const waterPct = Math.min(100, (water / WATER_GOAL) * 100);

  async function handleWater(e) {
    e.preventDefault();
    const ml = Number(waterInput);
    if (!ml) return;
    await setWater(date, water + ml);
    setWaterInput("");
  }

  return (
    <div className="screen">
      <header>
        <h1>{date === new Date().toISOString().slice(0, 10) ? "Heute" : date}</h1>
      </header>

      <MacroGrid meals={meals} />

      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <h2>Mahlzeiten</h2>
        {loading && <p className="loading">Lade…</p>}
        {!loading && meals.length === 0 && <p className="empty">Noch nichts eingetragen</p>}
        {meals.map((m) => (
          <div key={m.id} className="meal-item">
            <div>
              <div className="meal-name">{m.description}</div>
              <div className="meal-sub">{m.type} · {m.kcal} kcal · P {m.protein}g</div>
            </div>
          </div>
        ))}
        <button onClick={() => setShowForm((s) => !s)} style={{ marginTop: "0.75rem", width: "100%" }}>
          {showForm ? "Abbrechen" : "+ Mahlzeit"}
        </button>
        {showForm && <AddMealForm date={date} onDone={() => setShowForm(false)} />}
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h2>Wasser · {water} / {WATER_GOAL} ml</h2>
        <div className="water-bar">
          <div className="water-fill" style={{ width: `${waterPct}%` }} />
        </div>
        <form onSubmit={handleWater} style={{ display: "flex", gap: "0.5rem" }}>
          <input type="number" min="0" placeholder="ml trinken" value={waterInput} onChange={(e) => setWaterInput(e.target.value)} />
          <button type="submit" style={{ flexShrink: 0 }}>+</button>
        </form>
      </div>
    </div>
  );
}

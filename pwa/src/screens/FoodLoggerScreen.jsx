import { useState, useRef, useCallback } from "react";
import { Search, ArrowLeft } from "lucide-react";
import { addMeal } from "../db.js";

const PORTIONS = [
  { key: "s",  label: "S",  grams: 100 },
  { key: "m",  label: "M",  grams: 200 },
  { key: "l",  label: "L",  grams: 300 },
  { key: "xl", label: "XL", grams: 450 },
];

const MEAL_TYPES = ["Frühstück", "Mittagessen", "Abendessen", "Snack"];

function scale(per100, grams) {
  return Math.round((Number(per100) / 100) * grams);
}

function useDebouncedSearch() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  const search = useCallback((q) => {
    clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/nutrition/search?q=${encodeURIComponent(q)}&limit=20`);
        if (res.ok) setResults((await res.json()).results || []);
      } catch (_) {}
      setLoading(false);
    }, 400);
  }, []);

  return { results, loading, search };
}

// ── Suchergebnis-Zeile ─────────────────────────────────────────────────────────

function FoodResultRow({ food, onSelect }) {
  return (
    <button
      onClick={() => onSelect(food)}
      style={{
        width: "100%",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--border)",
        padding: "0.7rem 0",
        textAlign: "left",
        cursor: "pointer",
        color: "var(--text)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>{food.name}</div>
        {food.brand && (
          <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>{food.brand}</div>
        )}
        <div style={{ fontSize: "0.7rem", color: "var(--muted)", marginTop: "2px" }}>
          {food.kcal_100} kcal · P {food.protein_100}g · C {food.carbs_100}g · F {food.fat_100}g
          <span style={{ marginLeft: "0.3rem", opacity: 0.6 }}>/ 100g</span>
        </div>
      </div>
      <span style={{ fontSize: "1.1rem", color: "var(--accent)", marginLeft: "0.5rem" }}>›</span>
    </button>
  );
}

// ── Detail-Formular (eigene Page) ──────────────────────────────────────────────

function FoodDetailPage({ food, date, onBack, onSaved }) {
  const [portion, setPortion] = useState("m");
  const [mealType, setMealType] = useState("Frühstück");
  const [saving, setSaving] = useState(false);

  const grams = PORTIONS.find((p) => p.key === portion)?.grams ?? 200;

  const [form, setForm] = useState({
    description: food.name,
    notes: food.brand || "",
    kcal: scale(food.kcal_100, grams),
    protein: scale(food.protein_100, grams),
    carbs: scale(food.carbs_100, grams),
    fat: scale(food.fat_100, grams),
  });

  function applyPortion(key) {
    setPortion(key);
    const g = PORTIONS.find((p) => p.key === key)?.grams ?? 200;
    setForm((f) => ({
      ...f,
      kcal:    scale(food.kcal_100, g),
      protein: scale(food.protein_100, g),
      carbs:   scale(food.carbs_100, g),
      fat:     scale(food.fat_100, g),
    }));
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setSaving(true);
    await addMeal(date, { type: mealType, ...form });
    setSaving(false);
    onSaved?.();
    onBack();
  }

  return (
    <div className="screen">
      <header>
        <button className="ghost" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "0.25rem 0.5rem" }}>
          <ArrowLeft size={16} /> Zurück
        </button>
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{date}</span>
      </header>

      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <h2 style={{ marginBottom: "0.25rem" }}>{food.name}</h2>
        {food.brand && <p style={{ fontSize: "0.75rem", color: "var(--muted)", marginBottom: "0.75rem" }}>{food.brand}</p>}

        {/* Portion */}
        <div className="form-row">
          <label>Portion</label>
          <div style={{ display: "flex", gap: "6px" }}>
            {PORTIONS.map((p) => (
              <button
                key={p.key}
                className={portion === p.key ? "" : "ghost"}
                onClick={() => applyPortion(p.key)}
                style={{ flex: 1, flexDirection: "column", fontSize: "0.75rem", padding: "0.4rem 0" }}
              >
                <span>{p.label}</span>
                <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>{p.grams}g</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mahlzeit */}
        <div className="form-row">
          <label>Mahlzeit</label>
          <select value={mealType} onChange={(e) => setMealType(e.target.value)}>
            {MEAL_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Editierbare Makros */}
      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <h2>Makros (editierbar)</h2>
        <div className="form-grid" style={{ marginBottom: "0.5rem" }}>
          {[
            { k: "kcal", lbl: "kcal" },
            { k: "protein", lbl: "Protein g" },
            { k: "carbs", lbl: "Carbs g" },
            { k: "fat", lbl: "Fett g" },
          ].map(({ k, lbl }) => (
            <div key={k}>
              <label style={{ fontSize: "0.65rem", color: "var(--muted)", display: "block", marginBottom: "2px" }}>{lbl}</label>
              <input type="number" min="0" value={form[k]} onChange={set(k)} />
            </div>
          ))}
        </div>

        <div className="form-row">
          <label>Beschreibung</label>
          <input value={form.description} onChange={set("description")} />
        </div>
        <div className="form-row">
          <label>Notiz</label>
          <input value={form.notes} onChange={set("notes")} placeholder="optional" />
        </div>
      </div>

      <button onClick={save} disabled={saving} style={{ width: "100%", padding: "0.75rem" }}>
        {saving ? "…" : `Loggen → ${date}`}
      </button>
    </div>
  );
}

// ── Haupt-Screen ───────────────────────────────────────────────────────────────

export default function FoodLoggerScreen({ date }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const { results, loading, search } = useDebouncedSearch();

  function handleInput(e) {
    setQuery(e.target.value);
    search(e.target.value);
  }

  if (selected) {
    return (
      <FoodDetailPage
        food={selected}
        date={date}
        onBack={() => setSelected(null)}
        onSaved={() => setQuery("")}
      />
    );
  }

  return (
    <div className="screen">
      <header><h1>Food Logger</h1></header>

      <div style={{ position: "relative", marginBottom: "0.75rem" }}>
        <Search size={15} style={{
          position: "absolute", left: "0.6rem", top: "50%",
          transform: "translateY(-50%)", color: "var(--muted)",
        }} />
        <input
          value={query}
          onChange={handleInput}
          placeholder="Lebensmittel suchen…"
          style={{ paddingLeft: "2rem" }}
          autoFocus
        />
      </div>

      {loading && <p className="loading">Suche…</p>}
      {!loading && query && results.length === 0 && (
        <p className="empty">Keine Treffer für „{query}"</p>
      )}
      {!loading && !query && (
        <p className="empty">Suchbegriff eingeben (Open Food Facts)</p>
      )}

      {results.map((food, i) => (
        <FoodResultRow key={i} food={food} onSelect={setSelected} />
      ))}
    </div>
  );
}

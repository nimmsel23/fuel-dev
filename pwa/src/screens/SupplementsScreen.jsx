import { useState } from "react";
import { useDocumentData } from "react-firebase-hooks/firestore";
import { doc } from "firebase/firestore";
import { db } from "../firebase.js";
import { getSupplementsCatalog, addSupplementIntake, removeSupplementIntake } from "../db.js";

const UID = "default";
function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function SupplementsScreen() {
  const date = todayISO();
  const [log, loading] = useDocumentData(doc(db, "supplements", UID, "logs", date));
  const [catalog, setCatalog] = useState(null);
  const [loadingCat, setLoadingCat] = useState(false);

  const intakes = log?.intakes || [];

  async function loadCatalog() {
    setLoadingCat(true);
    const items = await getSupplementsCatalog();
    setCatalog(items);
    setLoadingCat(false);
  }

  async function take(item) {
    await addSupplementIntake(date, {
      supplement_id: item.id,
      name: item.name,
      dose: item.default_dose,
      unit: item.unit,
      time_of_day: item.default_time_of_day,
    });
  }

  async function remove(intake) {
    await removeSupplementIntake(date, intake);
  }

  const takenIds = new Set(intakes.map((i) => i.supplement_id));

  return (
    <div className="screen">
      <header><h1>Supplements</h1></header>

      <div className="card" style={{ marginBottom: "0.75rem" }}>
        <h2>Heute eingenommen</h2>
        {loading && <p className="loading">Lade…</p>}
        {!loading && intakes.length === 0 && <p className="empty">Noch nichts eingenommen</p>}
        {intakes.map((s) => (
          <div key={s.id} className="supp-item">
            <div>
              <span style={{ fontWeight: 600 }}>{s.name}</span>
              <span style={{ color: "var(--muted)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                {s.dose} {s.unit} · {s.time_of_day}
              </span>
            </div>
            <button className="ghost" style={{ padding: "0.25rem 0.5rem" }} onClick={() => remove(s)}>✕</button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Katalog</h2>
        {!catalog && (
          <button onClick={loadCatalog} disabled={loadingCat} style={{ width: "100%" }}>
            {loadingCat ? "Lade…" : "Katalog laden"}
          </button>
        )}
        {catalog && catalog.map((item) => (
          <div key={item.id} className="supp-item">
            <div>
              <span style={{ fontWeight: 600 }}>{item.name}</span>
              <span style={{ color: "var(--muted)", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                {item.default_dose} {item.unit} · {item.default_time_of_day}
              </span>
            </div>
            <button
              onClick={() => take(item)}
              disabled={takenIds.has(item.id)}
              style={takenIds.has(item.id) ? { opacity: 0.4 } : {}}
            >
              {takenIds.has(item.id) ? "✓" : "Nehmen"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

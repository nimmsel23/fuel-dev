import { useState, useEffect } from "react";
import { Utensils, Search, Pill, BookOpen, LogIn, LogOut, User } from "lucide-react";
import { watchAuth, signIn, signOut } from "./db.js";
import NutritionHeatmap from "./components/NutritionHeatmap.jsx";
import TodayScreen from "./screens/TodayScreen.jsx";
import FoodLoggerScreen from "./screens/FoodLoggerScreen.jsx";
import SupplementsScreen from "./screens/SupplementsScreen.jsx";
import JournalScreen from "./screens/JournalScreen.jsx";

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TABS = [
  { id: "today",   label: "Heute",   Icon: Utensils },
  { id: "food",    label: "Food",    Icon: Search   },
  { id: "supps",   label: "Supps",   Icon: Pill     },
  { id: "journal", label: "Journal", Icon: BookOpen },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("today");
  const [selectedDate, setSelectedDate] = useState(localToday);

  useEffect(() => {
    return watchAuth((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="loading">Lade Fuel...</div>;

  if (!user) return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <h1>Fuel PWA</h1>
      <button className="btn" onClick={signIn}><LogIn size={18} /> Mit Google anmelden</button>
    </div>
  );

  return (
    <>
      <header style={{ padding: "0.5rem 1rem", background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>{selectedDate}</span>
          <button className="ghost" onClick={signOut} style={{ padding: "4px 8px" }}><LogOut size={14} /></button>
        </div>
      </header>

      <NutritionHeatmap selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      <div className="screen">
        {tab === "today"   && <TodayScreen   date={selectedDate} />}
        {tab === "food"    && <FoodLoggerScreen date={selectedDate} />}
        {tab === "supps"   && <SupplementsScreen />}
        {tab === "journal" && <JournalScreen date={selectedDate} />}
      </div>

      <nav className="tab-bar">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            <Icon size={20} />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}

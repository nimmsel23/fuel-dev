import { useState } from "react";
import { Utensils, Search, Pill, BookOpen, Wifi, WifiOff } from "lucide-react";
import { useOnlineStatus } from "./hooks/useOnlineStatus.js";
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
  const [tab, setTab] = useState("today");
  const [selectedDate, setSelectedDate] = useState(localToday);
  const online = useOnlineStatus();

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 1rem 0", background: "var(--bg)" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          {selectedDate}
        </span>
        <span className={`badge ${online ? "online" : "offline"}`}>
          {online ? <Wifi size={11} /> : <WifiOff size={11} />}
          {online ? "Online" : "Offline"}
        </span>
      </div>

      <NutritionHeatmap selectedDate={selectedDate} onSelectDate={setSelectedDate} />

      {tab === "today"   && <TodayScreen   date={selectedDate} />}
      {tab === "food"    && <FoodLoggerScreen date={selectedDate} />}
      {tab === "supps"   && <SupplementsScreen />}
      {tab === "journal" && <JournalScreen date={selectedDate} />}

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

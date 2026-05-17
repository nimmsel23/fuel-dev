import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase.js";

const UID = "default";

function toLocalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function weekDates(anchor = new Date()) {
  const d = new Date(anchor);
  const dow = (d.getDay() + 6) % 7; // Mo=0
  d.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    return toLocalISO(day);
  });
}

export function useWeekLogs(anchorDate) {
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dates = weekDates(anchorDate ? new Date(anchorDate) : new Date());
    setLoading(true);
    const q = query(
      collection(db, "nutrition", UID, "logs"),
      where("date", "in", dates),
    );
    getDocs(q).then((snap) => {
      const map = {};
      snap.forEach((d) => { map[d.id] = d.data(); });
      setLogs(map);
      setLoading(false);
    });
  }, [anchorDate]);

  return { logs, loading, dates: weekDates(anchorDate ? new Date(anchorDate) : new Date()) };
}

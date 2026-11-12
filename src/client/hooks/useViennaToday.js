import { useEffect, useState } from "react";
import { calendarDay, msUntilNextCalendarDay, rollActiveDate } from "../lib/calendarDay.js";
import { useApp } from "../store.js";

function watchCalendarDay(onDay) {
  let today = calendarDay();
  let timer = 0;
  const sync = () => {
    const next = calendarDay();
    if (next !== today) {
      const previous = today;
      today = next;
      onDay(next, previous);
    }
    window.clearTimeout(timer);
    timer = window.setTimeout(sync, msUntilNextCalendarDay());
  };
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pageshow", sync);
  window.addEventListener("focus", sync);
  timer = window.setTimeout(sync, msUntilNextCalendarDay());
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", sync);
    window.removeEventListener("pageshow", sync);
    window.removeEventListener("focus", sync);
  };
}

export function useViennaDate() {
  const [day, setDay] = useState(() => calendarDay());
  useEffect(() => watchCalendarDay((next) => setDay(next)), []);
  return day;
}

// Hält das ausgewählte Datum auf dem Wiener Tag, solange die App auf „heute" steht
// (iOS-PWA und Android bleiben über Mitternacht oft im Speicher).
export function useFollowViennaToday() {
  const setActiveDate = useApp((state) => state.setActiveDate);
  useEffect(() => watchCalendarDay((next, previous) => {
    const activeDate = useApp.getState().activeDate;
    const rolled = rollActiveDate(activeDate, previous, next);
    if (rolled !== activeDate) setActiveDate(rolled);
  }), [setActiveDate]);
}

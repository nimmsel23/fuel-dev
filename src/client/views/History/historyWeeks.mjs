import { calendarDay, daysBetween, isoWeekOf, shiftCalendarDay, weekDates } from "../../lib/calendarDay.js";

export function historyToday(now = new Date()) {
  return calendarDay(now);
}

export function buildWeekGroups(today, history) {
  const daysByDate = Object.fromEntries((history || []).filter((day) => day?.date).map((day) => [day.date, day]));
  const dates = Object.keys(daysByDate).filter((date) => date <= today).sort().reverse();
  if (dates.length === 0) return [];

  const thisMonday = weekDates(today)[0];
  if (!thisMonday) return [];
  const oldest = dates[dates.length - 1];
  const span = Math.max(0, daysBetween(oldest, today));
  const weekCount = Math.max(8, Math.ceil(span / 7) + 1);

  return Array.from({ length: weekCount }, (_, w) => {
    const monday = shiftCalendarDay(thisMonday, -w * 7);
    const allDays = weekDates(monday).filter((day) => day <= today).reverse();
    const visibleDays = allDays.filter((day) => daysByDate[day]);
    if (visibleDays.length === 0) return null;

    const { year, week } = isoWeekOf(monday);
    const label = w === 0 ? "Diese Woche" : w === 1 ? "Letzte Woche" : `KW ${week} · ${year}`;

    return {
      label,
      visibleDays,
      entries: visibleDays.map((date) => daysByDate[date]).filter(Boolean),
    };
  }).filter(Boolean);
}

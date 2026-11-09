import { formatLocalDate, parseLocalNoon, todayISO } from "#shared/utils/validation.mjs";

export function historyToday() {
  return todayISO();
}

export function buildWeekGroups(today, history) {
  const daysByDate = Object.fromEntries((history || []).map((day) => [day.date, day]));
  const dates = Object.keys(daysByDate).filter((date) => date <= today).sort().reverse();
  if (dates.length === 0) return [];

  const todayObj = parseLocalNoon(today);
  const dow0 = todayObj.getDay();
  const thisMonday = new Date(todayObj);
  thisMonday.setDate(todayObj.getDate() - (dow0 === 0 ? 6 : dow0 - 1));

  const oldest = dates[dates.length - 1];
  const span = Math.max(0, Math.round((todayObj - parseLocalNoon(oldest)) / 86400000));
  const weekCount = Math.max(8, Math.ceil(span / 7) + 1);

  return Array.from({ length: weekCount }, (_, w) => {
    const monday = new Date(thisMonday);
    monday.setDate(thisMonday.getDate() - w * 7);

    const allDays = Array.from({ length: 7 }, (_, i) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      return formatLocalDate(day);
    }).filter((day) => day <= today).reverse();

    const visibleDays = allDays.filter((day) => daysByDate[day]);
    if (visibleDays.length === 0) return null;

    const jan4 = new Date(monday.getFullYear(), 0, 4, 12, 0, 0, 0);
    const kw = Math.max(1, Math.floor(((monday - jan4) / 86400000 + jan4.getDay() + 1) / 7));
    const label = w === 0 ? "Diese Woche" : w === 1 ? "Letzte Woche" : `KW ${kw} · ${monday.getFullYear()}`;

    return {
      label,
      visibleDays,
      entries: visibleDays.map((date) => daysByDate[date]).filter(Boolean),
    };
  }).filter(Boolean);
}

const DAY_MS = 86400000;
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const TIME_LABELS = { morning: "Morgens", midday: "Mittags", evening: "Abends", night: "Nachts", any: "Flexibel" };

function calendarDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
}

export function isDueToday(item, dateString) {
  const day = calendarDay(dateString);
  if (!Number.isFinite(day) || !item.schedule) return false;
  const schedule = item.schedule;
  if (schedule.type === "daily") return true;
  if (schedule.type === "weekly") return Boolean(schedule.days?.includes(WEEKDAYS[new Date(day).getUTCDay()]));
  if (schedule.type === "cyclical") {
    const start = calendarDay(schedule.start_date);
    const interval = Number(schedule.interval_days);
    const diff = (day - start) / DAY_MS;
    return Number.isInteger(interval) && interval > 0 && diff >= 0 && diff % interval === 0;
  }
  return false;
}

export function routineProgress(catalog, intakes, date) {
  const due = catalog.filter(item => isDueToday(item, date));
  const taken = new Set(intakes.map(intake => intake.supplement_id));
  const completed = due.filter(item => taken.has(item.id)).length;
  return { due, completed, remaining: due.length - completed, percent: due.length ? Math.round(completed / due.length * 100) : 0 };
}

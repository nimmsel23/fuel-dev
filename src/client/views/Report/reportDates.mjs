// Calendar dates are local dates, not UTC timestamps.
export function localISO(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function shiftISO(iso, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime()) || localISO(date) !== iso) return "";
  date.setDate(date.getDate() + days);
  return localISO(date);
}

export function reportDates(from, to, maxDays = 400) {
  if (!shiftISO(from, 0) || !shiftISO(to, 0) || from > to) return null;
  const dates = [];
  for (let date = from; date <= to; date = shiftISO(date, 1)) {
    if (dates.length >= maxDays) return null;
    dates.push(date);
  }
  return dates;
}

export async function loadReportDays(dates, fetchDay) {
  const logs = {};
  // Bound concurrency for longer reports and preserve the first failure.
  for (let i = 0; i < dates.length; i += 10) {
    const batch = dates.slice(i, i + 10);
    const values = await Promise.all(batch.map(fetchDay));
    batch.forEach((date, index) => { logs[date] = values[index]; });
  }
  return logs;
}

export function hasReportEntries(log) {
  return (Array.isArray(log?.meals) && log.meals.length > 0) || Number(log?.water_ml) > 0;
}

export function reportMealAmount(meal) {
  const grams = Number(meal?.grams);
  return Number.isFinite(grams) && grams > 0 ? `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(grams)} g` : "";
}

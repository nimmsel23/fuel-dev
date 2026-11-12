// Kalendertage der Ernährung sind Europe/Vienna, nicht die UTC-Uhr.
// toISOString() auf lokale Mitternacht liegt in Wien im Vortag (CET 00:00–01:00,
// CEST 00:00–02:00). Wochen und „heute" rechnen deshalb über das Wiener Datum
// und über UTC-Mittag, damit Sommerzeit keinen Tag verschiebt.

export const CALENDAR_TIME_ZONE = "Europe/Vienna";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function calendarDay(now = new Date(), timeZone = CALENDAR_TIME_ZONE) {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  if (ISO_DAY.test(formatted)) return formatted;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function utcNoon(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function isoFromUTC(date) {
  return date.toISOString().slice(0, 10);
}

export function shiftCalendarDay(iso, days) {
  if (!ISO_DAY.test(iso) || !Number.isFinite(days)) return "";
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  if (Number.isNaN(date.getTime())) return "";
  const shifted = isoFromUTC(date);
  return ISO_DAY.test(shifted) ? shifted : "";
}

export function daysBetween(fromISO, toISO) {
  if (!ISO_DAY.test(fromISO) || !ISO_DAY.test(toISO)) return 0;
  return Math.round((utcNoon(toISO) - utcNoon(fromISO)) / 86400000);
}

// Montag–Sonntag der ISO-Woche, die anchor enthält. Unabhängig von der Gerätezone.
export function weekDates(anchor) {
  if (!ISO_DAY.test(String(anchor || ""))) return [];
  const noon = utcNoon(anchor);
  if (isoFromUTC(noon) !== anchor) return [];
  const mondayOffset = (noon.getUTCDay() + 6) % 7;
  noon.setUTCDate(noon.getUTCDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(noon);
    day.setUTCDate(noon.getUTCDate() + index);
    return isoFromUTC(day);
  });
}

export function isoWeekOf(iso) {
  const dates = weekDates(iso);
  if (dates.length !== 7) return { year: NaN, week: NaN };
  const thursday = dates[3];
  const isoYear = Number(thursday.slice(0, 4));
  const week1Monday = weekDates(`${isoYear}-01-04`)[0];
  const week = 1 + Math.round(daysBetween(week1Monday, dates[0]) / 7);
  return { year: isoYear, week };
}

export function datesOfISOWeek(year, week) {
  const isoYear = Number(year);
  const isoWeek = Number(week);
  if (!Number.isInteger(isoYear) || !Number.isInteger(isoWeek) || isoWeek < 1 || isoWeek > 53) return [];
  const week1Monday = weekDates(`${isoYear}-01-04`)[0];
  if (!week1Monday) return [];
  const monday = shiftCalendarDay(week1Monday, (isoWeek - 1) * 7);
  const dates = weekDates(monday);
  const check = isoWeekOf(dates[0]);
  if (check.year !== isoYear || check.week !== isoWeek) return [];
  return dates;
}

export function sumMealMetric(meals, key) {
  const total = (meals || []).reduce((sum, meal) => {
    const value = Number(meal?.[key]);
    return Number.isFinite(value) && value >= 0 ? sum + value : sum;
  }, 0);
  return Math.round(total * 10) / 10;
}

export function aggregateWeek(anchor, logsByDate = {}) {
  const dates = weekDates(anchor);
  const days = dates.map((date) => {
    const log = logsByDate[date] || {};
    const meals = Array.isArray(log.meals) ? log.meals : [];
    const water = Number(log.water_ml);
    const water_ml = Number.isFinite(water) && water > 0 ? Math.round(water) : 0;
    return {
      date,
      meals,
      kcal: sumMealMetric(meals, "kcal"),
      protein: sumMealMetric(meals, "protein"),
      carbs: sumMealMetric(meals, "carbs"),
      fat: sumMealMetric(meals, "fat"),
      water_ml,
      hasMeals: meals.length > 0,
      waterOnly: meals.length === 0 && water_ml > 0,
      visible: meals.length > 0 || water_ml > 0,
    };
  });
  const totals = days.reduce((sum, day) => ({
    kcal: Math.round((sum.kcal + day.kcal) * 10) / 10,
    protein: Math.round((sum.protein + day.protein) * 10) / 10,
    carbs: Math.round((sum.carbs + day.carbs) * 10) / 10,
    fat: Math.round((sum.fat + day.fat) * 10) / 10,
    water_ml: sum.water_ml + day.water_ml,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0, water_ml: 0 });
  return { dates, days, totals };
}

// Folgt „heute" nur, wenn der Nutzer den bisherigen heutigen Tag noch ausgewählt hat.
export function rollActiveDate(activeDate, previousToday, nextToday) {
  if (!nextToday || nextToday === previousToday) return activeDate;
  return activeDate === previousToday ? nextToday : activeDate;
}

export function msUntilNextCalendarDay(now = new Date(), timeZone = CALENDAR_TIME_ZONE) {
  const today = calendarDay(now, timeZone);
  let lo = now.getTime();
  let hi = lo + 26 * 60 * 60 * 1000;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (calendarDay(new Date(mid), timeZone) === today) lo = mid;
    else hi = mid;
  }
  return Math.max(1000, hi - now.getTime() + 50);
}

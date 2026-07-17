export function isDueToday(item, dateString) {
  if (!item.schedule) return false;
  const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  if (item.schedule.type === "daily") return true;
  
  const dateObj = new Date(dateString);
  if (item.schedule.type === "weekly") {
    const dayName = WEEKDAYS[dateObj.getDay()];
    return item.schedule.days?.includes(dayName);
  }
  
  if (item.schedule.type === "cyclical") {
    if (!item.schedule.start_date || !item.schedule.interval_days) return false;
    const start = new Date(item.schedule.start_date);
    const diffTime = Math.abs(dateObj - start);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays % item.schedule.interval_days === 0;
  }
  
  return false;
}

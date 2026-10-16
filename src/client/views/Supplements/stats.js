// Count days, rather than individual doses, within the selected calendar window.
export function summarizeSupplementLogs(catalog, logs, dates, today) {
  const stats = new Map(catalog.map(item => [item.id, { supplement: item, days_taken: 0, current_streak: 0 }]));
  for (const date of dates) {
    const daily = new Map((logs[date]?.intakes || []).map(item => [item.supplement_id, item]));
    for (const [id, intake] of daily) {
      if (!stats.has(id)) stats.set(id, { supplement: { id, name: intake.name || id }, days_taken: 0, current_streak: 0 });
      stats.get(id).days_taken += 1;
    }
  }
  for (const [id, row] of stats) {
    for (const date of dates) {
      if ((logs[date]?.intakes || []).some(item => item.supplement_id === id)) row.current_streak += 1;
      else if (date !== today) break;
    }
  }
  return [...stats.values()];
}

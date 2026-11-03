export function dayNutrientSummary(entries, key) {
  const list = Array.isArray(entries) ? entries : [];
  const contributions = list.map((entry) => {
    const raw = entry.micros?.[key];
    const valid = raw != null && !(typeof raw === 'string' && !raw.trim()) && Number.isFinite(Number(raw)) && Number(raw) >= 0;
    return { ...entry, value: valid ? Number(raw) : null };
  });
  const known = contributions.filter((entry) => entry.value != null);
  return {
    contributions,
    known: known.length,
    total: list.length,
    coverage: !known.length ? 'unknown' : known.length === list.length ? 'complete' : 'partial',
    value: known.length ? Math.round(known.reduce((sum, entry) => sum + entry.value, 0) * 10) / 10 : null,
  };
}

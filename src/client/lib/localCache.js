const PREFIX = "fuel:cache:";

export function readCache(key, maxAgeMs = Infinity) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { value, savedAt } = JSON.parse(raw);
    if (Date.now() - savedAt > maxAgeMs) return null;
    return value;
  } catch {
    return null;
  }
}

export function writeCache(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ value, savedAt: Date.now() }));
  } catch {
    // Storage voll/deaktiviert — Cache ist nur Komfort, kein Fehler wert.
  }
}

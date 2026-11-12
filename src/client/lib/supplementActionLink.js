// Deep-Link aus der Notification, wenn der Service Worker kein ID-Token hat
// oder die Cloud Function 401 antwortet. Hash: #supplements/{date}/{action}/{ids}
const STORAGE_KEY = "fuel-supplement-action";
const ACTIONS = new Set(["quick-yes", "snooze"]);
const SNOOZE_MS = 30 * 60 * 1000;

let inflight = null;

function isDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function buildSupplementActionHash(action, date, supplementIds) {
  const ids = (supplementIds || []).filter(Boolean).map((id) => encodeURIComponent(id)).join(",");
  return `#supplements/${date}/${action}/${ids}`;
}

export function parseSupplementActionHash(hash) {
  const raw = String(hash || "").replace(/^#\/?/, "");
  const [tab, date, action, idsPart = ""] = raw.split("/");
  if (tab !== "supplements" || !isDate(date) || !ACTIONS.has(action)) return null;
  const supplementIds = [];
  for (const part of idsPart.split(",")) {
    if (!part) continue;
    try {
      const id = decodeURIComponent(part).trim();
      if (id && !supplementIds.includes(id)) supplementIds.push(id);
    } catch {
      return null;
    }
  }
  if (!supplementIds.length) return null;
  return normalizeSupplementAction({ action, date, supplementIds });
}

export function normalizeSupplementAction(action) {
  if (!action || !ACTIONS.has(action.action) || !isDate(action.date)) return null;
  const source = action.supplementIds || action.ids || [];
  const supplementIds = [];
  for (const value of source) {
    const id = typeof value === "string" ? value.trim() : "";
    if (id && !supplementIds.includes(id)) supplementIds.push(id);
  }
  if (!supplementIds.length) return null;
  return {
    action: action.action,
    date: action.date,
    supplementIds,
    key: `${action.action}:${action.date}:${supplementIds.join(",")}`,
  };
}

function store() {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage;
}

export function readPendingSupplementAction() {
  const memory = store();
  if (!memory) return null;
  const raw = memory.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeSupplementAction(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function rememberSupplementAction(action) {
  const normalized = normalizeSupplementAction(action);
  const memory = store();
  if (!normalized || !memory) return normalized;
  const existing = readPendingSupplementAction();
  if (existing?.key === normalized.key) return existing;
  memory.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function captureSupplementActionFromLocation() {
  if (typeof window === "undefined") return readPendingSupplementAction();
  const parsed = parseSupplementActionHash(window.location.hash);
  if (!parsed) return readPendingSupplementAction();
  return rememberSupplementAction(parsed);
}

export function clearSupplementActionLink() {
  store()?.removeItem(STORAGE_KEY);
  if (typeof window === "undefined" || !window.location) return;
  const parsed = parseSupplementActionHash(window.location.hash);
  if (!parsed || !window.history?.replaceState) return;
  const url = new URL(window.location.href);
  url.hash = `supplements/${parsed.date}`;
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function intakeIdFor(date, supplementId) {
  return `action_${date}_${supplementId}`;
}

export function planQuickYes(supplementIds, intakes, catalog, date) {
  const logged = new Set((intakes || []).map((item) => item.supplement_id));
  const present = new Set((intakes || []).map((item) => item.id));
  const planned = [];
  const seen = new Set();
  for (const supplementId of supplementIds || []) {
    if (!supplementId || seen.has(supplementId)) continue;
    seen.add(supplementId);
    const id = intakeIdFor(date, supplementId);
    if (logged.has(supplementId) || present.has(id)) continue;
    const item = (catalog || []).find((entry) => entry.id === supplementId);
    planned.push({
      id,
      supplement_id: supplementId,
      name: item?.name || supplementId,
      dose: item?.default_dose ?? null,
      unit: item?.unit || "mg",
      time_of_day: item?.default_time_of_day || "any",
      notes: "",
    });
  }
  return planned;
}

export function planSnooze(supplementIds, existing, now, durationMs = SNOOZE_MS) {
  const updates = {};
  const seen = new Set();
  for (const id of supplementIds || []) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const until = existing?.[id];
    if (typeof until === "number" && until > now) continue;
    updates[id] = now + durationMs;
  }
  return updates;
}

export function mergeLoggedIntakes(current, intakes) {
  const log = { ...(current || {}), intakes: [...((current && current.intakes) || [])] };
  for (const intake of intakes || []) {
    if (!intake?.supplement_id) continue;
    if (log.intakes.some((item) => item.id === intake.id || item.supplement_id === intake.supplement_id)) continue;
    log.intakes.push(intake);
  }
  return log;
}

// Ein laufender Versuch hält weitere Aufrufe (Strict-Mode, Hash und Login)
// auf derselben Promise. Erst ein Fehler gibt den nächsten Versuch frei.
export function startPendingSupplementAction(execute) {
  if (inflight) return inflight;
  const pending = readPendingSupplementAction();
  if (!pending) return Promise.resolve(null);
  inflight = (async () => {
    try {
      const result = await execute(pending);
      if (result !== false) clearSupplementActionLink();
      return result;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

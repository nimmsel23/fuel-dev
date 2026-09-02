const STORAGE_KEY = "fuel-notification-intent";

function normalizeDate(value) {
  if (!value || value === "today") return new Date().toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function captureNotificationIntentFromLocation() {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const rawIntent = url.searchParams.get("notificationIntent");
  const rawTab = url.searchParams.get("notificationTab");
  const rawDate = url.searchParams.get("notificationDate");
  const rawFocus = url.searchParams.get("notificationFocus");
  const rawDraft = url.searchParams.get("notificationDraft");
  if (!rawIntent && !rawTab && !rawDate && !rawFocus && !rawDraft) return null;

  const intent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    intent: rawIntent || null,
    tab: rawTab || null,
    date: normalizeDate(rawDate),
    focus: rawFocus || null,
    draft: rawDraft || "",
    capturedAt: new Date().toISOString(),
  };

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  window.dispatchEvent(new CustomEvent("fuel-notification-intent", { detail: intent }));

  ["notificationIntent", "notificationTab", "notificationDate", "notificationFocus", "notificationDraft"].forEach((key) => {
    url.searchParams.delete(key);
  });
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", nextUrl);
  return intent;
}

export function readPendingNotificationIntent() {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function consumeNotificationIntent(matchIntent) {
  const payload = readPendingNotificationIntent();
  if (!payload) return null;
  if (matchIntent && payload.intent !== matchIntent) return null;
  window.sessionStorage.removeItem(STORAGE_KEY);
  return payload;
}

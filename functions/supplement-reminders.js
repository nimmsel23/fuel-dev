"use strict";

// Eine Push-Nachricht pro Supplement (statt einer Sammel-Nachricht pro Tageszeit),
// jeweils mit "Ja, genommen" / "Später". Reine Logik, ohne Firebase — getestet in
// tests/supplement-reminders.test.mjs.
//
// Wann wird ein Supplement gemeldet?
// - eigene Erinnerung (item.reminder.enabled + time) → zu dieser Uhrzeit
// - sonst → zur Slot-Uhrzeit (settings.supplement_push_<slot>_time) seiner default_time_of_day
// - "Später" (users/{uid}/meta/supplement_snooze) → erneut, sobald der Snooze abläuft
// Nicht gemeldet: Erinnerung aus, heute nicht fällig, schon geloggt, Snooze läuft noch.

const SUPPLEMENT_SLOTS = ["morning", "midday", "evening", "night"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const SLOT_LABELS = { morning: "Morgens", midday: "Mittags", evening: "Abends", night: "Nachts" };

function parseReminderMinutes(reminderTime) {
  if (typeof reminderTime !== "string" || !/^\d{2}:\d{2}$/.test(reminderTime)) return null;
  const [hour, minute] = reminderTime.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return hour * 60 + minute;
}

function isReminderDue(reminderTime, currentMinutes, windowMinutes) {
  const targetMinutes = parseReminderMinutes(reminderTime);
  if (targetMinutes == null) return false;
  const delta = currentMinutes - targetMinutes;
  return delta >= 0 && delta < windowMinutes;
}

function isDueToday(item, dateObj) {
  if (!item.schedule) return false;
  if (item.schedule.type === "daily") return true;
  if (item.schedule.type === "weekly") {
    return Boolean(item.schedule.days?.includes(WEEKDAYS[dateObj.getDay()]));
  }
  if (item.schedule.type === "cyclical") {
    if (!item.schedule.start_date || !item.schedule.interval_days) return false;
    const start = new Date(item.schedule.start_date);
    const diffDays = Math.floor(Math.abs(dateObj - start) / (1000 * 60 * 60 * 24));
    return diffDays % item.schedule.interval_days === 0;
  }
  return false;
}

function reminderTimeFor(item, settings) {
  if (item.reminder?.enabled && item.reminder.time) return item.reminder.time;
  if (!SUPPLEMENT_SLOTS.includes(item.default_time_of_day)) return null;
  return settings[`supplement_push_${item.default_time_of_day}_time`] || null;
}

// Liefert [{ item, reason: "scheduled" | "snooze" }] für diesen Tick.
function selectDueSupplements({ catalog, intakes, snoozed, settings, dateObj, currentMinutes, nowMs, windowMinutes }) {
  if (!settings.supplement_push_enabled) return [];
  const windowMs = windowMinutes * 60 * 1000;
  const due = [];
  for (const item of catalog || []) {
    if (!item?.id) continue;
    if (item.reminder && item.reminder.enabled === false) continue;
    if (!isDueToday(item, dateObj)) continue;
    if ((intakes || []).some((intake) => intake.supplement_id === item.id)) continue;

    const until = Number(snoozed?.[item.id]) || 0;
    if (until && nowMs < until) continue;
    if (until && nowMs - until < windowMs) {
      due.push({ item, reason: "snooze" });
      continue;
    }
    if (isReminderDue(reminderTimeFor(item, settings), currentMinutes, windowMinutes)) {
      due.push({ item, reason: "scheduled" });
    }
  }
  return due;
}

function buildSingleSupplementPayload({ uid, item, dateStr, reason, url }) {
  const timeOfDay = item.default_time_of_day || "any";
  const dose = item.default_dose ? `${item.default_dose} ${item.unit || ""}`.trim() : "";
  const slot = SLOT_LABELS[timeOfDay] || "";
  const details = [dose, slot].filter(Boolean).join(" · ");
  return {
    title: `💊 ${item.name || item.id}`,
    body: reason === "snooze" ? `Nochmal: ${details || "jetzt einnehmen?"}` : details || "Jetzt einnehmen?",
    icon: "/favicon-192x192.png",
    badge: "/favicon-192x192.png",
    // eigener Tag je Supplement → Nachrichten ersetzen sich nicht gegenseitig
    tag: `fuel-supplement-${item.id}`,
    requireInteraction: true,
    renotify: reason === "snooze",
    url,
    actions: [
      { action: "quick-yes", title: "✓ Ja, genommen" },
      { action: "snooze", title: "⏰ Später" },
    ],
    meta: {
      kind: "supplement_reminder",
      uid,
      date: dateStr,
      time_of_day: timeOfDay,
      reason,
      due_items: [
        {
          id: item.id,
          name: item.name,
          dose: item.default_dose ?? 0,
          unit: item.unit || "",
          time_of_day: timeOfDay,
        },
      ],
      app: "habits",
      feature: "supplements",
    },
  };
}

module.exports = {
  SUPPLEMENT_SLOTS,
  parseReminderMinutes,
  isReminderDue,
  isDueToday,
  reminderTimeFor,
  selectDueSupplements,
  buildSingleSupplementPayload,
};

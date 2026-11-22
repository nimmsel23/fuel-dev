const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { createSupplementActions } = require("./supplement-actions");
const reminders = require("./supplement-reminders");

admin.initializeApp();

const TIME_ZONE = "Europe/Berlin";
const REMINDER_WINDOW_MINUTES = 5;
const DEFAULTS = {
  supplement_push_enabled: true,
  supplement_push_morning_time: "08:00",
  supplement_push_midday_time: "13:00",
  supplement_push_evening_time: "19:00",
  supplement_push_night_time: "21:00",
  daily_fuel_quick_log_enabled: true,
  daily_fuel_quick_log_time: "09:30",
  daily_journal_entry_enabled: true,
  daily_journal_entry_time: "20:30",
};

function getLocalDateParts(date = new Date(), timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    date: `${byType.year}-${byType.month}-${byType.day}`,
    time: `${byType.hour}:${byType.minute}`,
    minutes: Number(byType.hour) * 60 + Number(byType.minute),
  };
}

function isReminderDue(reminderTime, currentMinutes) {
  return reminders.isReminderDue(reminderTime, currentMinutes, REMINDER_WINDOW_MINUTES);
}

// Pro Supplement eine eigene Nachricht (Logik: supplement-reminders.js).
// Liest pro Tick Katalog + Snooze (eigene Uhrzeiten und abgelaufene "Später"
// können jederzeit fällig sein), den Tageslog nur, wenn etwas in Frage kommt.
async function getSupplementReminderPayloads(db, uid, settings, dateParts) {
  if (!settings.supplement_push_enabled) return [];
  const [catalogSnap, snoozeSnap] = await Promise.all([
    db.collection("supplements").doc(uid).collection("meta").doc("catalog").get(),
    db.collection("users").doc(uid).collection("meta").doc("supplement_snooze").get(),
  ]);
  const catalog = catalogSnap.data()?.items || [];
  if (catalog.length === 0) return [];

  const base = {
    catalog,
    snoozed: snoozeSnap.data() || {},
    settings,
    dateObj: new Date(dateParts.date),
    currentMinutes: dateParts.minutes,
    nowMs: Date.now(),
    windowMinutes: REMINDER_WINDOW_MINUTES,
  };
  if (reminders.selectDueSupplements({ ...base, intakes: [] }).length === 0) return [];

  const logSnap = await db.collection("supplements").doc(uid).collection("logs").doc(dateParts.date).get();
  const due = reminders.selectDueSupplements({ ...base, intakes: logSnap.data()?.intakes || [] });
  const url = buildIntentUrl({ tab: "supplements", date: "today", intent: "supplements.daily-checklist", focus: "supplements-checklist" });
  return due.map(({ item, reason }) =>
    reminders.buildSingleSupplementPayload({ uid, item, dateStr: dateParts.date, reason, url })
  );
}

function buildIntentUrl({ tab, date = "today", intent, focus }) {
  const params = new URLSearchParams();
  if (tab) params.set("notificationTab", tab);
  if (date) params.set("notificationDate", date);
  if (intent) params.set("notificationIntent", intent);
  if (focus) params.set("notificationFocus", focus);
  const query = params.toString();
  const hash = tab ? `#${tab}/${date}` : "";
  return `/${query ? `?${query}` : ""}${hash}`;
}

function buildMessage(payload) {
  return {
    data: {
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/favicon-192x192.png",
      badge: payload.badge || "/favicon-192x192.png",
      url: payload.url || "/",
      tag: payload.tag || "fuel-reminder",
      actions: JSON.stringify(payload.actions || []),
      meta: JSON.stringify(payload.meta || {}),
      requireInteraction: payload.requireInteraction ? "true" : "false",
      renotify: payload.renotify ? "true" : "false",
    },
    webpush: {
      fcmOptions: {
        link: payload.url || "/",
      },
    },
  };
}

function buildFuelQuickLogPayload() {
  return {
    title: "Fuel Quick Log",
    body: "Logge dein Essen direkt als Freitext und lass Fuel den Eintrag bauen.",
    icon: "/favicon-192x192.png",
    badge: "/favicon-192x192.png",
    tag: "fuel-daily-quick-log",
    url: buildIntentUrl({
      tab: "dashboard",
      date: "today",
      intent: "fuel.quick-log",
      focus: "quick-ai-log",
    }),
    actions: [
      {
        action: "open-quick-log",
        title: "Quick Log",
        url: buildIntentUrl({ tab: "dashboard", date: "today", intent: "fuel.quick-log", focus: "quick-ai-log" }),
      },
      {
        action: "open-log-tab",
        title: "Log",
        url: buildIntentUrl({ tab: "log", date: "today", intent: "fuel.quick-log", focus: "quick-ai-log" }),
      },
      {
        action: "open-journal",
        title: "Journal",
        url: buildIntentUrl({ tab: "log", date: "today", intent: "journal.quick-entry", focus: "journal-notes" }),
      },
    ],
    meta: {
      kind: "daily_prompt",
      prompt_id: "fuel_quick_log",
      app: "fuel",
      reply_mode: "deep-link",
    },
  };
}

function buildJournalEntryPayload() {
  return {
    title: "Daily Journal",
    body: "Ein kurzer Check-in zu Schlaf, Energie, Hunger oder Training reicht.",
    icon: "/favicon-192x192.png",
    badge: "/favicon-192x192.png",
    tag: "fuel-daily-journal",
    url: buildIntentUrl({
      tab: "log",
      date: "today",
      intent: "journal.quick-entry",
      focus: "journal-notes",
    }),
    actions: [
      {
        action: "open-journal",
        title: "Jetzt schreiben",
        url: buildIntentUrl({ tab: "log", date: "today", intent: "journal.quick-entry", focus: "journal-notes" }),
      },
      {
        action: "open-food",
        title: "Food Log",
        url: buildIntentUrl({ tab: "food", date: "today", intent: "fuel.quick-log", focus: "quick-ai-log" }),
      },
    ],
    meta: {
      kind: "daily_prompt",
      prompt_id: "journal_entry",
      app: "journal",
      reply_mode: "deep-link",
    },
  };
}

async function sendMessageToToken(token, payload) {
  if (!token) return { sentCount: 0, failureCount: 0 };
  try {
    await admin.messaging().send({
      token,
      ...buildMessage(payload),
    });
    return { sentCount: 1, failureCount: 0 };
  } catch (error) {
    console.error("FCM send failed:", error);
    return { sentCount: 0, failureCount: 1, error: error.message };
  }
}

exports.scheduledPushReminders = functions
  .region("europe-west1")
  .pubsub.schedule("every 5 minutes")
  .timeZone(TIME_ZONE)
  .onRun(async () => {
    const { minutes } = getLocalDateParts();
    const db = admin.firestore();
    let sentCount = 0;
    let failureCount = 0;

    try {
      const usersSnap = await db.collection("users").get();

      for (const userDoc of usersSnap.docs) {
        const uid = userDoc.id;
        const [settingsSnap, tokenSnap] = await Promise.all([
          userDoc.ref.collection("meta").doc("settings").get(),
          userDoc.ref.collection("fcm").doc("token").get(),
        ]);

        const settings = { ...DEFAULTS, ...(settingsSnap.data() || {}) };
        const token = tokenSnap.data()?.token || null;
        if (!token) continue;

        const duePayloads = [];
        if (settings.daily_fuel_quick_log_enabled && isReminderDue(settings.daily_fuel_quick_log_time, minutes)) {
          duePayloads.push(buildFuelQuickLogPayload());
        }
        if (settings.daily_journal_entry_enabled && isReminderDue(settings.daily_journal_entry_time, minutes)) {
          duePayloads.push(buildJournalEntryPayload());
        }
        duePayloads.push(...(await getSupplementReminderPayloads(db, uid, settings, getLocalDateParts())));

        for (const payload of duePayloads) {
          const result = await sendMessageToToken(token, payload);
          sentCount += result.sentCount || 0;
          failureCount += result.failureCount || 0;
          console.log(
            `[scheduledPushReminders] uid=${uid} prompt=${payload.meta.prompt_id || payload.meta.kind}${payload.meta.due_items ? `:${payload.meta.due_items[0].id}` : ""} sent=${result.sentCount || 0} failed=${result.failureCount || 0}`
          );
        }
      }

      console.log(`Push reminders: ${sentCount} sent, ${failureCount} failed`);
      return { sentCount, failureCount };
    } catch (error) {
      console.error("Error in scheduledPushReminders:", error);
      return { error: error.message };
    }
  });

// CORS: der Service Worker auf *.web.app ruft diese Functions cross-origin auf.
// Die uid kommt nur aus Authorization: Bearer <Firebase-ID-Token> (verifyIdToken).
// Eine uid im Body muss fehlen oder mit der Token-uid übereinstimmen, sonst 403.
// Ohne gültiges Token: 401 unauthenticated. Es gibt keinen Secret-Fallback.
function withCors(handler) {
  return (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    return handler(req, res);
  };
}

const supplementActions = createSupplementActions({ admin, getLocalDateParts });

// "Ja, genommen" aus der Notification heraus — schreibt direkt in
// supplements/{uid}/logs/{date}, analog zu addIntake() im lokalen Channel
// (src/server/services/supplements-log.mjs), nur ohne Tombstone-Tracking.
exports.quickLogSupplement = functions
  .region("europe-west1")
  .https.onRequest(withCors(supplementActions.quickLogSupplement));

// "Später" aus der Notification heraus — merkt sich einen until-Timestamp
// in users/{uid}/meta/supplement_snooze, den getSupplementReminderPayloads()
// beim nächsten 5-Minuten-Tick respektiert.
exports.snoozeSupplement = functions
  .region("europe-west1")
  .https.onRequest(withCors(supplementActions.snoozeSupplement));

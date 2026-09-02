const functions = require("firebase-functions");
const admin = require("firebase-admin");

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

function parseReminderMinutes(reminderTime) {
  if (typeof reminderTime !== "string" || !/^\d{2}:\d{2}$/.test(reminderTime)) return null;
  const [hour, minute] = reminderTime.split(":").map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  return hour * 60 + minute;
}

function isReminderDue(reminderTime, currentMinutes) {
  const targetMinutes = parseReminderMinutes(reminderTime);
  if (targetMinutes == null) return false;
  const delta = currentMinutes - targetMinutes;
  return delta >= 0 && delta < REMINDER_WINDOW_MINUTES;
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

        for (const payload of duePayloads) {
          const result = await sendMessageToToken(token, payload);
          sentCount += result.sentCount || 0;
          failureCount += result.failureCount || 0;
          console.log(
            `[scheduledPushReminders] uid=${uid} prompt=${payload.meta.prompt_id} sent=${result.sentCount || 0} failed=${result.failureCount || 0}`
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

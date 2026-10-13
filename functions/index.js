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

const SUPPLEMENT_SLOTS = ["morning", "midday", "evening", "night"];
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function isDueToday(item, dateObj) {
  if (!item.schedule) return false;
  if (item.schedule.type === "daily") return true;
  if (item.schedule.type === "weekly") {
    return item.schedule.days?.includes(WEEKDAYS[dateObj.getDay()]);
  }
  if (item.schedule.type === "cyclical") {
    if (!item.schedule.start_date || !item.schedule.interval_days) return false;
    const start = new Date(item.schedule.start_date);
    const diffDays = Math.floor(Math.abs(dateObj - start) / (1000 * 60 * 60 * 24));
    return diffDays % item.schedule.interval_days === 0;
  }
  return false;
}

function buildSupplementPayload({ uid, timeOfDay, dueItems, dateStr }) {
  const names = dueItems.map((i) => i.name).join(", ");
  return {
    title: `Time for your ${timeOfDay} Supplements`,
    body: `Noch offen: ${names}`,
    icon: "/favicon-192x192.png",
    badge: "/favicon-192x192.png",
    tag: `fuel-supplements-${timeOfDay}`,
    requireInteraction: true,
    url: buildIntentUrl({ tab: "supplements", date: "today", intent: "supplements.daily-checklist", focus: "supplements-checklist" }),
    // Gleiche quick-yes/snooze Actions wie der lokale Channel
    // (push-config.mjs) — der SW erkennt Cloud-Origin und ruft stattdessen
    // quickLogSupplement/snoozeSupplement statt der lokalen Fastify-Routen.
    actions: [
      { action: "quick-yes", title: "✓ Ja, genommen" },
      { action: "snooze", title: "⏰ Später" },
    ],
    meta: {
      kind: "supplement_reminder",
      uid,
      date: dateStr,
      time_of_day: timeOfDay,
      due_items: dueItems.map((item) => ({
        id: item.id,
        name: item.name,
        dose: item.default_dose ?? 0,
        unit: item.unit || "",
        time_of_day: item.default_time_of_day || timeOfDay,
      })),
      app: "habits",
      feature: "supplements",
    },
  };
}

async function getSupplementReminderPayloads(db, uid, timeOfDay, dateParts) {
  const [catalogSnap, logSnap, snoozeSnap] = await Promise.all([
    db.collection("supplements").doc(uid).collection("meta").doc("catalog").get(),
    db.collection("supplements").doc(uid).collection("logs").doc(dateParts.date).get(),
    db.collection("users").doc(uid).collection("meta").doc("supplement_snooze").get(),
  ]);

  const catalog = catalogSnap.data()?.items || [];
  if (catalog.length === 0) return [];
  const intakes = logSnap.data()?.intakes || [];
  const snoozed = snoozeSnap.data() || {};
  const now = Date.now();
  const dateObj = new Date(dateParts.date);

  const dueItems = catalog.filter((item) => {
    if (item.reminder && item.reminder.enabled === false) return false;
    if (item.reminder?.enabled && item.reminder.time) return false; // pro-item reminder übernimmt
    if (!isDueToday(item, dateObj) || item.default_time_of_day !== timeOfDay) return false;
    if (intakes.some((intake) => intake.supplement_id === item.id)) return false;
    const until = snoozed[item.id];
    if (until && now < until) return false;
    return true;
  });

  if (dueItems.length === 0) return [];
  return [buildSupplementPayload({ uid, timeOfDay, dueItems, dateStr: dateParts.date })];
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
        if (settings.supplement_push_enabled) {
          const dateParts = getLocalDateParts();
          for (const slot of SUPPLEMENT_SLOTS) {
            if (!isReminderDue(settings[`supplement_push_${slot}_time`], minutes)) continue;
            const supplementPayloads = await getSupplementReminderPayloads(db, uid, slot, dateParts);
            duePayloads.push(...supplementPayloads);
          }
        }

        for (const payload of duePayloads) {
          const result = await sendMessageToToken(token, payload);
          sentCount += result.sentCount || 0;
          failureCount += result.failureCount || 0;
          console.log(
            `[scheduledPushReminders] uid=${uid} prompt=${payload.meta.prompt_id || payload.meta.kind} sent=${result.sentCount || 0} failed=${result.failureCount || 0}`
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

// CORS: der SW auf fuel-vos.web.app ruft diese Functions cross-origin auf
// (eigene cloudfunctions.net-Domain) — Auth-Modell ist bewusst simpel:
// die uid steht unsigniert im eigenen Push-Payload (meta.uid), den nur der
// SW des Geräts sieht, das den Push erhalten hat. Kein Login-State im SW
// verfügbar, daher kein ID-Token-Check. Ausreichend für Coach/Few-Client-
// Betrieb, kein Ersatz für echte Auth bei öffentlichem Multi-Tenant-Zugriff.
function withCors(handler) {
  return (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }
    return handler(req, res);
  };
}

// "Ja, genommen" aus der Notification heraus — schreibt direkt in
// supplements/{uid}/logs/{date}, analog zu addIntake() im lokalen Channel
// (src/server/services/supplements-log.mjs), nur ohne Tombstone-Tracking.
exports.quickLogSupplement = functions
  .region("europe-west1")
  .https.onRequest(withCors(async (req, res) => {
    if (req.method !== "POST") return res.status(405).send({ ok: false, error: "POST only" });
    const { uid, item, date } = req.body || {};
    if (!uid || !item?.id) return res.status(400).send({ ok: false, error: "uid and item.id required" });

    const dateStr = typeof date === "string" && date ? date : getLocalDateParts().date;
    const db = admin.firestore();
    const logRef = db.collection("supplements").doc(uid).collection("logs").doc(dateStr);

    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(logRef);
        const data = snap.exists ? snap.data() : { date: dateStr, intakes: [] };
        const intakes = Array.isArray(data.intakes) ? data.intakes : [];
        if (intakes.some((i) => i.supplement_id === item.id)) return; // schon geloggt
        intakes.push({
          id: `supp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          supplement_id: item.id,
          name: item.name || item.id,
          dose: item.dose ?? null,
          unit: item.unit || "mg",
          time_of_day: item.time_of_day || "any",
          notes: "",
          time: new Date().toISOString(),
        });
        tx.set(logRef, { ...data, date: dateStr, intakes, updated_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      });
      res.send({ ok: true });
    } catch (error) {
      console.error("quickLogSupplement failed:", error);
      res.status(500).send({ ok: false, error: error.message });
    }
  }));

// "Später" aus der Notification heraus — merkt sich einen until-Timestamp
// in users/{uid}/meta/supplement_snooze, den getSupplementReminderPayloads()
// beim nächsten 5-Minuten-Tick respektiert.
exports.snoozeSupplement = functions
  .region("europe-west1")
  .https.onRequest(withCors(async (req, res) => {
    if (req.method !== "POST") return res.status(405).send({ ok: false, error: "POST only" });
    const { uid, item_ids } = req.body || {};
    if (!uid || !Array.isArray(item_ids) || item_ids.length === 0) {
      return res.status(400).send({ ok: false, error: "uid and item_ids required" });
    }

    const until = Date.now() + 30 * 60 * 1000;
    const ref = admin.firestore().collection("users").doc(uid).collection("meta").doc("supplement_snooze");
    try {
      const update = {};
      for (const id of item_ids) update[id] = until;
      await ref.set(update, { merge: true });
      res.send({ ok: true, until });
    } catch (error) {
      console.error("snoozeSupplement failed:", error);
      res.status(500).send({ ok: false, error: error.message });
    }
  }));

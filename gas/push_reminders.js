// ================================================================
// PUSH REMINDERS (HABIT TRACKER) — Fuel GAS
// ================================================================

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function isDueToday_(item, dateObj) {
  if (!item.schedule) return false;
  if (item.schedule.type === "daily") return true;
  
  if (item.schedule.type === "weekly") {
    const dayName = WEEKDAYS[dateObj.getDay()];
    return (item.schedule.days || []).includes(dayName);
  }
  
  if (item.schedule.type === "cyclical") {
    if (!item.schedule.start_date || !item.schedule.interval_days) return false;
    // Hacky parse for YYYY-MM-DD
    const parts = item.schedule.start_date.split('-');
    if (parts.length !== 3) return false;
    const start = new Date(parts[0], parts[1] - 1, parts[2]);
    const diffTime = Math.abs(dateObj.getTime() - start.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays % item.schedule.interval_days === 0;
  }
  
  return false;
}

// Einstiegspunkt für den Time-Driven Trigger
// Der Trigger sollte stündlich laufen, wir prüfen die genaue Stunde im Script
function triggerPushReminders() {
  const now = new Date();
  // Wichtig: Zeitzone deines Scripts (Project Settings) beachten!
  const hours = now.getHours();
  
  let timeOfDay = null;
  if (hours === 8) timeOfDay = "morning";
  else if (hours === 13) timeOfDay = "midday";
  else if (hours === 19) timeOfDay = "evening";
  else if (hours === 21) timeOfDay = "night";
  
  if (!timeOfDay) {
    Logger.log("Keine Reminder zur aktuellen Stunde: " + hours);
    return;
  }
  
  Logger.log("Check Reminders für: " + timeOfDay);
  checkAndSendReminders_(timeOfDay, now);
}

function checkAndSendReminders_(timeOfDay, nowObj) {
  const todayStr = Utilities.formatDate(nowObj, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  
  let uids = fsListIds_('supplements');
  if (!uids || uids.length === 0) {
    const defaultUid = getProp_(PROP.FUEL_UID);
    if (defaultUid) uids = [defaultUid];
    else return;
  }
  
  uids.forEach(uid => {
    try {
      checkRemindersForUser_(uid, timeOfDay, nowObj, todayStr);
    } catch (e) {
      Logger.log("Fehler bei User " + uid + ": " + e.message);
    }
  });
}

function checkRemindersForUser_(uid, timeOfDay, nowObj, todayStr) {
  // 1. Catalog laden
  const catalogDoc = fsGet_('supplements/' + uid + '/meta/catalog');
  if (!catalogDoc) return;
  const catalogData = fsReadDoc_(catalogDoc);
  let items = [];
  try {
    items = JSON.parse(catalogData.items || "[]");
  } catch (e) {
    if (Array.isArray(catalogData.items)) items = catalogData.items;
  }
  if (items.length === 0) return;
  
  // 2. Log von heute laden
  const logDoc = fsGet_('supplements/' + uid + '/logs/' + todayStr);
  let intakes = [];
  if (logDoc) {
    const logData = fsReadDoc_(logDoc);
    try {
      intakes = JSON.parse(logData.intakes || "[]");
    } catch (e) {
      if (Array.isArray(logData.intakes)) intakes = logData.intakes;
    }
  }
  
  // 3. Due Supplements filtern
  const dueItems = items.filter(item => {
    const isDue = isDueToday_(item, nowObj) && item.default_time_of_day === timeOfDay;
    if (!isDue) return false;
    const isLogged = intakes.some(intake => intake.supplement_id === item.id);
    return !isLogged;
  });
  
  if (dueItems.length === 0) {
    Logger.log(uid + " -> Alles erledigt für " + timeOfDay);
    return;
  }
  
  const names = dueItems.map(i => i.name).join(", ");
  Logger.log(uid + " -> Offen für " + timeOfDay + ": " + names);
  
  // 4. FCM Token laden und senden
  // Wir gehen davon aus, dass das Frontend ein FCM Token in 'users/{uid}/fcm/token' ablegt
  const tokenDoc = fsGet_('users/' + uid + '/fcm/token');
  if (!tokenDoc) {
    Logger.log("Kein FCM Token für User " + uid + " gefunden. Überspringe Push.");
    return;
  }
  
  const tokenData = fsReadDoc_(tokenDoc);
  const fcmToken = tokenData.token;
  if (fcmToken) {
    sendFcmNotification_(fcmToken, "Supplement Reminder (" + timeOfDay + ")", "Noch offen: " + names);
  }
}

function sendFcmNotification_(fcmToken, title, body) {
  const project = getProp_(PROP.FIREBASE_PROJECT);
  const fcmUrl = 'https://fcm.googleapis.com/v1/projects/' + project + '/messages:send';
  
  const payload = {
    message: {
      token: fcmToken,
      notification: {
        title: title,
        body: body
      },
      webpush: {
        fcm_options: {
          link: "/supplements" // Wenn der User klickt, öffnet sich der Tab
        }
      }
    }
  };
  
  const res = UrlFetchApp.fetch(fcmUrl, {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  if (res.getResponseCode() !== 200) {
    Logger.log("FCM Sende-Fehler: " + res.getContentText());
  } else {
    Logger.log("Push gesendet an Token: " + fcmToken.substring(0, 10) + "...");
  }
}

/**
 * VITAL-OS COACH SUMMARY - GOOGLE APPS SCRIPT
 * 
 * Dieses Skript ruft täglich/wöchentlich/monatlich/quartalsweise die Logs aller
 * Klienten aus Firestore ab, übersetzt UIDs in Namen via profile-Collection,
 * fasst sie über die Gemini API zusammen und sendet dir das Briefing per Telegram.
 * 
 * AUTH: OAuth via ScriptApp.getOAuthToken() — kein Service-Account Key nötig,
 *       das Skript muss am GCP-Projekt fitness-aos (842575255284) hängen.
 * 
 * VORAUSSETZUNGEN (Script Properties):
 * 1. GEMINI_API_KEY: Dein Google Gemini API Key
 * 2. TELEGRAM_BOT_TOKEN: Dein Telegram Bot Token (für @aos_fitness_bot)
 * 3. TELEGRAM_CHAT_ID: Deine Chat-ID (kommasepariert)
 */

const PROJECT_ID = 'fitness-aos';

// === TRIGGER-FUNKTIONEN (Für die Automatisierung) ===

function runDailyBriefing()     { generateBriefing('daily'); }
function runWeeklyReport()      { generateBriefing('weekly'); } // Wöchentlicher Report (Nutzt wöchentliches Briefing)
function runMonthlyBriefing()   { generateBriefing('monthly'); }
function runQuarterlyBriefing() { generateBriefing('quarterly'); }

/**
 * Filtert das monatliche Triggern, damit das Quartals-Briefing nur alle 3 Monate läuft.
 */
function runQuarterlyBriefingTrigger() {
  const month = new Date().getMonth(); // 0-indexed (Jan=0, Apr=3, Jul=6, Oct=9)
  if (month === 0 || month === 3 || month === 6 || month === 9) {
    runQuarterlyBriefing();
  }
}

/**
 * Jeden Montag 07:30 — Weekly Fuel/Nutrition-Abdeckung: Trends der letzten 7 Tage
 */
function runWeeklyNutritionCheck() {
  const props = PropertiesService.getScriptProperties();
  const token = ScriptApp.getOAuthToken();
  
  // Zeitraum berechnen: Letzte 7 Tage (Gestern bis Gestern - 6 Tage)
  const endStr = getDateString(-1); 
  const startStr = getDateString(-7); 

  const mealLogs = fetchNutritionLogsRange(token, startStr, endStr);
  const userMap = fetchUserMap(token);

  if (mealLogs.length === 0) {
    sendTelegramMessage(props, `🥗 <b>Weekly Fuel-Check</b>\n\nKeine Ernährungsdaten im Zeitraum ${startStr} bis ${endStr} geloggt.`);
    return;
  }

  // User UIDs zu Namen mappen
  mealLogs.forEach(log => log._userName = userMap[log._userId] || log._userId);

  const expectedClients = Object.entries(userMap).map(([id, name]) => ({ id, name }));
  const prompt = getWeeklyNutritionPrompt(startStr, endStr, expectedClients, mealLogs);

  const check = callGeminiAPI(props.getProperty('GEMINI_API_KEY'), prompt);
  sendTelegramMessage(props, `🥗 <b>Weekly Fuel-Check (${startStr} bis ${endStr})</b>\n\n${check}`);
}

/**
 * Täglich 08:05 — Mood-Trend-Alarm: wer hatte 3+ Tage Mood < 6?
 */
function runMoodTrendAlert() {
  const props = PropertiesService.getScriptProperties();
  const token = ScriptApp.getOAuthToken();
  const today = getDateString(0);
  const threeDaysAgo = getDateString(-3);

  const sessions = fetchCollectionGroupRange(token, 'sessions', threeDaysAgo, today);
  const userMap = fetchUserMap(token);

  // Filtere Klienten mit durchgehend niedrigem Mood
  const userMoods = {};
  sessions.forEach(s => {
    const u = s._userId;
    const mood = parseInt(s.mood, 10);
    if (!isNaN(mood)) {
      if (!userMoods[u]) userMoods[u] = [];
      userMoods[u].push({ date: s.date, mood });
    }
  });

  const alerts = Object.entries(userMoods)
    .filter(([_, moods]) => moods.length >= 2 && moods.every(m => m.mood < 6))
    .map(([uid, moods]) => ({ 
      uid, 
      name: userMap[uid] || uid, 
      moods 
    }));

  if (alerts.length === 0) return; // Alles gut, kein Ping nötig

  const prompt = getMoodPrompt(alerts);

  const alert = callGeminiAPI(props.getProperty('GEMINI_API_KEY'), prompt);
  sendTelegramMessage(props, `🔴 <b>Mood-Alarm</b>\n\n${alert}`);
}

/**
 * Täglich 20:00 — Erinnerung: wer hat HEUTE noch gar nichts geloggt?
 */
function runMissingLogAlert() {
  const props = PropertiesService.getScriptProperties();
  const token = ScriptApp.getOAuthToken();
  const today = getDateString(0);

  // Wer hat heute irgendwas geloggt
  const journalsToday  = fetchCollectionGroupRange(token, 'journal', today, today);
  const sessionsToday  = fetchCollectionGroupRange(token, 'sessions', today, today);
  const userMap = fetchUserMap(token);

  const activeUsers = new Set([
    ...journalsToday.map(e => e._userId),
    ...sessionsToday.map(e => e._userId),
  ]);

  // Alle bekannten User aus den letzten 7 Tagen holen
  const weekAgo = getDateString(-7);
  const recentSessions = fetchCollectionGroupRange(token, 'sessions', weekAgo, today);
  const allKnownUsers  = new Set(recentSessions.map(s => s._userId));

  // Auch alle registrierten User aus dem Profil-Mapping hinzufügen
  Object.keys(userMap).forEach(uid => allKnownUsers.add(uid));

  const silent = [...allKnownUsers].filter(u => !activeUsers.has(u));

  if (silent.length === 0) {
    sendTelegramMessage(props, `✅ <b>Log-Check ${today}</b>\n\nAlle aktiven Klienten haben heute geloggt.`);
    return;
  }

  const msg = `📭 <b>Log-Check ${today}</b>\n\nNoch keine Aktivität heute:\n${silent.map(u => `- ${userMap[u] || u}`).join('\n')}\n\n<i>Evtl. Erinnerung schicken?</i>`;
  sendTelegramMessage(props, msg);
}

/**
 * Manuell — Test-Ping
 */
function sendTestMessage() {
  const props = PropertiesService.getScriptProperties();
  sendTelegramMessage(props, '✅ <b>VitalOS Coach Bot</b> ist aktiv und verbunden!');
}

// === KERN-FUNKTION ===

function generateBriefing(timeframe) {
  const props = PropertiesService.getScriptProperties();
  const dates = getDateRange(timeframe);
  
  // 1. Hole Daten aus Firestore für den Zeitraum
  const token = ScriptApp.getOAuthToken(); 
  const journals = fetchCollectionGroupRange(token, 'journal', dates.startStr, dates.endStr);
  const sessions = fetchCollectionGroupRange(token, 'sessions', dates.startStr, dates.endStr);
  
  // User-Namen mappen
  const userMap = fetchUserMap(token);
  journals.forEach(j => j._userName = userMap[j._userId] || j._userId);
  sessions.forEach(s => s._userName = userMap[s._userId] || s._userId);

  const expectedClients = Object.entries(userMap).map(([id, name]) => ({ id, name }));
  
  if (journals.length === 0 && sessions.length === 0) {
    sendTelegramMessage(props, `ℹ️ <b>Keine Logs</b> im Zeitraum ${dates.startStr} bis ${dates.endStr} (${timeframe}) gefunden.`);
    return;
  }

  // 2. Erstelle einen KI-Prompt
  const prompt = getBriefingPrompt(timeframe, dates.startStr, dates.endStr, expectedClients, journals, sessions);

  // 3. KI-Zusammenfassung generieren
  const briefing = callGeminiAPI(props.getProperty('GEMINI_API_KEY'), prompt);

  // 4. Per Telegram versenden
  if (briefing) {
    const message = `🧠 <b>Coach ${timeframe.toUpperCase()} Briefing</b>\n\n${briefing}`;
    sendTelegramMessage(props, message);
  }
}

// === HILFSFUNKTIONEN ===

// Berechnet Start- und Enddatum basierend auf dem Zeitraum
function getDateRange(timeframe) {
  const end = new Date();
  end.setDate(end.getDate() - 1); // Das Ende ist immer "gestern"
  const start = new Date(end);

  switch(timeframe) {
    case 'daily':     start.setDate(start.getDate() - 0); break; // Gleicher Tag wie Ende
    case 'weekly':    start.setDate(start.getDate() - 6); break; // 7 Tage rückwirkend
    case 'monthly':   start.setMonth(start.getMonth() - 1); break; // 1 Monat rückwirkend
    case 'quarterly': start.setMonth(start.getMonth() - 3); break; // 3 Monate rückwirkend
  }

  return {
    startStr: start.toISOString().split('T')[0],
    endStr: end.toISOString().split('T')[0]
  };
}

// Holt Daten aus Firestore mit einer Datumsspanne (>= start AND <= end)
function fetchCollectionGroupRange(token, collectionId, startDate, endDate) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  
  const payload = {
    structuredQuery: {
      from: [{ collectionId: collectionId, allDescendants: true }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            {
              fieldFilter: {
                field: { fieldPath: "date" },
                op: "GREATER_THAN_OR_EQUAL",
                value: { stringValue: startDate }
              }
            },
            {
              fieldFilter: {
                field: { fieldPath: "date" },
                op: "LESS_THAN_OR_EQUAL",
                value: { stringValue: endDate }
              }
            }
          ]
        }
      }
    }
  };

  return runFirestoreQuery(token, url, payload);
}

function fetchNutritionLogsRange(token, startDate, endDate) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  
  const payload = {
    structuredQuery: {
      from: [{ collectionId: 'logs', allDescendants: true }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "date" }, op: "GREATER_THAN_OR_EQUAL", value: { stringValue: startDate } } },
            { fieldFilter: { field: { fieldPath: "date" }, op: "LESS_THAN_OR_EQUAL", value: { stringValue: endDate } } }
          ]
        }
      }
    }
  };
  
  const allLogs = runFirestoreQuery(token, url, payload);
  return allLogs.filter(log => log._root === 'nutrition');
}

function runFirestoreQuery(token, url, payload) {
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${token}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    console.error(`Firestore Fehler: ${res.getContentText()}`);
    return [];
  }

  const responseText = res.getContentText().trim();
  if (!responseText || responseText === "[]") return [];

  try {
    const results = JSON.parse(responseText);
    return results
      .filter(r => r.document)
      .map(r => {
        const doc = r.document;
        const docPath = doc.name.split('/');
        
        // Pfad-Beispiel: projects/../documents / nutrition / {uid} / logs / {docId}
        const baseIndex = docPath.indexOf('documents'); 
        
        const rootSegment = docPath[baseIndex + 1];   // 'fitness' oder 'nutrition'
        const userId = docPath[baseIndex + 2];        // Die {uid}
        const subCollection = docPath[baseIndex + 3]; // 'journal', 'sessions', 'logs'
        
        // Speichere die Meta-Daten mit Unterstrich, damit sie nicht mit deinen echten Feldern kollidieren
        const parsed = { _userId: userId, _root: rootSegment, _collection: subCollection };
        
        const fields = doc.fields || {};
        for (const [key, val] of Object.entries(fields)) {
          parsed[key] = val.stringValue ?? val.integerValue ?? val.doubleValue ?? val.booleanValue ?? val.timestampValue ?? JSON.stringify(val);
        }
        return parsed;
      });
  } catch (e) {
    console.error("Fehler beim Parsen der Firestore-Antwort:", e);
    return [];
  }
}

function fetchUserMap(token) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const payload = {
    structuredQuery: {
      from: [{ collectionId: "profile", allDescendants: true }]
    }
  };

  const docs = runFirestoreQuery(token, url, payload);
  const map = {};
  docs.forEach(doc => {
    const name = doc.displayName || doc.name;
    if (name) {
      map[doc._userId] = name;
    }
  });
  return map;
}

function callGeminiAPI(apiKey, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: { parts: [{ text: "Du bist ein präziser, analytischer Coach." }] },
    generationConfig: { temperature: 0.2 }
  };
  
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  
  if (res.getResponseCode() === 200) {
    const data = JSON.parse(res.getContentText());
    return data.candidates[0].content.parts[0].text;
  }
  return "Fehler bei der KI-Generierung: " + res.getContentText();
}

function sendTelegramMessage(props, text) {
  const token = props.getProperty('TELEGRAM_BOT_TOKEN');
  const chatIdsStr = props.getProperty('TELEGRAM_CHAT_ID') || "";
  
  const chatIds = chatIdsStr.split(',')
    .map(id => id.trim())
    .filter(id => id !== "");
  
  chatIds.forEach(chatId => {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ chat_id: chatId, text: text, parse_mode: 'HTML' }),
      muteHttpExceptions: true
    });
    
    if (res.getResponseCode() !== 200) {
      console.error(`Telegram Fehler für ID ${chatId}: ${res.getContentText()}`);
    }
  });
}

function getDateString(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return Utilities.formatDate(d, 'Europe/Vienna', 'yyyy-MM-dd');
}

// ═══════════════════════════════════════════════════════
//  SETUP — Trigger automatisch anlegen
// ═══════════════════════════════════════════════════════

function setupAllTriggers() {
  // Alte Trigger löschen
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // 1. Tägliches Briefing um 6:00 Uhr morgens (für "gestern")
  ScriptApp.newTrigger('runDailyBriefing')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .create();

  // 2. Mood-Trend-Alert täglich um 8:00 Uhr morgens
  ScriptApp.newTrigger('runMoodTrendAlert')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

// 3. Weekly Nutrition-Check jeden Montagvormittag um 11 Uhr
  ScriptApp.newTrigger('runWeeklyNutritionCheck')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(11)
    .nearMinute(30)
    .create();

  // 4. Missing-Log-Check täglich um 20:00 Uhr abends
  ScriptApp.newTrigger('runMissingLogAlert')
    .timeBased()
    .everyDays(1)
    .atHour(20)
    .create();

  // 5. Wöchentliches Briefing jeden Montag um 7:00 Uhr morgens
  ScriptApp.newTrigger('runWeeklyReport')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(7)
    .create();

  // 6. Monatliches Briefing am 1. jedes Monats um 8:00 Uhr morgens
  ScriptApp.newTrigger('runMonthlyBriefing')
    .timeBased()
    .onMonthDay(1)
    .atHour(8)
    .create();

  // 7. Quartals-Briefing am 1. des Monats um 9:00 Uhr morgens (wird über Trigger gefiltert)
  ScriptApp.newTrigger('runQuarterlyBriefingTrigger')
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .create();

// Trigger für Report_Mindset.gs (Alle 14 Tage, hier exemplarisch jeden 2. Sonntag)
  ScriptApp.newTrigger('runMindsetAnalysis')
    .timeBased()
    .everyWeeks(2)
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(19)
    .create();

  // Trigger für Report_Hype.gs (Freitags)
  ScriptApp.newTrigger('runHypeAndWins')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(18)
    .create();

  // Trigger für Report_Weekend.gs (Montags)
  ScriptApp.newTrigger('runWeekendDerailmentCheck')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();

  // Trigger für Report_Burnout.gs (Mittwochs)
  ScriptApp.newTrigger('runBurnoutSensor')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.WEDNESDAY)
    .atHour(12)
    .create();
    
  console.log('✅ Alle zeitgesteuerten Trigger erfolgreich eingerichtet.');
}

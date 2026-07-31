/**
 * Generiert den Prompt für den Nutrition/Fuel-Check.
 */
function getNutritionPrompt(today, mealLogs) {
  return `
    Analysiere diese Ernährungs-Logs vom ${today} und erstelle eine kurze Zusammenfassung für den Coach.
    WICHTIGE REGEL:
    VERWENDE KEIN MARKDOWN! Keine Sternchen (*), keine Rauten (#). Nutze für Fettgedrucktes ausschließlich HTML-Tags (<b>Text</b>) und für Listen normale Bindestriche (-).
    
    Inhalt:
    - Wer hat gut getankt (Kalorien, Makros)?
    - Wer fehlt noch / hat sehr wenig geloggt?
    - Auffälligkeiten?
    
    Sei direkt, max 5 Zeilen, mit Emojis.
    
    DATEN:
    ${JSON.stringify(mealLogs, null, 2)}
  `;
}

/**
 * Generiert den Prompt für den Mood-Trend-Alert.
 */
function getMoodPrompt(alerts) {
  return `
    Folgende Klienten zeigen einen anhaltend niedrigen Mood-Score (letzte 3 Tage, alle Werte < 6):
    ${JSON.stringify(alerts, null, 2)}
    
    WICHTIGE REGEL:
    VERWENDE KEIN MARKDOWN! Keine Sternchen (*), keine Rauten (#). Nutze für Fettgedrucktes ausschließlich HTML-Tags (<b>Text</b>) und für Listen normale Bindestriche (-).
    
    Formuliere eine kurze, empathische Coach-Warnung für mich (den Coach) auf Deutsch:
    - Wer ist betroffen? (Nutze Klarnamen)
    - Empfehlung (proaktiv ansprechen? Check-in einplanen?)
    Max 3–4 Sätze, direkt, kein Floskeln.
  `;
}

/**
 * Generiert den Prompt für den wöchentlichen Nutrition/Fuel-Check.
 */
function getWeeklyNutritionPrompt(startStr, endStr, expectedClients, mealLogs) {
  const rawData = `
    Erwartete Klienten: ${JSON.stringify(expectedClients, null, 2)}
    Meal-Logs (${startStr} bis ${endStr}):
    ${JSON.stringify(mealLogs, null, 2)}
  `;

  return `
    Du bist ein analytischer Ernährungs-Coach. 
    Analysiere diese Meal-Logs der letzten 7 Tage (${startStr} bis ${endStr}) und erstelle eine kompakte Zusammenfassung.
    
    WICHTIGE REGELN:
    1. VERWENDE KEIN MARKDOWN! Nutze für Fettgedrucktes ausschließlich HTML-Tags (<b>Text</b>) und für Listen normale Bindestriche (-).
    2. Bewerte den Trend über die Woche: Wer hat konsistent geloggt? Gibt es Ausreißer (starke Schwankungen bei Kalorien/Makros)?
    3. Vergleiche die Liste der "Erwarteten Klienten" mit den "Meal-Logs". Wer fehlt komplett?
    
    Format:
    [2-3 Sätze Gesamtfazit der Woche]
    
    <b>🟢 On Track (Konsistent)</b>
    - [Klient]: [Kurze Einschätzung der Makro-/Kalorien-Trends]
    
    <b>🟡 Schwankungen / Ausreißer</b>
    - [Klient]: [Erkanntes Muster, z.B. Wochenende eingebrochen]
    
    <b>🔴 Keine Logs</b>
    - [Klient]
    
    Rohdaten:
    ${rawData}
  `;
}

// Diese Funktion als wöchentlichen Trigger (z.B. jeden Sonntag 18:00 Uhr) einrichten
function runWeeklyBriefing() {
  const props = PropertiesService.getScriptProperties();
  
  // 1. Zeitraum berechnen (Letzte 7 Tage)
  const end = new Date();
  end.setDate(end.getDate() - 1); // Ende ist "Gestern"
  const start = new Date(end);
  start.setDate(start.getDate() - 6); // 7 Tage Fenster
  
  const startStr = start.toISOString().split('T')[0];
  const endStr = end.toISOString().split('T')[0];
  
  // 2. Auth & Daten abrufen
  const token = ScriptApp.getOAuthToken(); 
  const userMap = fetchUserMap(token); // Holt die echten Namen aus fitness/{uid}/profile/metadata
  
  const journals = fetchCollectionGroupRange(token, 'journal', startStr, endStr);
  const sessions = fetchCollectionGroupRange(token, 'sessions', startStr, endStr);
  
  if (journals.length === 0 && sessions.length === 0) {
    sendTelegramMessage(props, `ℹ️ <b>Wochen-Review Leer</b>\nKeine Logs im Zeitraum ${startStr} bis ${endStr} gefunden.`);
    return;
  }

  // 3. Namen injizieren
  journals.forEach(j => j._userName = userMap[j._userId] || j._userId);
  sessions.forEach(s => s._userName = userMap[s._userId] || s._userId);

  // 4. KI-Prompt für die Wochenanalyse
  const rawData = `
    Zeitraum: ${startStr} bis ${endStr}
    
    Journals: ${JSON.stringify(journals, null, 2)}
    Sessions: ${JSON.stringify(sessions, null, 2)}
  `;

  const prompt = `
    Du bist das analytische Backend für ein Client-Management-System. 
    Erstelle ein "Weekly Review" für den Head-Coach basierend auf den Klienten-Logs vom ${startStr} bis ${endStr}.
    
    REGELN:
    1. Ignoriere granulare Trainingsdaten (Reps/Weights). Fokussiere dich auf Verhaltensmuster, Konsistenz (Wie viele Sessions?) und Journal-Einträge.
    2. Wer hatte eine perfekte Woche? Wer droht abzurutschen (schlechter Schlaf, verpasste Trainings, schlechte Ernährung)?
    3. Nutze KEIN MARKDOWN! Verwende nur HTML (<b>Text</b>) für Fettgedrucktes und Bindestriche (-) für Listen.
    
    Format:
    <b>🎯 Weekly Review (${startStr} bis ${endStr})</b>
    [2-3 Sätze Gesamtfazit der Woche für alle Klienten]
    
    <b>🟢 Gewinner der Woche (Konsistent)</b>
    - [Name des Klienten]: [Kurze Begründung]
    
    <b>🟡 Check-in Empfohlen (Abweichungen)</b>
    - [Name des Klienten]: [Erkanntes Muster/Problem & Handlungsempfehlung]
    
    <b>🔴 Inaktiv (Follow-up)</b>
    - [Name des Klienten]
    
    Rohdaten:
    ${rawData}
  `;

  // 5. Generieren und Senden
  const briefing = callGeminiAPI(props.getProperty('GEMINI_API_KEY'), prompt);
  
  if (briefing) {
    const message = `🧠 <b>Coach Weekly Briefing</b>\n\n${briefing}`;
    sendTelegramMessage(props, message);
  }
}

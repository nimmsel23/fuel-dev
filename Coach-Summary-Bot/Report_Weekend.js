/**
 * WEEKEND DERAILMENT CHECK
 * Ausführung: Jeden Montag (09:00 Uhr)
 */
function runWeekendDerailmentCheck() {
  const props = PropertiesService.getScriptProperties();
  const token = ScriptApp.getOAuthToken();
  
  const endStr = getDateString(-1); // Sonntag
  const startStr = getDateString(-7); // Letzter Montag
  
  // Für diesen Check brauchen wir Sessions UND Nutrition (falls du die neue Logik verwendest)
  const sessions = fetchCollectionGroupRange(token, 'sessions', startStr, endStr);
  const nutrition = fetchNutritionLogsRange ? fetchNutritionLogsRange(token, startStr, endStr) : [];
  
  const userMap = fetchUserMap(token);
  sessions.forEach(s => s._userName = userMap[s._userId] || s._userId);
  nutrition.forEach(n => n._userName = userMap[n._userId] || n._userId);
  
  const prompt = `
    Du bist ein datengetriebener Coach. Vergleiche das Verhalten der Klienten von Montag-Donnerstag mit Freitag-Sonntag (${startStr} bis ${endStr}).
    
    WICHTIGE REGELN:
    1. Wer zeigt eine massive Diskrepanz am Wochenende? (Fehlende Logs, eskalierende Makros, ausgelassene Workouts).
    2. Wer bleibt auch am Wochenende absolut stabil?
    3. Nutze KEIN MARKDOWN (* oder #). Verwende nur HTML <b> und Bindestriche (-).
    
    Format:
    <b>⚠️ Weekend Derailment Check</b>
    
    <b>🔴 Die Weekend-Offender (Starker Abbruch am Wochenende)</b>
    - [Name]: [Konkrete Analyse der Diskrepanz zwischen unter der Woche und Wochenende]
    
    <b>🟢 Weekend Warriors (Stabil geblieben)</b>
    - [Name]: [Kurzes Lob]
    
    Rohdaten Sessions:
    ${JSON.stringify(sessions, null, 2)}
    Rohdaten Nutrition:
    ${JSON.stringify(nutrition, null, 2)}
  `;

  const analysis = callGeminiAPI(props.getProperty('GEMINI_API_KEY'), prompt);
  if(sessions.length > 0 || nutrition.length > 0) sendTelegramMessage(props, analysis);
}
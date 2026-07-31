/**
 * BURNOUT & OVERREACHING SENSOR
 * Ausführung: Jeden Mittwoch (12:00 Uhr) - Mid-Week Check
 */
function runBurnoutSensor() {
  const props = PropertiesService.getScriptProperties();
  const token = ScriptApp.getOAuthToken();
  
  const endStr = getDateString(0);
  const startStr = getDateString(-7); 
  
  const sessions = fetchCollectionGroupRange(token, 'sessions', startStr, endStr);
  const userMap = fetchUserMap(token);
  
  if (sessions.length === 0) return;
  sessions.forEach(s => s._userName = userMap[s._userId] || s._userId);
  
  const prompt = `
    Du bist ein Experte für Trainingsphysiologie und ZNS-Ermüdung. Analysiere diese Trainings-Sessions der letzten 7 Tage (${startStr} bis ${endStr}).
    
    WICHTIGE REGELN:
    1. Suche nach Alarmzeichen für Overreaching/Burnout: Sinkender Mood-Score gekoppelt mit hohen RPE/Effort-Werten und Schlüsselwörtern in den Notizen (wie müde, schwer, kaputt, Schlaf).
    2. Ignoriere Klienten mit stabilen Werten. Filtere nur die heraus, die kurz vor dem Übertraining stehen.
    3. Nutze KEIN MARKDOWN (* oder #). Verwende nur HTML <b> und Bindestriche (-).
    
    Format:
    <b>🔋 Burnout & ZNS Sensor (Mid-Week Check)</b>
    
    <b>🔴 Deload / Interventionsbedarf</b>
    - [Name]: [Physiologische Analyse basierend auf Mood, RPE und Notizen. Gib eine konkrete Empfehlung für den Rest der Woche.]
    
    Rohdaten:
    ${JSON.stringify(sessions, null, 2)}
  `;

  const analysis = callGeminiAPI(props.getProperty('GEMINI_API_KEY'), prompt);
  sendTelegramMessage(props, analysis);
}
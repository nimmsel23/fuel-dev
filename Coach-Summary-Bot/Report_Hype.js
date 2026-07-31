/**
 * HYPE & WINS RADAR
 * Ausführung: Jeden Freitagabend (18:00 Uhr)
 */
function runHypeAndWins() {
  const props = PropertiesService.getScriptProperties();
  const token = ScriptApp.getOAuthToken();
  
  const endStr = getDateString(0); // Heute (Freitag)
  const startStr = getDateString(-4); // Montag bis Freitag
  
  const sessions = fetchCollectionGroupRange(token, 'sessions', startStr, endStr);
  const userMap = fetchUserMap(token);
  
  if (sessions.length === 0) return;
  sessions.forEach(s => s._userName = userMap[s._userId] || s._userId);
  
  const prompt = `
    Du bist ein motivierender Head-Coach. Finde ausschließlich die 'Wins' und das positive Momentum dieser Trainingswoche (${startStr} bis ${endStr}).
    
    WICHTIGE REGELN:
    1. Ignoriere alles Negative. Suche nach perfekten Streaks, hohem Effort, exzellentem Mood oder begeisterten Notizen.
    2. Bereite mir eine Liste vor, wem ich heute eine kurze Sprachnachricht mit Lob schicken sollte.
    3. Nutze KEIN MARKDOWN (* oder #). Verwende nur HTML <b> und Bindestriche (-).
    
    Format:
    <b>🔥 Friday Hype & Wins Radar</b>
    
    <b>🏆 Top Performer der Woche (Voice-Mail Empfehlung)</b>
    - [Name]: [Exakter Grund für das Lob, konkret auf seine Logs bezogen]
    
    Rohdaten:
    ${JSON.stringify(sessions, null, 2)}
  `;

  const analysis = callGeminiAPI(props.getProperty('GEMINI_API_KEY'), prompt);
  sendTelegramMessage(props, analysis);
}
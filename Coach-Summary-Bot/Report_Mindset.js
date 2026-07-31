/**
 * MINDSET & FRICTION REPORT
 * Ausführung: Alle 14 Tage (z.B. Sonntags)
 */
function runMindsetAnalysis() {
  const props = PropertiesService.getScriptProperties();
  const token = ScriptApp.getOAuthToken();
  
  const endStr = getDateString(-1);
  const startStr = getDateString(-14);
  
  const journals = fetchCollectionGroupRange(token, 'journal', startStr, endStr);
  const userMap = fetchUserMap(token);
  
  if (journals.length === 0) return;
  journals.forEach(j => j._userName = userMap[j._userId] || j._userId);
  
  const prompt = `
    Du bist ein erfahrener Coach mit tiefenpsychologischem Hintergrund.
    Analysiere ausschließlich diese Freitext-Journals der Klienten der letzten 14 Tage (${startStr} bis ${endStr}).
    
    WICHTIGE REGELN:
    1. Suche nach unbewussten Mustern: Wer zeigt Projektionen, wer fällt in eine passive Opferhaltung (Friction/Schatten), wer übernimmt die volle Verantwortung (Locus of Control)?
    2. Identifiziere den primären mentalen Engpass jedes Klienten, basierend auf seiner Wortwahl.
    3. Nutze KEIN MARKDOWN (* oder #). Verwende nur HTML <b> und Bindestriche (-).
    
    Format:
    <b>🧠 Mindset & Friction Report (Letzte 14 Tage)</b>
    [Kurze Einordnung der allgemeinen mentalen Verfassung der Gruppe]
    
    <b>🟢 Klarheit & Verantwortung</b>
    - [Name]: [Analyse der positiven mentalen Muster]
    
    <b>🟡 Innere Widerstände & Reibung</b>
    - [Name]: [Tiefere psychologische Analyse des Engpasses & Empfehlung für das Coaching-Gespräch]
    
    Rohdaten:
    ${JSON.stringify(journals, null, 2)}
  `;

  const analysis = callGeminiAPI(props.getProperty('GEMINI_API_KEY'), prompt);
  sendTelegramMessage(props, analysis);
}
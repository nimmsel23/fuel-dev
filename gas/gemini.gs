// ================================================================
// GEMINI — Fuel Micros Enricher GAS
// ================================================================

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

const MICROS_PROMPT = `Schätze die Kalorien (kcal) und Mikronährstoffe für folgende Mahlzeit/Beschreibung:
"{description}"

WICHTIGE REGELN:
1. Explizite Mengen (z.B. "250g", "500ml", "2 Stück") EXAKT für diese Menge schätzen.
2. Trockenwaren (Reis, Nudeln, etc.) IMMER als Rohgewicht interpretieren, AUSSER es steht "gekocht" dabei.
3. Bei mehreren Komponenten: Summe über alle Komponenten.
4. Ohne Mengenangabe: realistische durchschnittliche Portion.

Antworte NUR mit JSON (keine Erklärungen, keine Markdown-Codeblöcke):
{
  "kcal": 0,
  "vitamin_a_ug": 0, "vitamin_d_ug": 0, "vitamin_e_mg": 0, "vitamin_k_ug": 0,
  "vitamin_c_mg": 0, "vitamin_b1_mg": 0, "vitamin_b2_mg": 0, "vitamin_b3_mg": 0,
  "vitamin_b5_mg": 0, "vitamin_b6_mg": 0, "vitamin_b7_ug": 0, "folate_ug": 0,
  "vitamin_b12_ug": 0, "calcium_mg": 0, "phosphorus_mg": 0, "magnesium_mg": 0,
  "iron_mg": 0, "zinc_mg": 0, "selenium_ug": 0, "iodine_ug": 0,
  "potassium_mg": 0, "sodium_mg": 0, "omega3_mg": 0
}`;

function callGemini_(mealName) {
  const apiKey = requireProp_(PROP.GEMINI_API_KEY);
  const model  = getProp_(PROP.GEMINI_MODEL);
  const url = GEMINI_API_BASE + model + ':generateContent?key=' + apiKey;

  const prompt = MICROS_PROMPT.replace('{description}', mealName);
  const payload = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true,
  });

  const code = res.getResponseCode();
  if (code !== 200) {
    Logger.log('Gemini error ' + code + ': ' + res.getContentText().slice(0, 200));
    return null;
  }

  const data = JSON.parse(res.getContentText());
  const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();

  // JSON aus der Antwort extrahieren
  let json = text;
  if (json.startsWith('```')) {
    json = json.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  }
  try {
    const parsed = JSON.parse(json);
    // Alle keys normalisieren auf float
    const micros = {
      kcal: parseFloat(parsed.kcal || 0) || 0
    };
    for (const k of MICRO_KEYS) {
      micros[k] = parseFloat(parsed[k] || 0) || 0;
    }
    return micros;
  } catch (e) {
    Logger.log('Gemini JSON parse failed for "' + mealName + '": ' + text.slice(0, 200));
    return null;
  }
}

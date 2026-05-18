import https from "https";
import { GEMINI_API_KEY, GEMINI_MODEL } from "../config/constants.mjs";

const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function estimateMacros(description) {
  if (!GEMINI_API_KEY) {
    return { kcal: 0, protein: 0, carbs: 0, fat: 0, _note: "GEMINI_API_KEY not set" };
  }

  const prompt = `Schätze die Nährwerte (pro Portion, durchschnittliche Menge) für: "${description}"

Antworte NUR mit JSON (keine weiteren Erklärungen):
{"kcal": <Zahl>, "protein": <Zahl>, "carbs": <Zahl>, "fat": <Zahl>}`;

  return new Promise((resolve) => {
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    });

    const options = {
      hostname: "generativelanguage.googleapis.com",
      path: `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (result.candidates && result.candidates[0]?.content?.parts[0]?.text) {
            const text = result.candidates[0].content.parts[0].text.trim();
            // Try JSON parse first
            try {
              const macros = JSON.parse(text);
              resolve({
                kcal: Math.round(macros.kcal ?? 0),
                protein: Math.round(macros.protein ?? 0 * 10) / 10,
                carbs: Math.round(macros.carbs ?? 0 * 10) / 10,
                fat: Math.round(macros.fat ?? 0 * 10) / 10,
              });
            } catch {
              // Regex fallback for JSON embedded in text
              const match = text.match(/\{[^{}]*\}/);
              if (match) {
                const macros = JSON.parse(match[0]);
                resolve({
                  kcal: Math.round(macros.kcal ?? 0),
                  protein: Math.round(macros.protein ?? 0 * 10) / 10,
                  carbs: Math.round(macros.carbs ?? 0 * 10) / 10,
                  fat: Math.round(macros.fat ?? 0 * 10) / 10,
                });
              } else {
                resolve({ kcal: 0, protein: 0, carbs: 0, fat: 0, _error: "Could not parse JSON" });
              }
            }
          } else {
            resolve({ kcal: 0, protein: 0, carbs: 0, fat: 0, _error: "No response from Gemini" });
          }
        } catch (e) {
          resolve({ kcal: 0, protein: 0, carbs: 0, fat: 0, _error: e.message });
        }
      });
    });

    req.on("error", (e) => {
      resolve({ kcal: 0, protein: 0, carbs: 0, fat: 0, _error: e.message });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ kcal: 0, protein: 0, carbs: 0, fat: 0, _error: "Timeout" });
    });

    req.write(payload);
    req.end();
  });
}

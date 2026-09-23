import { postJson } from "@api";
import { vertexAI } from "./firebase.js";
import { getGenerativeModel } from "firebase/vertexai";
import { withAiRetry } from "./aiRetry.js";

// Bild → Makros/Mikros. Herausgelöst aus Log/components/ScannerModal.jsx
// (2026-09-23), damit der Shutter-Frontdoor dieselbe Pipeline nutzt, ohne den
// Modal-Dialog zu rendern. ScannerModal ruft dieselbe Funktion auf — es gibt
// weiterhin genau eine Vision-Implementierung.

const PROMPT =
  "Dies ist ein Foto von Essen, einem Barcode oder einer Einkaufsquittung. Identifiziere die Mahlzeit oder Zutaten und schätze die Nährwerte (Makros) sowie die genauen Mikronährstoffe (Vitamine, Mineralstoffe) so genau wie möglich ab. Gib außerdem in 'grams' an, auf welches Gewicht (in Gramm) sich diese Makros beziehen — von einer erkannten Verpackungsangabe oder sonst deiner besten Schätzung der abgebildeten Portionsgröße.";

// Verkleinert auf max. 800px Kantenlänge und liefert rohes base64-JPEG.
export async function compressToBase64(file, maxSize = 800, quality = 0.7) {
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }

  let width = img.width;
  let height = img.height;
  if (width > height && width > maxSize) {
    height *= maxSize / width;
    width = maxSize;
  } else if (height > maxSize) {
    width *= maxSize / height;
    height = maxSize;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality).split(",")[1];
}

// Wirft bei Offline/Analysefehler — Aufrufer zeigen die Meldung und bieten
// einen Retry auf derselben Datei an.
export async function analyzeMealImage(file) {
  if (!file) throw new Error("Kein Bild übergeben.");
  if (!navigator.onLine) {
    throw new Error("Offline: Der Scan braucht eine Verbindung. Das Foto bleibt ausgewählt und kann später erneut versucht werden.");
  }

  const b64Raw = await compressToBase64(file);
  const cloud = import.meta.env.VITE_APP_MODE === "client";
  let macrosResult;

  if (cloud) {
    const { MICRO_KEYS } = await import("./db/firestore/utils.js");
    const { SchemaType } = await import("firebase/vertexai");
    const model = getGenerativeModel(vertexAI, {
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            name: { type: SchemaType.STRING, description: "Identifiziertes Essen" },
            grams: { type: SchemaType.NUMBER, description: "Geschätztes/erkanntes Gewicht der Portion in Gramm, auf das sich die Makros beziehen (z.B. von einer Verpackungsangabe oder geschätzter Portionsgröße)." },
            macros: {
              type: SchemaType.OBJECT,
              properties: {
                kcal: { type: SchemaType.NUMBER },
                protein: { type: SchemaType.NUMBER },
                carbs: { type: SchemaType.NUMBER },
                fat: { type: SchemaType.NUMBER },
              },
            },
            micros: {
              type: SchemaType.OBJECT,
              properties: Object.fromEntries(MICRO_KEYS.map((k) => [k, { type: SchemaType.NUMBER, description: "Wert in mg oder ug" }])),
            },
          },
        },
      },
    });

    const result = await withAiRetry(() => model.generateContent([
      PROMPT,
      { inlineData: { data: b64Raw, mimeType: "image/jpeg" } },
    ]));
    macrosResult = JSON.parse(result.response.text());

    if (macrosResult?.micros) {
      const mealName = macrosResult.name || "Gescannte Mahlzeit";
      await postJson("/nutrition/micros", {
        items: [{
          meal_name: mealName,
          kcal: macrosResult.macros?.kcal || 0,
          ...Object.fromEntries(MICRO_KEYS.map((k) => [k, macrosResult.micros[k] || 0])),
        }],
      }).catch((err) => console.error("Mikros speichern fehlgeschlagen:", err));
    }
  } else {
    macrosResult = await postJson("/nutrition/vision", {
      image_b64: b64Raw,
      mime_type: "image/jpeg",
    });
  }

  if (!macrosResult?.macros) {
    throw new Error("Konnte keine Makros erkennen.");
  }

  return {
    description: macrosResult.name || "Gescannte Mahlzeit",
    grams: macrosResult.grams || null,
    kcal: macrosResult.macros.kcal || 0,
    protein: macrosResult.macros.protein || 0,
    carbs: macrosResult.macros.carbs || 0,
    fat: macrosResult.macros.fat || 0,
  };
}

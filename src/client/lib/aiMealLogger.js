import { postJson } from "@api";
import { withAiRetry } from "./aiRetry.js";

export const isCloud = () =>
  typeof window !== "undefined" &&
  (window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com"));

// "3x Stiegl Hell" → { qty: 3, rest: "Stiegl Hell" }. Ohne Präfix qty=1.
export function parseQuantityPrefix(text) {
  const m = text.trim().match(/^(\d+)\s*[x×]\s*(.+)$/i);
  if (m) return { qty: Math.max(1, parseInt(m[1], 10)), rest: m[2].trim() };
  return { qty: 1, rest: text.trim() };
}

// Sucht einen bereits im Katalog gespeicherten Treffer, bevor überhaupt
// Vertex gefragt wird — bekannte Sachen (mit echten Makros) brauchen keine
// KI-Schätzung, die zudem bei z.B. Getränken gerne mal unzuverlässig ist.
export function findCatalogMatch(catalog, name) {
  const norm = (s) => String(s || "").trim().toLowerCase();
  // Wortgrenzen statt reinem includes() — sonst matcht z.B. der Katalogeintrag
  // "Reis" fälschlich in "Reisepass" oder Freitext, der "reis" nur als Teilwort enthält.
  const hasWord = (haystack, needle) => new RegExp(`(^|\\W)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\W|$)`).test(haystack);
  const target = norm(name);
  if (!target || target.length < 3) return null;
  const label = (i) => norm(i.name || i.description);
  return (
    catalog.find((i) => label(i) === target) ||
    catalog.find((i) => label(i).length > 3 && hasWord(target, label(i))) ||
    catalog.find((i) => label(i).length > 3 && hasWord(label(i), target)) ||
    null
  );
}

// Gemeinsames Response-Schema für Makro/Mikro-Analyse (AI-Logger + Re-Analyse).
export async function analyzeMealText(promptText) {
  const { MICRO_KEYS } = await import("./db/firestore/utils.js");
  const { vertexAI } = await import("./firebase.js");
  const { getGenerativeModel, SchemaType } = await import("firebase/vertexai");
  const model = getGenerativeModel(vertexAI, {
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, description: "Gefundenes Essen" },
          type: { type: SchemaType.STRING, description: "breakfast|lunch|dinner|snack" },
          macros: {
            type: SchemaType.OBJECT,
            properties: {
              kcal: { type: SchemaType.NUMBER },
              protein: { type: SchemaType.NUMBER },
              carbs: { type: SchemaType.NUMBER },
              fat: { type: SchemaType.NUMBER }
            },
            required: ["kcal", "protein", "carbs", "fat"]
          },
          micros: {
            type: SchemaType.OBJECT,
            properties: Object.fromEntries(MICRO_KEYS.map(k => [k, { type: SchemaType.NUMBER, description: "Wert in mg oder ug" }]))
          }
        },
        // Ohne required bleibt macros optional — das Modell konnte es bei
        // Unsicherheit einfach weglassen, statt zu schätzen. Landete dann in
        // der Pending-Queue ("keine Makros erkannt"), obwohl eine Schätzung
        // fast immer möglich gewesen wäre.
        required: ["name", "macros"]
      }
    }
  });

  const prompt = `Analysiere folgende Mahlzeit/Lebensmittel und schätze die Makronährstoffe sowie die absoluten Mikronährstoffe (Vitamine, Mineralstoffe) so exakt wie möglich.
Gib IMMER eine Makro-Schätzung ab, auch bei ungenauer/unvollständiger Beschreibung — nutze plausible Standardportionen statt die Werte wegzulassen.
Ordne außerdem "type" zu (breakfast/lunch/dinner/snack), falls aus dem Text oder der Tageszeit ableitbar, sonst "snack".

Bei bekannten Markenprodukten (z.B. "2 Oreo Cookies", "Milka Schokolade", Fast-Food-Menüs):
nutze dein Wissen über die tatsächliche Nährwerttabelle/Verpackungsangabe des Produkts, nicht
eine grobe generische Schätzung für "Kekse"/"Schokolade" o.ä. Rechne die angegebene Stückzahl
korrekt auf Basis der bekannten Portionsgröße hoch (z.B. "2 Cookies" = 2x Einzelportion laut
Verpackung, nicht 2x eine geschätzte Durchschnittsportion). Bist du dir bei der exakten
Herstellerangabe unsicher, sag das nicht extra — schätze trotzdem, aber möglichst nah an
real bekannten Werten für dieses konkrete Produkt statt an einer Gattungs-Faustregel.

Eingabe: "${promptText}"`;

  const result = await withAiRetry(() => model.generateContent(prompt));
  return JSON.parse(result.response.text());
}

// Loggt einen Katalog-Treffer qty-fach + automatisch verknüpfte Supplemente.
async function logCatalogMatch({ date, qty, match, suppCatalog }) {
  for (let i = 0; i < qty; i++) {
    await postJson("/nutrition/log", {
      date,
      meal: {
        type: match.meal_type || match.type || "meal",
        description: match.name || match.description,
        notes: "",
        kcal: match.kcal || 0, protein: match.protein || 0,
        carbs: match.carbs || 0, fat: match.fat || 0,
        catalog_item_id: match.id,
      },
    });
  }
  for (const suppId of (match.linked_supplement_ids || [])) {
    const suppEntry = suppCatalog.find((s) => s.id === suppId);
    if (!suppEntry) continue;
    await postJson("/supplements/log", {
      date,
      intake: {
        supplement_id: suppEntry.id,
        dose: suppEntry.default_dose ?? 0,
        unit: suppEntry.unit || "g",
        time_of_day: suppEntry.default_time_of_day || "morning",
        notes: `Auto via Meal-Katalog: ${match.name}`,
      },
    });
  }
}

// Zentraler Resolve-Pfad fürs Cloud-Logging: Katalog-Match zuerst, sonst
// Vertex-Schätzung inkl. Mikros. Wird sowohl beim initialen Log-Versuch als
// auch bei der Re-Analyse eines wartenden Pending-Eintrags verwendet — genau
// eine Implementierung statt der früheren Kopie in QuickAiLog.jsx.
export async function resolveMealText({ date, rawText, catalogItems, suppCatalog }) {
  const { qty, rest } = parseQuantityPrefix(rawText);
  const match = findCatalogMatch(catalogItems, rest);
  if (match) {
    await logCatalogMatch({ date, qty, match, suppCatalog });
    return { matched: true };
  }

  const { MICRO_KEYS } = await import("./db/firestore/utils.js");
  const parsed = await analyzeMealText(rawText);
  if (!parsed?.macros) throw new Error("Gemini hat keine Makros erkannt.");

  const mealName = parsed.name || rawText;
  await postJson("/nutrition/log", {
    date,
    meal: {
      type: parsed.type || "snack",
      description: mealName,
      notes: "",
      kcal: parsed.macros.kcal || 0,
      protein: parsed.macros.protein || 0,
      carbs: parsed.macros.carbs || 0,
      fat: parsed.macros.fat || 0,
    },
  });

  if (parsed.micros) {
    await postJson("/nutrition/micros", {
      items: [{
        meal_name: mealName,
        kcal: parsed.macros.kcal || 0,
        ...Object.fromEntries(MICRO_KEYS.map(k => [k, parsed.micros[k] || 0]))
      }]
    });
  }

  return { matched: false, parsed };
}

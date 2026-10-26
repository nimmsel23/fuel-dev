// Vertex/Gemini-Aufrufe der Küche (Bon, Prospekt, Freitext, Rezepte, Einkaufsempfehlungen).
// Muster wie lib/visionScan.js / lib/aiMealLogger.js: gemini-2.5-flash, JSON-Schema, withAiRetry. Wird nur bei
// Bedarf dynamisch importiert, damit der Chunk der Küche klein bleibt.
import { vertexAI } from "./firebase.js";
import { getGenerativeModel, SchemaType } from "firebase/vertexai";
import { withAiRetry } from "./aiRetry.js";
import { compressToBase64 } from "./visionScan.js";
import {
  CATEGORIES, RECEIPT_PROMPT, FLYER_PROMPT, buildPantryParsePrompt, buildDealsTextPrompt, buildRecipePrompt, buildShoppingPrompt,
  normalizeReceiptResult, normalizeParsedItems, normalizeDeals, normalizeRecipes, normalizeCategory,
} from "./kitchenLogic.js";

const S = SchemaType;
const str = (description) => ({ type: S.STRING, ...(description ? { description } : {}) });
const numb = (description) => ({ type: S.NUMBER, ...(description ? { description } : {}) });
const categoryEnum = { type: S.STRING, description: CATEGORIES.map((c) => c.key).join("|") };

const itemSchema = {
  type: S.OBJECT,
  properties: { raw_name: str("Text wie auf dem Bon"), name: str("normalisierter Lebensmittelname"), qty: numb(), unit: str("g|kg|ml|l|Stk|Pkg"), price: numb("Euro"), category: categoryEnum, is_food: { type: S.BOOLEAN } },
  required: ["name"],
};
const SCHEMAS = {
  receipt: { type: S.OBJECT, properties: { store: str(), date: str("YYYY-MM-DD"), total: numb("Euro"), items: { type: S.ARRAY, items: itemSchema } }, required: ["items"] },
  items: { type: S.OBJECT, properties: { items: { type: S.ARRAY, items: { type: S.OBJECT, properties: { name: str(), qty: numb(), unit: str("g|kg|ml|l|Stk|Pkg"), price: numb(), category: categoryEnum }, required: ["name"] } } }, required: ["items"] },
  deals: { type: S.OBJECT, properties: { deals: { type: S.ARRAY, items: { type: S.OBJECT, properties: { store: str(), product: str(), price: numb("Euro"), price_text: str(), valid_until: str("YYYY-MM-DD"), note: str() }, required: ["product"] } } }, required: ["deals"] },
  recipes: {
    type: S.OBJECT,
    properties: {
      recipes: {
        type: S.ARRAY,
        items: {
          type: S.OBJECT,
          properties: {
            title: str(), summary: str(), servings: numb(), minutes: numb(),
            ingredients: { type: S.ARRAY, items: { type: S.OBJECT, properties: { name: str(), qty_text: str(), in_pantry: { type: S.BOOLEAN } }, required: ["name"] } },
            macros: { type: S.OBJECT, properties: { kcal: numb(), protein: numb(), carbs: numb(), fat: numb() } },
            steps: { type: S.ARRAY, items: str() },
            uses_deals: { type: S.ARRAY, items: str() },
          },
          required: ["title", "ingredients"],
        },
      },
    },
    required: ["recipes"],
  },
  shopping: { type: S.OBJECT, properties: { suggestions: { type: S.ARRAY, items: { type: S.OBJECT, properties: { name: str(), reason: str(), category: categoryEnum, deal: str() }, required: ["name"] } } }, required: ["suggestions"] },
};

function requireOnline() {
  if (!navigator.onLine) throw new Error("Offline: Die KI braucht eine Verbindung.");
}

async function generateJson(schemaKey, parts) {
  requireOnline();
  const model = getGenerativeModel(vertexAI, {
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMAS[schemaKey] },
  });
  const result = await withAiRetry(() => model.generateContent(parts));
  return JSON.parse(result.response.text());
}

// Bons haben kleine Schrift → größer komprimieren als beim Essensfoto (800 px).
const imagePart = async (file) => ({ inlineData: { data: await compressToBase64(file, 1600, 0.8), mimeType: "image/jpeg" } });

export async function scanReceiptImage(file) {
  if (!file) throw new Error("Kein Bild übergeben.");
  return normalizeReceiptResult(await generateJson("receipt", [RECEIPT_PROMPT, await imagePart(file)]));
}

export async function scanFlyerImage(file, { fallbackStore = "" } = {}) {
  if (!file) throw new Error("Kein Bild übergeben.");
  return normalizeDeals(await generateJson("deals", [FLYER_PROMPT, await imagePart(file)]), { fallbackStore });
}

export async function parseDealsText(text, { fallbackStore = "" } = {}) {
  return normalizeDeals(await generateJson("deals", [buildDealsTextPrompt(text)]), { fallbackStore });
}

export async function parsePantryText(text) {
  return normalizeParsedItems(await generateJson("items", [buildPantryParsePrompt(text)]));
}

export async function suggestRecipes(args) {
  return normalizeRecipes(await generateJson("recipes", [buildRecipePrompt(args)]), args.pantry);
}

export async function suggestShopping(args) {
  const raw = await generateJson("shopping", [buildShoppingPrompt(args)]);
  return (Array.isArray(raw?.suggestions) ? raw.suggestions : [])
    .map((s) => ({ name: String(s?.name || "").trim(), reason: String(s?.reason || "").trim(), category: normalizeCategory(s?.category), deal: String(s?.deal || "").trim() }))
    .filter((s) => s.name);
}

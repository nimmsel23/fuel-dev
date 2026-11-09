// Reine Logik der Küche (Vorrat, Einkauf, Aktionen) — bewusst ohne Firebase-/Vertex-Import, damit sie testbar ist.
// Die KI-Aufrufe liegen in kitchenAi.js, die Firestore-Zugriffe in db/firestore/pantry.js.
import { todayISO, isISODate } from "../../shared/utils/validation.mjs";

export const CATEGORIES = [
  { key: "obst_gemuese", label: "Obst & Gemüse" },
  { key: "milch_eier", label: "Milch, Käse & Eier" },
  { key: "fleisch_fisch", label: "Fleisch, Wurst & Fisch" },
  { key: "getreide", label: "Reis, Nudeln & Brot" },
  { key: "konserven", label: "Konserven & Vorrat" },
  { key: "tiefkuehl", label: "Tiefkühl" },
  { key: "gewuerze", label: "Öle, Gewürze & Soßen" },
  { key: "snacks", label: "Snacks & Süßes" },
  { key: "getraenke", label: "Getränke" },
  { key: "sonstiges", label: "Sonstiges" },
];
const CATEGORY_KEYS = new Set(CATEGORIES.map((c) => c.key));
export const categoryLabel = (key) => CATEGORIES.find((c) => c.key === key)?.label || "Sonstiges";

export function normalizeCategory(value) {
  const v = String(value || "").trim().toLowerCase();
  if (CATEGORY_KEYS.has(v)) return v;
  return CATEGORIES.find((c) => c.label.toLowerCase() === v)?.key || "sonstiges";
}

// Vergleichsschlüssel für Namen: klein, ohne Satzzeichen, Leerzeichen zusammengezogen.
export function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function displayName(value) {
  const t = String(value || "").replace(/\s+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

// Abgleichschlüssel für "gleiches Lebensmittel": ohne Zahlen/Größen/Fettstufe ("Vollmilch 3,5 %" → "milch"),
// Umlaute und Plural gefaltet ("Tomaten" = "Tomate"), gängige Synonyme vereint. Zusammengesetzte Wörter bleiben
// bewusst getrennt (Buttermilch ≠ Milch, Kokosmilch ≠ Milch).
const KEY_NOISE = new Set(["bio", "frisch", "frische", "frischer", "frisches", "ca", "je", "pro", "stk", "pkg", "st", "g", "kg", "ml", "l", "dag", "er", "x", "prozent", "fett", "h"]);
const KEY_SYNONYMS = { vollmilch: "milch", frischmilch: "milch", trinkmilch: "milch", haltbarmilch: "milch", hmilch: "milch", ei: "eier", freilandeier: "eier", bioeier: "eier", landeier: "eier" };
const foldToken = (t) => {
  const w = t.replace(/ä/g, "a").replace(/ö/g, "o").replace(/ü/g, "u").replace(/ß/g, "ss");
  if (KEY_SYNONYMS[w]) return KEY_SYNONYMS[w];
  if (w.length >= 6 && w.endsWith("en")) return w.slice(0, -2);
  if (w.length >= 5 && /[nes]$/.test(w)) return w.slice(0, -1);
  return w;
};
export function matchKey(value) {
  const base = normalizeName(value);
  const tokens = base.split(" ").filter((t) => t && !/^\d/.test(t) && !KEY_NOISE.has(t)).map(foldToken);
  return tokens.length ? tokens.join(" ") : base;
}

// ── Mengen ────────────────────────────────────────────────────────────────────

// Basiseinheiten: g, ml, Stk, Pkg. kg/l/dl/cl werden umgerechnet, Zählbares (Dose, Flasche …) ist "Stk".
const UNIT_MAP = {
  g: ["g", 1], gr: ["g", 1], gramm: ["g", 1], dag: ["g", 10], kg: ["g", 1000], kilo: ["g", 1000], kilogramm: ["g", 1000],
  ml: ["ml", 1], cl: ["ml", 10], dl: ["ml", 100], l: ["ml", 1000], lt: ["ml", 1000], liter: ["ml", 1000],
  stk: ["Stk", 1], "stück": ["Stk", 1], stueck: ["Stk", 1], st: ["Stk", 1], x: ["Stk", 1],
  dose: ["Stk", 1], dosen: ["Stk", 1], flasche: ["Stk", 1], flaschen: ["Stk", 1], glas: ["Stk", 1], "gläser": ["Stk", 1],
  becher: ["Stk", 1], bund: ["Stk", 1], "tüte": ["Stk", 1], "tüten": ["Stk", 1], scheibe: ["Stk", 1], scheiben: ["Stk", 1],
  pkg: ["Pkg", 1], pk: ["Pkg", 1], pckg: ["Pkg", 1], packung: ["Pkg", 1], packungen: ["Pkg", 1], schachtel: ["Pkg", 1], beutel: ["Pkg", 1],
};

// "1,5" / "2.49" / 3 → Zahl; sonst NaN (deutsches Dezimalkomma wird verstanden).
export const parseNum = (v) => (typeof v === "number" ? v : Number(String(v ?? "").trim().replace(",", ".")));

// → { qty, unit } in Basiseinheit; unbekannte oder fehlende Einheit zählt als Stück.
export function toBaseUnit(qty, unit) {
  const n = parseNum(qty);
  const amount = Number.isFinite(n) && n > 0 ? n : 1;
  const [base, factor] = UNIT_MAP[String(unit || "").trim().toLowerCase().replace(/\.$/, "")] || ["Stk", 1];
  return { qty: Math.round(amount * factor * 100) / 100, unit: base };
}

const fmtNum = (n) => String(Math.round(n * 100) / 100).replace(".", ",");
export function formatQty(qty, unit) {
  const q = Number(qty) || 0;
  if (unit === "g" && q >= 1000) return `${fmtNum(q / 1000)} kg`;
  if (unit === "ml" && q >= 1000) return `${fmtNum(q / 1000)} l`;
  return `${fmtNum(q)} ${unit || "Stk"}`;
}

// Schrittweite für ± im Vorrat.
export function qtyStep(unit) {
  return unit === "g" || unit === "ml" ? 100 : 1;
}

// ── Datum ─────────────────────────────────────────────────────────────────────

// Nur echte Kalendertage ("2026-02-31" rollt in Date.parse sonst still auf März).
const realDay = (iso) => {
  const t = Date.parse(`${iso}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === iso;
};

export function normDate(value) {
  const s = String(value || "").trim();
  if (isISODate(s) && realDay(s)) return s;
  // 24.10.2026 / 24.10.26
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    const iso = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (realDay(iso)) return iso;
  }
  return "";
}

export function daysBetween(fromISO, toISO) {
  return Math.round((Date.parse(`${toISO}T00:00:00Z`) - Date.parse(`${fromISO}T00:00:00Z`)) / 86400000);
}

export function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export const SOON_DAYS = 3;
// → { status: "none" | "expired" | "today" | "soon" | "ok", days } (days = Tage bis Ablauf)
export function expiryStatus(expiresOn, today = todayISO()) {
  const iso = normDate(expiresOn);
  if (!iso) return { status: "none", days: null };
  const days = daysBetween(today, iso);
  if (days < 0) return { status: "expired", days };
  if (days === 0) return { status: "today", days };
  if (days <= SOON_DAYS) return { status: "soon", days };
  return { status: "ok", days };
}

// ── Listen ────────────────────────────────────────────────────────────────────

export function upsertById(list, items) {
  const map = new Map((list || []).map((i) => [i.id, i]));
  for (const item of items) map.set(item.id, { ...(map.get(item.id) || {}), ...item });
  return [...map.values()];
}
export const removeById = (list, id) => (list || []).filter((i) => i.id !== id);

export function groupByCategory(items) {
  const groups = CATEGORIES.map((c) => ({ ...c, items: [] }));
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
  for (const item of items) (byKey[normalizeCategory(item.category)] || byKey.sonstiges).items.push(item);
  for (const g of groups) g.items.sort((a, b) => a.name.localeCompare(b.name, "de"));
  return groups.filter((g) => g.items.length);
}

const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `k_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);

// Alles Firestore-fähig machen: undefined fliegt raus (setDoc lehnt es ab).
export const stripUndefined = (obj) => JSON.parse(JSON.stringify(obj));

// ── Vorrat ────────────────────────────────────────────────────────────────────

export const isInStock = (item) => (Number(item?.qty) || 0) > 0;

// Übernimmt eingehende Posten in den Vorrat. Gleicher Name + gleiche Basiseinheit → Mengen addieren (frühestes
// Ablaufdatum gewinnt), sonst neuer Posten. Liefert den neuen Gesamtstand und nur die geänderten Docs.
export function mergeIntoPantry(existing, incoming, { today = todayISO(), now = new Date().toISOString(), makeId = newId } = {}) {
  const working = (existing || []).map((i) => ({ ...i }));
  const changed = new Map();
  for (const raw of incoming) {
    const name = displayName(raw.name);
    if (!name) continue;
    const { qty, unit } = toBaseUnit(raw.qty, raw.unit);
    const key = matchKey(name);
    const target = working.find((i) => isInStock(i) && matchKey(i.name) === key && i.unit === unit);
    const expires = normDate(raw.expires_on);
    if (target) {
      target.qty = Math.round((target.qty + qty) * 100) / 100;
      if (expires && (!target.expires_on || expires < target.expires_on)) target.expires_on = expires;
      target.bought_on = raw.bought_on ? normDate(raw.bought_on) || today : today;
      target.updated_at = now;
      changed.set(target.id, target);
      continue;
    }
    const item = {
      id: makeId(), name, category: normalizeCategory(raw.category), qty, unit,
      bought_on: normDate(raw.bought_on) || today, source: raw.source || "manual",
      created_at: now, updated_at: now,
      ...(expires ? { expires_on: expires } : {}),
      ...(Number.isFinite(parseNum(raw.price)) && raw.price !== "" && raw.price != null ? { price: parseNum(raw.price) } : {}),
      ...(raw.store ? { store: String(raw.store) } : {}),
    };
    working.push(item);
    changed.set(item.id, item);
  }
  return { items: working, changed: [...changed.values()] };
}

// Steht der Name (oder ein ganzes Wort davon) im Vorrat?
const hasWord = (hay, needle) => ` ${hay} `.includes(` ${needle} `);
export function pantryHas(pantry, name) {
  if (normalizeName(name).length < 3) return false;
  const target = matchKey(name);
  return (pantry || []).some((i) => {
    if (!isInStock(i)) return false;
    const n = matchKey(i.name);
    return n === target || (n.length >= 3 && (hasWord(target, n) || hasWord(n, target)));
  });
}

const STAPLES = new Set(["salz", "pfeffer", "wasser", "leitungswasser", "salz und pfeffer", "prise salz"]);
export const isStaple = (name) => STAPLES.has(normalizeName(name));

// ── Einkaufszettel ────────────────────────────────────────────────────────────

// entries: [{ name, qty_text?, reason?, source? }] — doppelte offene Posten werden übersprungen.
export function addShoppingItems(existing, entries, { now = new Date().toISOString(), makeId = newId } = {}) {
  const open = new Set((existing || []).filter((i) => !i.done).map((i) => matchKey(i.name)));
  const created = [];
  for (const e of entries) {
    const name = displayName(e.name);
    const key = normalizeName(name) ? matchKey(name) : "";
    if (!key || open.has(key)) continue;
    open.add(key);
    created.push({
      id: makeId(), name, done: false, source: e.source || "manual", created_at: now, updated_at: now,
      ...(e.qty_text ? { qty_text: String(e.qty_text) } : {}),
      ...(e.reason ? { reason: String(e.reason) } : {}),
      ...(e.category ? { category: normalizeCategory(e.category) } : {}),
    });
  }
  return created;
}

// Wurde etwas gekauft (Bon/Einkauf), werden passende offene Zettel-Posten abgehakt. Sie gelten dann auch als
// "stocked": der Einkauf ging schon in den Vorrat, der Zettel-Posten soll nicht noch einmal übernommen werden.
export function markShoppingBought(shopping, boughtNames, { now = new Date().toISOString() } = {}) {
  const bought = (boughtNames || []).map(matchKey).filter((n) => n.length >= 3);
  return (shopping || []).filter((i) => !i.done).filter((i) => {
    const n = matchKey(i.name);
    return n.length >= 3 && bought.some((b) => b === n || hasWord(b, n) || hasWord(n, b));
  }).map((i) => ({ ...i, done: true, done_at: now, stocked: true, updated_at: now }));
}

// "500 g", "2 Pkg", "3x", "1,5 l" (qty_text eines Zettel-Postens) → Menge in Basiseinheit; ohne Zahl 1 Stk.
export function parseQtyText(text) {
  const m = String(text || "").trim().match(/^(\d+(?:[.,]\d+)?)\s*(?:x\b)?\s*([a-zäöüß.]*)/i);
  if (!m) return { qty: 1, unit: "Stk" };
  return toBaseUnit(parseNum(m[1]), m[2]);
}

// Erledigte, noch nicht in den Vorrat übernommene Zettel-Posten → Review-Liste (wie beim Bon, alles editierbar).
export function shoppingToReview(shopping) {
  return (shopping || []).filter((i) => i.done && !i.stocked).map((i) => ({
    sel: true, shopping_id: i.id, name: i.name, ...parseQtyText(i.qty_text),
    price: null, category: normalizeCategory(i.category), is_food: true, expires_on: "",
  }));
}

export function markStocked(shopping, ids, { now = new Date().toISOString() } = {}) {
  const set = new Set(ids);
  return (shopping || []).filter((i) => set.has(i.id)).map((i) => ({ ...i, stocked: true, updated_at: now }));
}

// Neu auf den Zettel/Vorrat vorgeschlagene Dinge, die schon da sind, fliegen raus.
export function filterSuggestions(list, pantry, shopping) {
  const open = new Set((shopping || []).filter((i) => !i.done).map((i) => matchKey(i.name)));
  return (list || []).filter((s) => !pantryHas(pantry, s.name) && !open.has(matchKey(s.name)));
}

// ── Bon / Review ──────────────────────────────────────────────────────────────

// Rohantwort des Modells → Review-Liste (alles editierbar, Nicht-Lebensmittel standardmäßig abgewählt).
const NON_FOOD_NAME = /^(rabatt|pfand|leergut|bonus|coupon|gutschein|summe|zwischensumme|gesamt|tragetasche|tasche|sackerl|plastiksackerl|papiertasche)\b/i;

export function normalizeReceiptResult(raw, { today = todayISO() } = {}) {
  const items = (Array.isArray(raw?.items) ? raw.items : []).map((r) => {
    const { qty, unit } = toBaseUnit(r?.qty, r?.unit);
    const price = parseNum(r?.price);
    // Rabatt-/Pfandzeilen sind nie Vorrat — auch wenn das Modell sie als Lebensmittel markiert.
    const isFood = r?.is_food !== false && !(Number.isFinite(price) && price < 0) && !NON_FOOD_NAME.test(String(r?.name || r?.raw_name || "").trim());
    return {
      sel: isFood,
      raw_name: String(r?.raw_name || r?.name || ""),
      name: displayName(r?.name || r?.raw_name),
      qty, unit,
      price: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : null,
      category: normalizeCategory(r?.category),
      is_food: isFood,
      expires_on: "",
    };
  }).filter((i) => i.name);
  const total = parseNum(raw?.total);
  const sum = items.reduce((s, i) => s + (i.price || 0), 0);
  return {
    store: String(raw?.store || "").trim(),
    date: normDate(raw?.date) || today,
    total: Number.isFinite(total) && total > 0 ? Math.round(total * 100) / 100 : Math.round(sum * 100) / 100,
    items,
  };
}

export function reviewToIncoming(items, { store = "", date = todayISO(), source = "receipt" } = {}) {
  return items.filter((i) => i.sel && normalizeName(i.name)).map((i) => ({
    name: i.name, qty: i.qty, unit: i.unit, category: i.category, price: i.price ?? undefined,
    expires_on: i.expires_on || undefined, bought_on: date, store: store || undefined, source,
  }));
}

// Derselbe Bon ein zweites Mal? Gleiches Datum und entweder gleiche Endsumme oder dieselben Positionen.
// → der bereits gespeicherte Bon oder null. Verhindert, dass ein doppelt gescannter Bon den Vorrat verdoppelt.
export function findDuplicateReceipt(receipts, draft) {
  const names = (items) => [...new Set((items || []).filter((i) => i.sel !== false).map((i) => matchKey(i.name)).filter(Boolean))].sort().join("|");
  const draftNames = names(draft?.items);
  const total = Number(draft?.total) || 0;
  return (receipts || []).find((r) => {
    if (r.date !== draft?.date) return false;
    if (total > 0 && Math.abs((Number(r.total) || 0) - total) < 0.01) return true;
    return draftNames !== "" && names(r.items) === draftNames;
  }) || null;
}

// Freitext-Parse ("2 Packungen Nudeln, 1 l Milch") → gleiche Review-Struktur wie beim Bon.
export function normalizeParsedItems(raw) {
  return normalizeReceiptResult({ items: (Array.isArray(raw?.items) ? raw.items : []).map((i) => ({ ...i, is_food: true })) }).items;
}

// ── Aktionen (nur aus selbst eingelesenen Prospekten) ────────────────────────

export function normalizeDeals(raw, { fallbackStore = "" } = {}) {
  return (Array.isArray(raw?.deals) ? raw.deals : []).map((d) => {
    const price = Number(d?.price);
    return {
      sel: true,
      store: String(d?.store || fallbackStore || "").trim(),
      product: displayName(d?.product),
      price: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : null,
      price_text: String(d?.price_text || "").trim(),
      valid_until: normDate(d?.valid_until),
      note: String(d?.note || "").trim(),
    };
  }).filter((d) => d.product);
}

const DEFAULT_DEAL_DAYS = 7;
// Abgelaufene Aktionen ausblenden. Ohne Gültigkeitsdatum gilt eine Aktion 7 Tage ab Einlesen.
export function activeDeals(deals, today = todayISO()) {
  return (deals || []).filter((d) => {
    const until = normDate(d.valid_until) || (d.created_at ? addDays(String(d.created_at).slice(0, 10), DEFAULT_DEAL_DAYS) : "");
    return !until || until >= today;
  });
}

// Seit über 30 Tagen abgelaufene Aktionen: werden beim Laden still gelöscht (Firestore wächst sonst unbegrenzt).
export const STALE_DEAL_DAYS = 30;
export function staleDeals(deals, today = todayISO()) {
  const cutoff = addDays(today, -STALE_DEAL_DAYS);
  return (deals || []).filter((d) => {
    const until = normDate(d.valid_until) || (d.created_at ? addDays(String(d.created_at).slice(0, 10), DEFAULT_DEAL_DAYS) : "");
    return !!until && until < cutoff;
  });
}

export function reviewToDeals(items, { now = new Date().toISOString(), makeId = newId } = {}) {
  return items.filter((d) => d.sel && d.product).map((d) => ({
    id: makeId(), store: d.store, product: d.product, price_text: d.price_text, note: d.note,
    created_at: now, updated_at: now,
    ...(d.price != null ? { price: d.price } : {}),
    ...(d.valid_until ? { valid_until: d.valid_until } : {}),
  }));
}

// ── Rezepte ───────────────────────────────────────────────────────────────────

const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0; };

// Modellantwort säubern; "im Vorrat" wird gegen den echten Vorrat gegengeprüft (Salz/Pfeffer/Wasser zählen immer).
export function normalizeRecipes(raw, pantry) {
  return (Array.isArray(raw?.recipes) ? raw.recipes : []).map((r) => ({
    title: String(r?.title || "").trim(),
    summary: String(r?.summary || "").trim(),
    servings: Math.max(1, num(r?.servings) || 1),
    minutes: num(r?.minutes),
    macros: { kcal: num(r?.macros?.kcal), protein: num(r?.macros?.protein), carbs: num(r?.macros?.carbs), fat: num(r?.macros?.fat) },
    ingredients: (Array.isArray(r?.ingredients) ? r.ingredients : []).map((i) => {
      const name = String(i?.name || "").trim();
      return { name, qty_text: String(i?.qty_text || "").trim(), in_pantry: isStaple(name) || pantryHas(pantry, name) };
    }).filter((i) => i.name),
    steps: (Array.isArray(r?.steps) ? r.steps : []).map((s) => String(s).trim()).filter(Boolean),
    uses_deals: (Array.isArray(r?.uses_deals) ? r.uses_deals : []).map((s) => String(s).trim()).filter(Boolean),
  })).filter((r) => r.title);
}
export const missingIngredients = (recipe) => recipe.ingredients.filter((i) => !i.in_pantry);

// ── Fehlermeldungen ───────────────────────────────────────────────────────────

// Technische Fehler (Firebase, Vertex, Browser) → verständliches Deutsch. Eigene deutsche Meldungen bleiben unverändert.
export function friendlyError(error) {
  if (error == null || error === "") return "Unbekannter Fehler. Bitte erneut versuchen.";
  // Bild konnte nicht dekodiert werden: <img>.onerror liefert ein Event ohne message (z. B. HEIC am Desktop).
  if (typeof error === "object" && !error.message && error.type === "error") {
    return "Das Foto konnte nicht gelesen werden. Bitte als JPEG/PNG aufnehmen oder ein anderes Foto wählen.";
  }
  const msg = String(error.message || error);
  if (/not authenticated/i.test(msg)) return "Bitte zuerst anmelden.";
  if (/^offline/i.test(msg)) return msg;
  if (/app.?check|\b403\b|permission[_ -]?denied|forbidden|api.?key/i.test(msg)) return "Die KI ist gerade nicht freigegeben (Berechtigung/App Check). Bitte die App neu laden und erneut versuchen.";
  if (/\b429\b|quota|resource[_ -]?exhausted|rate.?limit|too many/i.test(msg)) return "Das KI-Kontingent ist gerade erschöpft. Bitte in ein paar Minuten erneut versuchen.";
  if (/failed to fetch|network|unavailable|timeout|timed out|deadline/i.test(msg)) return "Keine stabile Verbindung. Bitte erneut versuchen.";
  if (/json|unexpected token|syntaxerror|safety|blocked|text not available|candidate/i.test(msg)) return "Die KI-Antwort war nicht lesbar oder wurde blockiert. Bitte erneut versuchen (bei Fotos: schärfer und besser ausgeleuchtet).";
  return msg || "Unbekannter Fehler. Bitte erneut versuchen.";
}

// ── Prompts ───────────────────────────────────────────────────────────────────

export function profileLine(settings = {}) {
  const parts = [];
  if (settings.diet_type) parts.push(`Ernährungsform: ${settings.diet_type}`);
  if (settings.intolerances) parts.push(`Unverträglichkeiten/Allergien (strikt meiden): ${settings.intolerances}`);
  if (settings.nutrition_goal) parts.push(`Ziel: ${settings.nutrition_goal}`);
  if (settings.protein_goal) parts.push(`Proteinziel: ${settings.protein_goal} g/Tag`);
  if (settings.kcal_goal) parts.push(`Kalorienziel: ${settings.kcal_goal} kcal/Tag`);
  return parts.length ? parts.join("; ") : "keine besonderen Angaben";
}

export function pantryLines(pantry, today = todayISO()) {
  const items = (pantry || []).filter(isInStock);
  if (!items.length) return "(Vorrat ist leer)";
  return items.map((i) => {
    const exp = expiryStatus(i.expires_on, today);
    const tag = exp.status === "expired" ? " [abgelaufen]" : exp.status === "today" || exp.status === "soon" ? ` [läuft bald ab: ${i.expires_on}]` : "";
    return `- ${i.name}: ${formatQty(i.qty, i.unit)}${tag}`;
  }).join("\n");
}

export function dealLines(deals) {
  if (!deals?.length) return "";
  return deals.map((d) => `- ${d.product}${d.price_text ? ` (${d.price_text})` : d.price != null ? ` (${fmtNum(d.price)} €)` : ""}${d.store ? ` bei ${d.store}` : ""}${d.valid_until ? ` bis ${d.valid_until}` : ""}`).join("\n");
}

export const RECEIPT_PROMPT = `Dies ist das Foto eines Kassenbons/einer Quittung (Lebensmittel, DACH-Raum).
Lies Händler, Datum (YYYY-MM-DD) und Endsumme und alle Positionen aus.
Für jede Position: "raw_name" = Text wie auf dem Bon, "name" = normalisierter, gut lesbarer Lebensmittelname ohne Marken-Kürzel und ohne Gewichtsangabe (z.B. "Vollmilch", "Spaghetti"), "qty" + "unit" (g, kg, ml, l, Stk, Pkg; Menge aus Bon/Gewicht, sonst 1 Stk), "price" = Positionspreis in Euro, "category" (obst_gemuese, milch_eier, fleisch_fisch, getreide, konserven, tiefkuehl, gewuerze, snacks, getraenke, sonstiges), "is_food" = true nur für Essen/Trinken.
"price" ist immer der Gesamtpreis der Zeile, nicht der Einzelpreis: Zeilen wie "3 x 0,89" → qty 3, unit Stk, price 2,67. Gewichtsware ("0,532 kg x 1,99") → qty 0,532, unit kg, price = Zeilensumme. Zahlen mit Dezimalkomma als Zahl ausgeben (2,49 → 2.49).
Pfand, Tüten, Rabatte/Bonuszeilen, Drogerie- und Haushaltsartikel: is_food=false (Rabattzeilen und Summenzeilen gar nicht als Position aufnehmen, Preise nie negativ).
Rate nichts, was nicht auf dem Bon steht; unleserliche Positionen weglassen.`;

export const FLYER_PROMPT = `Dies ist ein Prospekt-/Aktionsfoto eines Händlers (DACH-Raum). Extrahiere nur Lebensmittel-Aktionen, die wirklich lesbar sind.
Pro Aktion: "store" (Händler, falls erkennbar), "product" (Produktname), "price" (Aktionspreis in Euro als Zahl, falls eindeutig), "price_text" (Preis wie abgedruckt, z.B. "1,99 € / 500 g" oder "-30%"), "valid_until" (Ende der Gültigkeit YYYY-MM-DD, falls abgedruckt, sonst leer), "note" (z.B. Menge/Bedingung).
Erfinde keine Angebote und keine Preise.`;

export const buildPantryParsePrompt = (text) => `Zerlege diese Einkaufs-/Vorratsangabe in einzelne Lebensmittelposten (DACH-Raum, Deutsch): "${text}"
Pro Posten "name" (normalisiert, ohne Mengenangabe), "qty" (Zahl, Dezimalkomma als Punkt; "20 dag" = 200 g, "1 Pkg" = 1 Pkg) und "unit" (g, kg, ml, l, Stk, Pkg; ohne Angabe 1 Stk) sowie "category" (obst_gemuese, milch_eier, fleisch_fisch, getreide, konserven, tiefkuehl, gewuerze, snacks, getraenke, sonstiges). "price" nur, wenn genannt.`;

export const buildDealsTextPrompt = (text) => `Extrahiere die Lebensmittel-Aktionen aus diesem Text (Prospekt/Aktionsliste). Erfinde nichts, lass fehlende Felder leer.
Pro Aktion: store, product, price (Euro, Zahl), price_text, valid_until (YYYY-MM-DD), note.

Text:
"""
${text}
"""`;

export function buildRecipePrompt({ pantry, deals = [], wishes = "", settings = {}, today = todayISO() }) {
  const dealPart = deals.length
    ? `\nAktuelle Aktionen (vom Nutzer aus Prospekten eingelesen — nur diese gelten als Aktionen, nenne keine weiteren):\n${dealLines(deals)}\nBevorzuge, wo es sinnvoll passt, Rezepte mit diesen Aktionsprodukten und führe sie unter "uses_deals" auf.\n`
    : "";
  return `Du bist Ernährungs-Coach und Koch. Heute ist ${today}. Schlage 3 bis 5 alltagstaugliche Rezepte vor, die überwiegend aus dem Vorrat kochbar sind (Salz, Pfeffer, Wasser darf man voraussetzen). Vorrat mit baldigem Ablaufdatum zuerst verbrauchen.
Profil: ${profileLine(settings)}
Wünsche: ${wishes.trim() || "keine"}

Vorrat:
${pantryLines(pantry, today)}
${dealPart}
Pro Rezept: "title", "summary" (1 Satz), "servings", "minutes", "ingredients" (jeweils "name", "qty_text", "in_pantry" = steht im Vorrat), "macros" pro Portion (kcal, protein, carbs, fat — grobe Schätzung), "steps" (3-6 kurze Schritte), "uses_deals".
Als [abgelaufen] markierte Posten nicht verwenden. Weniger fehlende Zutaten sind besser; erfinde keine Zutaten im Vorrat.`;
}

export function buildShoppingPrompt({ pantry, receipts = [], deals = [], shopping = [], settings = {}, today = todayISO() }) {
  const recent = receipts.slice(0, 5).map((r) => `- ${r.date}${r.store ? ` ${r.store}` : ""}: ${(r.items || []).map((i) => i.name).slice(0, 15).join(", ")}`).join("\n") || "(keine)";
  const dealPart = deals.length ? `\nAktuelle Aktionen (nur vom Nutzer eingelesen):\n${dealLines(deals)}\n` : "";
  const open = shopping.filter((i) => !i.done).map((i) => i.name).join(", ") || "(leer)";
  return `Du bist Ernährungs-Coach. Heute ist ${today}. Empfiehl 5 bis 10 Lebensmittel, die für eine ausgewogene Woche im Vorrat fehlen oder bald aufgebraucht sind. Begründe jeden Vorschlag in einem kurzen Satz ("reason"), ordne "category" zu (obst_gemuese, milch_eier, fleisch_fisch, getreide, konserven, tiefkuehl, gewuerze, snacks, getraenke, sonstiges). Schlage nichts vor, was schon im Vorrat oder auf dem Einkaufszettel steht.
Profil: ${profileLine(settings)}

Vorrat:
${pantryLines(pantry, today)}

Auf dem Einkaufszettel: ${open}

Letzte Einkäufe:
${recent}
${dealPart}${deals.length ? 'Wenn ein Vorschlag zu einer Aktion passt, nenne sie in "deal" (Produkt + Händler).\n' : ""}`;
}

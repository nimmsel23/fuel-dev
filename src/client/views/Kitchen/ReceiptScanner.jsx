import { useState } from "react";
import { Receipt, Sparkles, Loader2, X } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { todayISO } from "../../../shared/utils/validation.mjs";
import { mergeIntoPantry, markShoppingBought, reviewToIncoming, normalizeName } from "../../lib/kitchenLogic.js";
import { useCommitPurchase } from "../../hooks/useKitchen.js";
import { cardClass, fieldClass, primaryBtn, ghostBtn, SectionTitle, ImageCapture, ItemReview, ErrorNote } from "./shared.jsx";

// Kassenbon fotografieren oder Einkauf eintippen → KI liest die Positionen → Review → Vorrat + Bon-Verlauf.
// Das Foto wird nach dem Auslesen verworfen, gespeichert werden nur die bestätigten Positionen.
const analyzePhoto = async (file) => (await import("../../lib/kitchenAi.js")).scanReceiptImage(file);

export default function ReceiptScanner({ pantry, pantryReady, shopping, onClose }) {
  const commit = useCommitPurchase();
  const [mode, setMode] = useState("photo");
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const parseText = async () => {
    setParsing(true);
    setError(null);
    try {
      const { parsePantryText } = await import("../../lib/kitchenAi.js");
      const items = await parsePantryText(text.trim());
      if (!items.length) throw new Error("Keine Lebensmittel erkannt. Bitte anders formulieren, z. B. „2 Packungen Nudeln, 1 l Milch“.");
      setDraft({ store: "", date: todayISO(), total: 0, items, source: "manual" });
    } catch (e) { setError(e); }
    finally { setParsing(false); }
  };

  const selected = draft ? draft.items.filter((i) => i.sel && normalizeName(i.name)) : [];

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const store = draft.store.trim();
      const incoming = reviewToIncoming(draft.items, { store, date: draft.date, source: draft.source });
      const { changed } = mergeIntoPantry(pantry, incoming);
      const ticked = markShoppingBought(shopping, incoming.map((i) => i.name));
      const receipt = {
        id: crypto.randomUUID(), store, date: draft.date, source: draft.source, created_at: new Date().toISOString(),
        ...(draft.total > 0 ? { total: draft.total } : {}),
        items: selected.map(({ name, qty, unit, price, category }) => ({ name, qty, unit, category, ...(price != null ? { price } : {}) })),
      };
      await commit({ pantryChanged: changed, receipt, tickedShopping: ticked });
      onClose();
    } catch (e) { setError(e); setSaving(false); }
  };

  return (
    <section className={cardClass}>
      <SectionTitle icon={Receipt} title="Einkauf erfassen" hint="Kassenbon fotografieren oder eintippen — die KI liest die Positionen, du prüfst sie, dann landen sie im Vorrat.">
        <button type="button" onClick={onClose} aria-label="Schließen" className="rounded-full p-1 text-slate-400 hover:bg-white/5 hover:text-slate-100"><X className="h-5 w-5" /></button>
      </SectionTitle>

      {!draft && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {[["photo", "Bon-Foto"], ["text", "Eintippen"]].map(([key, label]) => (
              <button key={key} type="button" aria-pressed={mode === key} onClick={() => { setMode(key); setError(null); }}
                className={twMerge("rounded-full border px-4 py-1.5 text-sm", mode === key ? "border-orange-400/60 bg-orange-400/10 text-orange-200" : "border-white/10 text-slate-400 hover:text-slate-200")}>{label}</button>
            ))}
          </div>
          {mode === "photo" ? (
            <ImageCapture analyze={analyzePhoto} onResult={(receipt) => {
              if (!receipt.items.length) { setError(new Error("Auf dem Foto wurden keine Positionen erkannt. Bon flach hinlegen, gut ausleuchten und erneut versuchen.")); return; }
              setError(null);
              setDraft({ ...receipt, source: "receipt" });
            }} busyText="Gemini liest den Bon …" />
          ) : (
            <div className="space-y-3">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="z. B. 2 Packungen Nudeln, 1 l Milch, 10 Eier, 20 dag Jausenspeck"
                className={twMerge(fieldClass, "w-full resize-y")} />
              <button type="button" onClick={parseText} disabled={!text.trim() || parsing} className={primaryBtn}>
                {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Auslesen
              </button>
            </div>
          )}
          <ErrorNote error={error} />
        </div>
      )}

      {draft && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-400">Händler
              <input value={draft.store} onChange={(e) => setDraft({ ...draft, store: e.target.value })} placeholder="optional" className={twMerge(fieldClass, "mt-1 w-full")} />
            </label>
            <label className="text-xs text-slate-400">Datum
              <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className={twMerge(fieldClass, "mt-1 w-full")} />
            </label>
          </div>
          <ItemReview items={draft.items} onChange={(items) => setDraft({ ...draft, items })} />
          <p className="text-xs text-slate-500">
            {selected.length} von {draft.items.length} Positionen werden übernommen
            {draft.total > 0 && ` · Bon-Summe ${String(draft.total.toFixed(2)).replace(".", ",")} €`}
            . Passende offene Posten auf dem Einkaufszettel werden abgehakt.
          </p>
          <ErrorNote error={error} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={!selected.length || saving || !pantryReady} className={primaryBtn}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}In den Vorrat übernehmen
            </button>
            <button type="button" onClick={() => { setDraft(null); setError(null); }} disabled={saving} className={ghostBtn}>Zurück</button>
          </div>
        </div>
      )}
    </section>
  );
}

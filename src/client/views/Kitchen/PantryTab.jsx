import { lazy, Suspense, useState } from "react";
import { Refrigerator, Sparkles, Loader2, Plus, Minus, Check, CalendarClock } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { mergeIntoPantry, reviewToIncoming, groupByCategory, isInStock, formatQty, qtyStep, expiryStatus, normalizeName } from "../../lib/kitchenLogic.js";
import { usePantry, usePantryMutations } from "../../hooks/useKitchen.js";
import { cardClass, fieldClass, primaryBtn, ghostBtn, iconBtn, SectionTitle, ErrorNote, ExpiryBadge, ItemReview } from "./shared.jsx";

const RecipeSuggestions = lazy(() => import("./RecipeSuggestions.jsx"));

// Freitext ("2 Packungen Nudeln, 1 l Milch") → KI zerlegt → Review → Vorrat.
function QuickAdd({ pantry, ready }) {
  const { save } = usePantryMutations();
  const [text, setText] = useState("");
  const [items, setItems] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);

  const parse = async () => {
    setParsing(true);
    setError(null);
    try {
      const { parsePantryText } = await import("../../lib/kitchenAi.js");
      const parsed = await parsePantryText(text.trim());
      if (!parsed.length) throw new Error("Keine Lebensmittel erkannt. Bitte anders formulieren.");
      setItems(parsed);
    } catch (e) { setError(e); }
    finally { setParsing(false); }
  };
  const confirm = () => {
    const { changed } = mergeIntoPantry(pantry, reviewToIncoming(items, { source: "ai" }));
    if (changed.length) save.mutate(changed);
    setItems(null);
    setText("");
  };
  const selected = items?.filter((i) => i.sel && normalizeName(i.name)).length || 0;

  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim() && !parsing) parse(); }} className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Was ist da? z. B. 2 Packungen Nudeln, 1 l Milch, 6 Eier" className={twMerge(fieldClass, "min-w-0 flex-1")} />
        <button type="submit" disabled={!text.trim() || parsing || !ready} className={primaryBtn}>
          {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Hinzufügen
        </button>
      </form>
      <ErrorNote error={error} />
      {items && (
        <div className="space-y-3 rounded-2xl border border-orange-400/20 bg-orange-400/5 p-3">
          <ItemReview items={items} onChange={setItems} />
          <div className="flex gap-2">
            <button type="button" onClick={confirm} disabled={!selected} className={primaryBtn}>{selected} übernehmen</button>
            <button type="button" onClick={() => setItems(null)} className={ghostBtn}>Verwerfen</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PantryRow({ item, onChange, onRemove }) {
  const [editDate, setEditDate] = useState(false);
  const step = qtyStep(item.unit);
  const bump = (delta) => {
    const qty = Math.round((item.qty + delta) * 100) / 100;
    if (qty <= 0) onRemove(item.id); else onChange({ ...item, qty });
  };
  const status = expiryStatus(item.expires_on).status;
  return (
    <li className={twMerge("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border bg-slate-950/50 px-3 py-2",
      status === "expired" ? "border-red-500/30" : status === "today" || status === "soon" ? "border-amber-400/30" : "border-white/10")}>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-slate-100">{item.name}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <ExpiryBadge expiresOn={item.expires_on} />
          {editDate && (
            <input type="date" autoFocus value={item.expires_on || ""} onChange={(e) => onChange({ ...item, expires_on: e.target.value })} onBlur={() => setEditDate(false)} aria-label="Ablaufdatum" className={twMerge(fieldClass, "py-1 text-xs")} />
          )}
        </div>
      </div>
      <button type="button" onClick={() => setEditDate((v) => !v)} title="Ablaufdatum setzen" aria-label="Ablaufdatum setzen" className={twMerge(iconBtn, "hover:text-amber-300")}><CalendarClock className="h-4 w-4" /></button>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => bump(-step)} aria-label="Weniger" className={twMerge(iconBtn, "text-slate-400 hover:text-slate-100")}><Minus className="h-4 w-4" /></button>
        <span className="min-w-[4.5rem] text-center text-sm tabular-nums text-slate-200">{formatQty(item.qty, item.unit)}</span>
        <button type="button" onClick={() => bump(step)} aria-label="Mehr" className={twMerge(iconBtn, "text-slate-400 hover:text-slate-100")}><Plus className="h-4 w-4" /></button>
      </div>
      <button type="button" onClick={() => onRemove(item.id)} title="Verbraucht" aria-label={`${item.name} verbraucht`} className={twMerge(iconBtn, "hover:bg-emerald-400/10 hover:text-emerald-300")}><Check className="h-4 w-4" /></button>
    </li>
  );
}

export default function PantryTab() {
  const { data: pantry = [], isLoading, error } = usePantry();
  const { save, remove } = usePantryMutations();
  const stock = pantry.filter(isInStock);
  const groups = groupByCategory(stock);
  const expiring = stock.filter((i) => ["expired", "today", "soon"].includes(expiryStatus(i.expires_on).status)).length;

  return (
    <div className="space-y-5">
      <section className={cardClass}>
        <SectionTitle icon={Refrigerator} title="Vorrat" hint={stock.length ? `${stock.length} Posten zuhause${expiring ? ` · ${expiring} laufen bald ab oder sind abgelaufen` : ""}` : "Hier steht, was zuhause vorrätig ist."} />
        <QuickAdd pantry={pantry} ready={!isLoading} />
        <ErrorNote error={error} />
        {isLoading && <p className="mt-4 animate-pulse text-sm text-slate-500">Laden …</p>}
        {!isLoading && !stock.length && <p className="mt-4 text-sm text-slate-500">Noch nichts im Vorrat. Tippe oben auf, was du hast, oder scanne im Tab „Einkauf“ einen Kassenbon.</p>}
        <div className="mt-5 space-y-5">
          {groups.map((g) => (
            <div key={g.key}>
              <h4 className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">{g.label}</h4>
              <ul className="space-y-2">
                {g.items.map((item) => <PantryRow key={item.id} item={item} onChange={(next) => save.mutate([next])} onRemove={(id) => remove.mutate(id)} />)}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <Suspense fallback={<div className="py-6 text-center text-sm text-slate-500 animate-pulse">Laden …</div>}>
        <RecipeSuggestions pantry={pantry} />
      </Suspense>
    </div>
  );
}

import { lazy, Suspense, useState } from "react";
import { ShoppingCart, Receipt, Sparkles, Loader2, Plus, Trash2, Lightbulb, History } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { useSettings } from "../../store.js";
import { addShoppingItems, categoryLabel } from "../../lib/kitchenLogic.js";
import {
  usePantry, useShopping, useShoppingMutations, useReceipts, useReceiptMutations, useActiveDeals,
} from "../../hooks/useKitchen.js";
import { cardClass, fieldClass, primaryBtn, ghostBtn, SectionTitle, ErrorNote } from "./shared.jsx";
import DealsPanel from "./DealsPanel.jsx";

const ReceiptScanner = lazy(() => import("./ReceiptScanner.jsx"));

const eur = (n) => `${String(Number(n).toFixed(2)).replace(".", ",")} €`;
const shortDate = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : "");

function ShoppingList({ shopping }) {
  const { save, remove } = useShoppingMutations();
  const [name, setName] = useState("");
  const open = shopping.filter((i) => !i.done).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
  const done = shopping.filter((i) => i.done);

  const add = (e) => {
    e.preventDefault();
    const created = addShoppingItems(shopping, [{ name }]);
    if (created.length) save.mutate(created);
    setName("");
  };
  const toggle = (item) => save.mutate([{ ...item, done: !item.done, ...(item.done ? {} : { done_at: new Date().toISOString() }) }]);

  return (
    <section className={cardClass}>
      <SectionTitle icon={ShoppingCart} title="Einkaufszettel" hint={open.length ? `${open.length} offen` : "Nichts zu besorgen."} />
      <form onSubmit={add} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Was fehlt?" className={twMerge(fieldClass, "min-w-0 flex-1")} />
        <button type="submit" disabled={!name.trim()} className={primaryBtn}><Plus className="h-4 w-4" />Hinzufügen</button>
      </form>
      {open.length > 0 && (
        <ul className="mt-4 space-y-2">
          {open.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
              <input type="checkbox" checked={false} onChange={() => toggle(item)} aria-label={`${item.name} erledigt`} className="h-4 w-4 accent-orange-400" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-slate-100">{item.name}{item.qty_text ? <span className="text-slate-500"> · {item.qty_text}</span> : null}</div>
                {item.reason && <div className="truncate text-xs text-slate-500">{item.reason}</div>}
              </div>
              <button type="button" onClick={() => remove.mutate(item.id)} aria-label={`${item.name} entfernen`} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-400/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-300">{done.length} erledigt</summary>
          <ul className="mt-2 space-y-1">
            {done.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-1 text-sm text-slate-500">
                <input type="checkbox" checked onChange={() => toggle(item)} aria-label={`${item.name} wieder öffnen`} className="h-4 w-4 accent-orange-400" />
                <span className="flex-1 truncate line-through">{item.name}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => done.forEach((i) => remove.mutate(i.id))} className={twMerge(ghostBtn, "mt-2")}><Trash2 className="h-4 w-4" />Erledigte löschen</button>
        </details>
      )}
    </section>
  );
}

function ShoppingAdvice({ pantry, shopping }) {
  const settings = useSettings();
  const { data: receipts = [] } = useReceipts();
  const { data: deals } = useActiveDeals();
  const { save } = useShoppingMutations();
  const [ideas, setIdeas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const { suggestShopping } = await import("../../lib/kitchenAi.js");
      const list = await suggestShopping({ pantry, receipts, deals, shopping, settings });
      if (!list.length) throw new Error("Keine Empfehlungen erhalten. Bitte noch einmal versuchen.");
      setIdeas(list);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  };
  const take = (idea) => {
    const created = addShoppingItems(shopping, [{ name: idea.name, reason: idea.deal ? `${idea.reason} (Aktion: ${idea.deal})` : idea.reason, source: "ai" }]);
    if (created.length) save.mutate(created);
    setIdeas((list) => list.filter((i) => i !== idea));
  };

  return (
    <section className={cardClass}>
      <SectionTitle icon={Lightbulb} title="Einkaufsempfehlungen" hint="Die KI schaut auf Vorrat, letzte Einkäufe, dein Profil und eingelesene Aktionen." />
      <button type="button" onClick={run} disabled={loading} className={primaryBtn}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{ideas ? "Neu vorschlagen" : "Was fehlt mir?"}
      </button>
      <div className="mt-3"><ErrorNote error={error} /></div>
      {ideas && (
        <ul className="mt-4 space-y-2">
          {ideas.map((idea, idx) => (
            <li key={idx} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-100">{idea.name} <span className="text-xs text-slate-500">· {categoryLabel(idea.category)}</span></div>
                {idea.reason && <div className="text-xs text-slate-400">{idea.reason}</div>}
                {idea.deal && <div className="text-xs text-orange-300">Aktion: {idea.deal}</div>}
              </div>
              <button type="button" onClick={() => take(idea)} className={ghostBtn}><Plus className="h-4 w-4" />Zettel</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PurchaseHistory() {
  const { data: receipts = [] } = useReceipts();
  const { remove } = useReceiptMutations();
  if (!receipts.length) return null;
  return (
    <section className={cardClass}>
      <SectionTitle icon={History} title="Letzte Einkäufe" />
      <ul className="space-y-2">
        {receipts.slice(0, 10).map((r) => (
          <li key={r.id} className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
            <details>
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm text-slate-200">
                <span>{shortDate(r.date)} {r.store || "Einkauf"} <span className="text-slate-500">· {(r.items || []).length} Posten</span></span>
                {r.total > 0 && <span className="tabular-nums text-slate-400">{eur(r.total)}</span>}
              </summary>
              <ul className="mt-2 space-y-0.5 text-xs text-slate-400">
                {(r.items || []).map((i, k) => <li key={k}>{i.name}{i.price != null ? ` · ${eur(i.price)}` : ""}</li>)}
              </ul>
              <button type="button" onClick={() => remove.mutate(r.id)} className="mt-2 text-xs text-slate-500 hover:text-red-400">Eintrag löschen (Vorrat bleibt)</button>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ShoppingTab() {
  const { data: pantry = [], isLoading: pantryLoading } = usePantry();
  const { data: shopping = [] } = useShopping();
  const [scanning, setScanning] = useState(false);

  return (
    <div className="space-y-5">
      {scanning ? (
        <Suspense fallback={<div className="py-6 text-center text-sm text-slate-500 animate-pulse">Laden …</div>}>
          <ReceiptScanner pantry={pantry} pantryReady={!pantryLoading} shopping={shopping} onClose={() => setScanning(false)} />
        </Suspense>
      ) : (
        <button type="button" onClick={() => setScanning(true)} className="flex w-full items-center gap-4 rounded-3xl border border-orange-400/30 bg-orange-400/5 p-5 text-left transition hover:bg-orange-400/10">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3 text-orange-300"><Receipt className="h-6 w-6" /></div>
          <div>
            <div className="font-semibold text-slate-100">Einkauf erfassen</div>
            <div className="text-sm text-slate-400">Kassenbon fotografieren oder eintippen — landet im Vorrat.</div>
          </div>
        </button>
      )}
      <ShoppingList shopping={shopping} />
      <ShoppingAdvice pantry={pantry} shopping={shopping} />
      <DealsPanel />
      <PurchaseHistory />
    </div>
  );
}

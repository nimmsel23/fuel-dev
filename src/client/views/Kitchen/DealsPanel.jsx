import { useEffect, useState } from "react";
import { Tag, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { reviewToDeals } from "../../lib/kitchenLogic.js";
import { useActiveDeals, useDealMutations, useKitchenSettings, useKitchenSettingsMutation } from "../../hooks/useKitchen.js";
import { cardClass, fieldClass, primaryBtn, ghostBtn, SectionTitle, ErrorNote, ImageCapture } from "./shared.jsx";

// Aktionen von Händlern: es gibt KEINE automatische Datenquelle. Aktionen stammen ausschließlich aus Prospekten/Texten,
// die der Nutzer selbst einliest — nichts davon ist erfunden oder vorbelegt.
export default function DealsPanel() {
  const { data: deals } = useActiveDeals();
  const { save, remove } = useDealMutations();
  const { data: settings = {} } = useKitchenSettings();
  const saveSettings = useKitchenSettingsMutation();
  const [store, setStore] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("photo");
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { setStore(settings.stores || ""); }, [settings.stores]);

  const fallbackStore = store.split(",")[0].trim();
  const analyze = async (file) => (await import("../../lib/kitchenAi.js")).scanFlyerImage(file, { fallbackStore });
  const accept = (list) => {
    if (!list.length) { setError(new Error("Keine Aktionen erkannt. Foto näher/schärfer aufnehmen oder Text einfügen.")); return; }
    setError(null);
    setDraft(list);
  };
  const parseText = async () => {
    setParsing(true);
    setError(null);
    try { accept(await (await import("../../lib/kitchenAi.js")).parseDealsText(text.trim(), { fallbackStore })); }
    catch (e) { setError(e); }
    finally { setParsing(false); }
  };
  const update = (idx, patch) => setDraft(draft.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  const confirm = () => {
    const created = reviewToDeals(draft);
    if (created.length) save.mutate(created);
    setDraft(null); setText(""); setOpen(false);
  };

  return (
    <section className={cardClass}>
      <SectionTitle icon={Tag} title="Aktionen" hint="Es gibt keine automatische Angebotsquelle. Hier erscheinen nur Aktionen, die du selbst aus einem Prospekt (Foto) oder Text einliest — die KI bezieht ihre Rezept- und Einkaufsideen dann auf genau diese." />

      <label className="block text-xs text-slate-400">Meine Händler / Ort
        <input value={store} onChange={(e) => setStore(e.target.value)} onBlur={() => store !== (settings.stores || "") && saveSettings.mutate({ stores: store.trim() })}
          placeholder="z. B. Billa, Spar, Hofer — Wien 10" className={twMerge(fieldClass, "mt-1 w-full")} />
      </label>

      {deals.length > 0 && (
        <ul className="mt-4 space-y-2">
          {deals.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-100">{d.product}</div>
                <div className="text-xs text-slate-500">
                  {[d.store, d.price_text || (d.price != null ? `${String(d.price.toFixed(2)).replace(".", ",")} €` : ""), d.valid_until && `bis ${d.valid_until.slice(8, 10)}.${d.valid_until.slice(5, 7)}.`].filter(Boolean).join(" · ")}
                </div>
              </div>
              <button type="button" onClick={() => remove.mutate(d.id)} aria-label={`${d.product} entfernen`} className="rounded-lg p-1.5 text-slate-500 hover:bg-red-400/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      {!deals.length && !open && <p className="mt-4 text-sm text-slate-500">Keine gültigen Aktionen eingelesen.</p>}

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={twMerge(ghostBtn, "mt-4")}>Prospekt / Aktion einlesen</button>
      ) : (
        <div className="mt-4 space-y-4 rounded-2xl border border-orange-400/20 bg-orange-400/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {[["photo", "Foto"], ["text", "Text"]].map(([key, label]) => (
                <button key={key} type="button" aria-pressed={mode === key} onClick={() => { setMode(key); setError(null); setDraft(null); }}
                  className={twMerge("rounded-full border px-3 py-1 text-sm", mode === key ? "border-orange-400/60 bg-orange-400/10 text-orange-200" : "border-white/10 text-slate-400")}>{label}</button>
              ))}
            </div>
            <button type="button" onClick={() => { setOpen(false); setDraft(null); setError(null); }} aria-label="Schließen" className="rounded-full p-1 text-slate-400 hover:text-slate-100"><X className="h-5 w-5" /></button>
          </div>

          {!draft && (mode === "photo"
            ? <ImageCapture analyze={analyze} onResult={accept} busyText="Gemini liest den Prospekt …" />
            : (
              <div className="space-y-3">
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Aktionstext einfügen, z. B. „Lachsfilet 3,99 € / 125 g, gültig bis 30.10.“" className={twMerge(fieldClass, "w-full resize-y")} />
                <button type="button" onClick={parseText} disabled={!text.trim() || parsing} className={primaryBtn}>{parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Auslesen</button>
              </div>
            ))}

          {draft && (
            <div className="space-y-3">
              <ul className="space-y-2">
                {draft.map((d, idx) => (
                  <li key={idx} className={twMerge("rounded-2xl border border-white/10 bg-slate-950/50 p-3", !d.sel && "opacity-50")}>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={d.sel} onChange={(e) => update(idx, { sel: e.target.checked })} aria-label={`${d.product} übernehmen`} className="h-4 w-4 accent-orange-400" />
                      <input value={d.product} onChange={(e) => update(idx, { product: e.target.value })} aria-label="Produkt" className={twMerge(fieldClass, "min-w-0 flex-1")} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 pl-6">
                      <input value={d.store} onChange={(e) => update(idx, { store: e.target.value })} placeholder="Händler" aria-label="Händler" className={twMerge(fieldClass, "w-28")} />
                      <input value={d.price_text} onChange={(e) => update(idx, { price_text: e.target.value })} placeholder="Preis" aria-label="Preis" className={twMerge(fieldClass, "w-28")} />
                      <input type="date" value={d.valid_until} onChange={(e) => update(idx, { valid_until: e.target.value })} aria-label="Gültig bis" title="Gültig bis" className={fieldClass} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button type="button" onClick={confirm} disabled={!draft.some((d) => d.sel)} className={primaryBtn}>Aktionen übernehmen</button>
                <button type="button" onClick={() => setDraft(null)} className={ghostBtn}>Zurück</button>
              </div>
            </div>
          )}
          <ErrorNote error={error} />
        </div>
      )}
    </section>
  );
}

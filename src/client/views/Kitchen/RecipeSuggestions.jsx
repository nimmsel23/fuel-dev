import { useState } from "react";
import { ChefHat, Sparkles, Loader2, ShoppingCart, Clock, Check } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { useSettings } from "../../store.js";
import { isInStock, addShoppingItems, missingIngredients } from "../../lib/kitchenLogic.js";
import { useActiveDeals, useShoppingMutations, useShopping } from "../../hooks/useKitchen.js";
import { suggestRecipes } from "../../lib/kitchenAi.js";
import { cardClass, fieldClass, primaryBtn, ghostBtn, SectionTitle, ErrorNote } from "./shared.jsx";

// KI-Rezeptideen aus dem Vorrat (inkl. baldigem Ablauf, Profil aus den Settings und — falls eingelesen — echten Aktionen).
export default function RecipeSuggestions({ pantry }) {
  const settings = useSettings();
  const { data: deals } = useActiveDeals();
  const { data: shopping = [] } = useShopping();
  const { save: saveShopping } = useShoppingMutations();
  const [wishes, setWishes] = useState("");
  const [useDeals, setUseDeals] = useState(true);
  const [recipes, setRecipes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState({});

  const stock = pantry.filter(isInStock);

  const run = async () => {
    setLoading(true);
    setError(null);
    setAdded({});
    try {
      const list = await suggestRecipes({ pantry, deals: useDeals ? deals : [], wishes, settings });
      if (!list.length) throw new Error("Die KI hat keine Rezepte geliefert. Bitte noch einmal versuchen.");
      setRecipes(list);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  };

  const addMissing = (recipe, idx) => {
    const entries = missingIngredients(recipe).map((i) => ({ name: i.name, qty_text: i.qty_text, reason: recipe.title, source: "ai" }));
    const created = addShoppingItems(shopping, entries);
    if (created.length) saveShopping.mutate(created);
    setAdded((a) => ({ ...a, [idx]: created.length }));
  };

  return (
    <section className={cardClass}>
      <SectionTitle icon={ChefHat} title="Rezeptideen aus deinem Vorrat" hint="Zuerst wird verbraucht, was bald abläuft. Fehlendes setzt du mit einem Tap auf den Einkaufszettel." />
      <div className="space-y-3">
        <input value={wishes} onChange={(e) => setWishes(e.target.value)} placeholder="Wünsche (optional), z. B. high protein, schnell, ohne Ofen" className={twMerge(fieldClass, "w-full")} />
        {deals.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={useDeals} onChange={(e) => setUseDeals(e.target.checked)} className="h-4 w-4 accent-orange-400" />
            {deals.length} eingelesene Aktion{deals.length === 1 ? "" : "en"} berücksichtigen
          </label>
        )}
        <button type="button" onClick={run} disabled={loading || !stock.length} className={primaryBtn}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {recipes ? "Neue Ideen" : "Rezepte vorschlagen"}
        </button>
        {!stock.length && <p className="text-xs text-slate-500">Der Vorrat ist leer — erfasse zuerst einen Einkauf oder füge Posten hinzu.</p>}
        <ErrorNote error={error} />
      </div>

      {recipes && (
        <ul className="mt-5 space-y-4">
          {recipes.map((r, idx) => {
            const missing = missingIngredients(r);
            return (
              <li key={idx} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="text-base font-semibold text-slate-100">{r.title}</h4>
                  <span className="flex items-center gap-1 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" />{r.minutes ? `${r.minutes} Min.` : "—"} · {r.servings} Port.</span>
                </div>
                {r.summary && <p className="mt-1 text-sm text-slate-400">{r.summary}</p>}
                <p className="mt-2 text-xs tabular-nums text-slate-500">pro Portion ≈ {r.macros.kcal} kcal · P{r.macros.protein} · C{r.macros.carbs} · F{r.macros.fat}</p>
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {r.ingredients.map((i, k) => (
                    <li key={k} className={twMerge("rounded-full px-2.5 py-1 text-xs", i.in_pantry ? "bg-emerald-400/10 text-emerald-200" : "bg-amber-400/10 text-amber-200")}>
                      {i.name}{i.qty_text ? ` · ${i.qty_text}` : ""}
                    </li>
                  ))}
                </ul>
                {r.uses_deals.length > 0 && <p className="mt-2 text-xs text-orange-300">Nutzt Aktion: {r.uses_deals.join(", ")}</p>}
                {r.steps.length > 0 && (
                  <details className="mt-3 text-sm text-slate-300">
                    <summary className="cursor-pointer text-slate-400 hover:text-slate-200">Zubereitung</summary>
                    <ol className="mt-2 list-decimal space-y-1 pl-5">{r.steps.map((s, k) => <li key={k}>{s}</li>)}</ol>
                  </details>
                )}
                <div className="mt-3">
                  {missing.length === 0 ? (
                    <span className="text-xs text-emerald-300">Alles im Vorrat.</span>
                  ) : added[idx] !== undefined ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-300"><Check className="h-3.5 w-3.5" />{added[idx] ? `${added[idx]} Posten auf dem Einkaufszettel` : "Steht schon auf dem Einkaufszettel"}</span>
                  ) : (
                    <button type="button" onClick={() => addMissing(r, idx)} className={ghostBtn}><ShoppingCart className="h-4 w-4" />{missing.length} fehlende auf den Zettel</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

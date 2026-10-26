import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as db from "../lib/db.firestore.js";
import { upsertById, removeById, activeDeals } from "../lib/kitchenLogic.js";

const KEYS = {
  pantry: ["kitchen", "pantry"],
  receipts: ["kitchen", "receipts"],
  shopping: ["kitchen", "shopping"],
  deals: ["kitchen", "deals"],
  settings: ["kitchen", "settings"],
};

const useList = (key, fn) => useQuery({ queryKey: key, queryFn: fn, staleTime: 30_000 });

export const usePantry = () => useList(KEYS.pantry, db.listPantry);
export const useReceipts = () => useList(KEYS.receipts, () => db.listReceipts());
export const useShopping = () => useList(KEYS.shopping, db.listShopping);
export const useDeals = () => useList(KEYS.deals, db.listDeals);
export const useKitchenSettings = () => useList(KEYS.settings, db.getKitchenSettings);

// Nur gültige Aktionen (abgelaufene bleiben in Firestore, werden aber nicht angezeigt/verwendet).
export function useActiveDeals() {
  const q = useDeals();
  return { ...q, data: activeDeals(q.data || []) };
}

// Optimistisch: der Cache wird sofort mit dem Befehl gepatcht, Fehler laden nur neu (nie ein alter Snapshot zurück).
function useListMutations(key, save, remove) {
  const qc = useQueryClient();
  const patch = async (fn) => {
    await qc.cancelQueries({ queryKey: key, exact: true });
    qc.setQueryData(key, (current) => fn(current || []));
  };
  // Fehler und Erfolg laden gleichermaßen neu — der Server-Stand gewinnt.
  const settle = { onSettled: () => qc.invalidateQueries({ queryKey: key, exact: true }) };
  return {
    save: useMutation({ mutationFn: (items) => save(items), onMutate: (items) => patch((list) => upsertById(list, items)), ...settle }),
    remove: useMutation({ mutationFn: (id) => remove(id), onMutate: (id) => patch((list) => removeById(list, id)), ...settle }),
  };
}

export const usePantryMutations = () => useListMutations(KEYS.pantry, db.savePantryItems, db.deletePantryItem);
export const useShoppingMutations = () => useListMutations(KEYS.shopping, db.saveShoppingItems, db.deleteShoppingItem);
export const useDealMutations = () => useListMutations(KEYS.deals, db.saveDeals, db.deleteDeal);

export function useReceiptMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: KEYS.receipts, exact: true });
  return {
    save: useMutation({ mutationFn: (receipt) => db.saveReceipt(receipt), onSettled: done }),
    remove: useMutation({ mutationFn: (id) => db.deleteReceipt(id), onSettled: done }),
  };
}

export function useKitchenSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings) => db.saveKitchenSettings(settings),
    onMutate: async (settings) => {
      await qc.cancelQueries({ queryKey: KEYS.settings, exact: true });
      qc.setQueryData(KEYS.settings, (current) => ({ ...(current || {}), ...settings }));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEYS.settings, exact: true }),
  });
}

// Einkauf übernehmen (Bon/manuell): Vorrat mergen, Bon festhalten, Zettel-Posten abhaken — in einem Rutsch.
export function useCommitPurchase() {
  const qc = useQueryClient();
  const pantryM = usePantryMutations();
  const receiptM = useReceiptMutations();
  const shoppingM = useShoppingMutations();
  return async ({ pantryChanged, receipt, tickedShopping }) => {
    // Optimistisches Patchen der Listen übernehmen die Mutationen; hier nur sequenziell anstoßen und Fehler weiterreichen.
    if (pantryChanged.length) await pantryM.save.mutateAsync(pantryChanged);
    if (receipt) await receiptM.save.mutateAsync(receipt);
    if (tickedShopping.length) await shoppingM.save.mutateAsync(tickedShopping);
    qc.invalidateQueries({ queryKey: ["kitchen"] });
  };
}

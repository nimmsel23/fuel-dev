import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as db from "../lib/db.firestore.js";
import { upsertById, removeById, activeDeals, staleDeals } from "../lib/kitchenLogic.js";

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
// Beim Laden nebenbei die seit über 30 Tagen abgelaufenen Aktionen löschen (Fehler egal, nächster Ladevorgang versucht es erneut).
async function listDealsPruned() {
  const deals = await db.listDeals();
  const stale = staleDeals(deals);
  if (!stale.length) return deals;
  stale.forEach((d) => db.deleteDeal(d.id).catch(() => {}));
  const gone = new Set(stale.map((d) => d.id));
  return deals.filter((d) => !gone.has(d.id));
}
export const useDeals = () => useList(KEYS.deals, listDealsPruned);
export const useKitchenSettings = () => useList(KEYS.settings, db.getKitchenSettings);

// Nur gültige Aktionen (abgelaufene bleiben in Firestore, werden aber nicht angezeigt/verwendet).
export function useActiveDeals() {
  const q = useDeals();
  return { ...q, data: activeDeals(q.data || []) };
}

// Alle Küche-Schreibvorgänge teilen einen Mutation-Key: Nur wenn der letzte fertig ist, wird neu geladen. Sonst springt
// die Anzeige bei schnellen ±-Taps auf Zwischenstände zurück, während der nächste Schreibvorgang noch läuft.
const WRITE_KEY = ["kitchen", "write"];
const settleAll = (qc, keys) => () => {
  if (qc.isMutating({ mutationKey: WRITE_KEY }) <= 1) keys.forEach((queryKey) => qc.invalidateQueries({ queryKey, exact: true }));
};

// Optimistisch: der Cache wird sofort mit dem Befehl gepatcht, Fehler laden nur neu (nie ein alter Snapshot zurück).
function useListMutations(key, save, remove) {
  const qc = useQueryClient();
  const patch = async (fn) => {
    await qc.cancelQueries({ queryKey: key, exact: true });
    qc.setQueryData(key, (current) => fn(current || []));
  };
  const settle = { onSettled: settleAll(qc, [key]) };
  return {
    save: useMutation({ mutationKey: WRITE_KEY, mutationFn: (items) => save(items), onMutate: (items) => patch((list) => upsertById(list, items)), ...settle }),
    remove: useMutation({ mutationKey: WRITE_KEY, mutationFn: (id) => remove(id), onMutate: (id) => patch((list) => removeById(list, id)), ...settle }),
  };
}

export const usePantryMutations = () => useListMutations(KEYS.pantry, db.savePantryItems, db.deletePantryItem);
export const useShoppingMutations = () => useListMutations(KEYS.shopping, db.saveShoppingItems, db.deleteShoppingItem);
export const useDealMutations = () => useListMutations(KEYS.deals, db.saveDeals, db.deleteDeal);

export function useReceiptMutations() {
  const qc = useQueryClient();
  const settle = { onSettled: settleAll(qc, [KEYS.receipts]) };
  return {
    save: useMutation({ mutationKey: WRITE_KEY, mutationFn: (receipt) => db.saveReceipt(receipt), ...settle }),
    remove: useMutation({ mutationKey: WRITE_KEY, mutationFn: (id) => db.deleteReceipt(id), ...settle }),
  };
}

export function useKitchenSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: WRITE_KEY,
    mutationFn: (settings) => db.saveKitchenSettings(settings),
    onMutate: async (settings) => {
      await qc.cancelQueries({ queryKey: KEYS.settings, exact: true });
      qc.setQueryData(KEYS.settings, (current) => ({ ...(current || {}), ...settings }));
    },
    onSettled: settleAll(qc, [KEYS.settings]),
  });
}

// Einkauf/Zettel-Übernahme in den Vorrat: Vorrat + Bon + Zettel-Posten atomar in einem Batch (siehe commitKitchenBatch),
// die drei Listen werden sofort optimistisch gepatcht. Wirft bei Fehler — Aufrufer zeigen ihn und dürfen erneut versuchen.
export function useCommitPurchase() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationKey: WRITE_KEY,
    mutationFn: ({ pantryChanged = [], receipt = null, shoppingChanged = [] }) =>
      db.commitKitchenBatch({ pantry: pantryChanged, receipts: receipt ? [receipt] : [], shopping: shoppingChanged }),
    onMutate: async ({ pantryChanged = [], receipt = null, shoppingChanged = [] }) => {
      await Promise.all([KEYS.pantry, KEYS.receipts, KEYS.shopping].map((queryKey) => qc.cancelQueries({ queryKey, exact: true })));
      if (pantryChanged.length) qc.setQueryData(KEYS.pantry, (list) => upsertById(list || [], pantryChanged));
      if (receipt) qc.setQueryData(KEYS.receipts, (list) => upsertById(list || [], [receipt]));
      if (shoppingChanged.length) qc.setQueryData(KEYS.shopping, (list) => upsertById(list || [], shoppingChanged));
    },
    onSettled: settleAll(qc, [KEYS.pantry, KEYS.receipts, KEYS.shopping]),
  });
  return (args) => mutation.mutateAsync(args);
}

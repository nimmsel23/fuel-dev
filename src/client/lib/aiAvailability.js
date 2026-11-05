// Legacy AI actions are unavailable in product builds until server quotas cover them.
export function assertLegacyAiAvailable(product = import.meta.env?.VITE_VOS_PRODUCT_BUILD === "1") {
  if (product) throw new Error("Diese KI-Funktion ist in VitalOS derzeit nicht verfügbar. Nutze Smart Log im Journal oder erfasse die Daten manuell.");
}

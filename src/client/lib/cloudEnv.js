// Eine Weiche für "läuft gegen Firestore" statt verstreuter Hostname-Checks.
// Build-Modus schlägt Hostname: Firebase-/Produkt-Builds (inkl. Capacitor-Android,
// dort heißt der Host "localhost") laufen IMMER gegen Firestore. Lokal (localhost,
// 127.0.0.1, ts.net) bleibt nur der Dev-/Coach-Build ohne diese Flags beim lokalen Backend.
export function isCloudRuntime() {
  if (import.meta.env?.MODE === "firebase" || import.meta.env?.VITE_VOS_PRODUCT_BUILD === "1") return true;
  if (typeof window === "undefined") return false;
  if (window.Capacitor?.isNativePlatform?.()) return true;
  const host = window.location.hostname;
  return host.includes("web.app") || host.includes("firebaseapp.com");
}

// Store-/Produkt-Build (Play Store, Observe/Operate): VITE_VOS_EDITION ∈ {store, observe, operate}
// oder VITE_VOS_PRODUCT_BUILD=1. Owner-/Dev-Builds (edition "core"/leer) bleiben unverändert.
const STORE_EDITIONS = ["store", "observe", "operate"];
export const STORE_BUILD =
  import.meta.env?.VITE_VOS_PRODUCT_BUILD === "1" || STORE_EDITIONS.includes(import.meta.env?.VITE_VOS_EDITION);

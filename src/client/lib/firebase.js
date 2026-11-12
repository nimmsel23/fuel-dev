import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from "firebase/firestore";
import {
  initializeAuth,
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  browserPopupRedirectResolver,
} from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { firebaseConfig } from "./firebase.config.js";
import { resolveAuthDomain } from "./authFlow.js";

const hostname = typeof location !== "undefined" ? location.hostname : "";
export const authDomain = resolveAuthDomain(firebaseConfig.authDomain, hostname);
const resolvedConfig = { ...firebaseConfig, authDomain };

const alreadyInit = getApps().length > 0
const app = alreadyInit ? getApp() : initializeApp(resolvedConfig);
const isClientBuild = import.meta.env.VITE_APP_MODE === "client";

// App Check: seit Juli 2026 von Google für Firebase AI Logic (Vertex AI) erzwungen —
// ohne Debug-Token (dev) bzw. reCAPTCHA-Provider (prod) schlagen Vertex-AI-Calls mit 403 fehl.
// Im lokalen Coach-Build läuft Vertex über das lokale Backend; dort erzeugt
// App Check nur 403-Noise im Browser, weil kein Cloud-Client-Flow aktiv ist.
if (!alreadyInit && isClientBuild) {
  if (import.meta.env.DEV) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
}

export const db = alreadyInit
  ? getFirestore(app)
  : initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });

// Persistence muss feststehen, bevor getRedirectResult oder ein Klick läuft.
// Ein nachgezogener Aufruf ist asynchron: auf iOS öffnet das Popup nach dem
// Klick-Tick (Safari blockt es) oder der Redirect liest die Session aus dem
// falschen Speicher und der Nutzer bleibt abgemeldet.
function createAuth(firebaseApp) {
  try {
    return initializeAuth(firebaseApp, {
      persistence: [browserLocalPersistence, indexedDBLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch (error) {
    if (error?.code === "auth/already-initialized") return getAuth(firebaseApp);
    throw error;
  }
}

export const auth = createAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Vertex AI initialization (@firebase/ai >= 3: VertexAIBackend → AgentPlatformBackend)
import * as firebaseAI from "firebase/ai";
import { STORE_BUILD } from "./cloudEnv.js";
const AiBackend = Reflect.get(firebaseAI, "AgentPlatformBackend") ?? Reflect.get(firebaseAI, "VertexAIBackend");
// Store-Build: keine KI-Instanz (Datenschutz: keine Aufrufe an Gemini/Vertex).
export const vertexAI = typeof AiBackend === "function" && !STORE_BUILD
  ? firebaseAI.getAI(app, { backend: new AiBackend("us-central1") })
  : null;

// FCM Initialization
import { getMessaging } from "firebase/messaging";
export const messaging = typeof window !== "undefined" && "serviceWorker" in navigator ? getMessaging(app) : null;

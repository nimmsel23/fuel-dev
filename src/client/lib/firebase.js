import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { firebaseConfig } from "./firebase.config.js";

const alreadyInit = getApps().length > 0
const app = alreadyInit ? getApp() : initializeApp(firebaseConfig);
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

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Vertex AI initialization
import { getVertexAI } from "firebase/vertexai";
export const vertexAI = getVertexAI(app);

// FCM Initialization
import { getMessaging } from "firebase/messaging";
export const messaging = typeof window !== "undefined" && "serviceWorker" in navigator ? getMessaging(app) : null;

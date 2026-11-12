import { onIdTokenChanged } from "firebase/auth";
import { auth } from "./firebase.js";
import { decideAuthTokenReply } from "./swAuthReply.js";

const TOKEN = "FUEL_AUTH_TOKEN";
const REQUEST = "FUEL_AUTH_TOKEN_REQUEST";
const REFRESH_MS = 45 * 60 * 1000;

async function registration() {
  if (!("serviceWorker" in navigator)) return null;
  return window.__swRegistration || (await navigator.serviceWorker.getRegistration()) || null;
}

async function publish(token) {
  const reg = await registration();
  if (!reg) return;
  const message = { type: TOKEN, token: token || null };
  reg.active?.postMessage(message);
  reg.waiting?.postMessage(message);
  navigator.serviceWorker.controller?.postMessage(message);
}

function publishUser(user, force = false) {
  if (!user) {
    publish(null).catch(() => {});
    return;
  }
  user.getIdToken(force).then((token) => publish(token)).catch(() => {});
}

// Gibt dem Service Worker das Firebase-ID-Token der angemeldeten App, damit
// quickLogSupplement/snoozeSupplement es als Bearer mitschicken. Der SW hat
// keinen eigenen Login-Speicher (localStorage).
export function startSwAuthBridge() {
  let ready = false;
  const publishIfReady = (user) => {
    if (!ready) return;
    publishUser(user);
  };

  onIdTokenChanged(auth, publishIfReady);
  auth.authStateReady().then(() => {
    ready = true;
    publishUser(auth.currentUser);
  }).catch(() => {});

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type !== REQUEST) return;
    const requestId = event.data.requestId;
    const reply = (token) => {
      const message = { type: TOKEN, token, requestId };
      if (event.source) event.source.postMessage(message);
      else navigator.serviceWorker.controller?.postMessage(message);
    };
    auth.authStateReady().then(async () => {
      const user = auth.currentUser;
      let token = null;
      if (user) {
        try {
          token = await user.getIdToken();
        } catch {
          token = null;
        }
      }
      const decision = decideAuthTokenReply({ restored: true, signedIn: Boolean(user), token });
      if (decision.kind === "token") reply(decision.token);
      else if (decision.kind === "logout") reply(null);
    }).catch(() => {});
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => publishIfReady(auth.currentUser));

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") publishIfReady(auth.currentUser);
  });
  // ID-Tokens laufen nach etwa einer Stunde ab. Der Klick-Pfad holt bei
  // offenem Fenster ein frisches Token; dieses Intervall hält den SW-Cache
  // warm, solange die Seite offen ist.
  setInterval(() => {
    if (ready && auth.currentUser) publishUser(auth.currentUser, true);
  }, REFRESH_MS);
}

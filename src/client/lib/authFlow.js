/**
 * Reine Entscheidungen für den Google-Login.
 * Kein Firebase-Import: derselbe Pfad gilt für Cloud-App, Mini-Apps, Coach und Shell.
 */

const FIREBASE_HOSTING = /\.(?:web\.app|firebaseapp\.com)$/i

function normalizeHost(hostname) {
  return String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
}

function isLocalHost(host) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".local") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
  )
}

/**
 * Safari blockiert Speicher von fitness-aos.firebaseapp.com, wenn die App auf
 * einer anderen Hosting-Site liegt. Auf *.web.app / *.firebaseapp.com liefert
 * Firebase den Auth-Handler unter /__/auth selbst aus — die Domain der Seite
 * ist dann die richtige authDomain. Lokale und fremde Hosts bleiben beim
 * Projekt-Default, sonst zeigt der Handler ins Leere.
 */
export function resolveAuthDomain(configured, hostname) {
  const configuredDomain = String(configured || "").trim()
  const host = normalizeHost(hostname)
  if (!host || isLocalHost(host)) return configuredDomain
  if (FIREBASE_HOSTING.test(host)) return host
  return configuredDomain
}

export function sameSiteAuth(pageHost, authDomain) {
  const page = normalizeHost(pageHost)
  const auth = normalizeHost(authDomain)
  return Boolean(page) && page === auth
}

function isAppleMobile(env) {
  const ua = env.userAgent || ""
  if (/iPhone|iPad|iPod/.test(ua)) return true
  // iPadOS meldet sich als Desktop-Mac, bleibt aber Touch.
  return env.platform === "MacIntel" && Number(env.maxTouchPoints) > 1
}

function isAppleBrowser(userAgent) {
  return /Safari\/|CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent || "")
}

function isStandalone(env) {
  return env.standalone === true || env.displayMode === "standalone" || env.displayMode === "fullscreen"
}

/**
 * popup: Desktop-Browser.
 * redirect: iPhone/iPad und zum Home-Bildschirm hinzugefügte App. Dort öffnet
 *   signInWithPopup ein Fenster ohne Rückkanal (Firebase liefert auf iOS-Standalone
 *   ein leeres Popup) und der Fallback lief nur bei auth/popup-blocked.
 * blocked-webview: WKWebView ohne Safari-Kennung. Google lehnt OAuth dort ab
 *   (disallowed_useragent); Popup und Redirect enden auf derselben Fehlerseite.
 */
export function chooseSignInMethod(env = {}) {
  const apple = isAppleMobile(env)
  const standalone = isStandalone(env)
  if (apple && !standalone && !isAppleBrowser(env.userAgent)) return "blocked-webview"
  if (apple || standalone) return "redirect"
  return "popup"
}

export function shouldFallbackToRedirect(code) {
  return (
    code === "auth/popup-blocked" ||
    code === "auth/operation-not-supported-in-this-environment" ||
    code === "auth/web-storage-unsupported"
  )
}

export function readBrowserSignInEnvironment(
  nav = typeof navigator !== "undefined" ? navigator : {},
  win = typeof window !== "undefined" ? window : undefined,
) {
  let displayMode = ""
  try {
    if (win?.matchMedia?.("(display-mode: standalone)")?.matches) displayMode = "standalone"
    else if (win?.matchMedia?.("(display-mode: fullscreen)")?.matches) displayMode = "fullscreen"
  } catch {
    displayMode = ""
  }
  return {
    userAgent: nav.userAgent || "",
    platform: nav.platform || "",
    maxTouchPoints: nav.maxTouchPoints || 0,
    standalone: nav.standalone === true,
    displayMode,
  }
}

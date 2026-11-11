import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  chooseSignInMethod,
  readBrowserSignInEnvironment,
  resolveAuthDomain,
  sameSiteAuth,
  shouldFallbackToRedirect,
} from "../src/client/lib/authFlow.js"

const CONFIGURED = "fitness-aos.firebaseapp.com"
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1"
const CR_IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1"
const WEBVIEW = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15"

test("Firebase-Hosting-Sites nutzen die Seiten-Domain als authDomain", () => {
  const hosts = [
    "fuel-vos.web.app",
    "fuel-vos.firebaseapp.com",
    "vos-fuel-log.web.app",
    "vos-fuel-supplements.web.app",
    "vos-fuel-mikros.web.app",
    "vos-fuel-protokoll.web.app",
    "fuel-vos--pr-24-abc.web.app",
  ]
  for (const host of hosts) {
    assert.equal(resolveAuthDomain(CONFIGURED, host), host)
  }
})

test("lokale, IP- und fremde Hosts behalten die Projekt-authDomain", () => {
  for (const host of ["localhost", "127.0.0.1", "192.168.1.20", "fuel.local", "example.com", ""]) {
    assert.equal(resolveAuthDomain(CONFIGURED, host), CONFIGURED)
  }
})

test("iOS Safari, Chrome und Home-Bildschirm leiten weiter statt ein Popup zu öffnen", () => {
  assert.equal(chooseSignInMethod({ userAgent: IPHONE, platform: "iPhone", maxTouchPoints: 5 }), "redirect")
  assert.equal(chooseSignInMethod({ userAgent: CR_IOS, platform: "iPhone", maxTouchPoints: 5 }), "redirect")
  assert.equal(
    chooseSignInMethod({ userAgent: IPHONE, platform: "iPhone", maxTouchPoints: 5, standalone: true }),
    "redirect",
  )
  assert.equal(
    chooseSignInMethod({
      userAgent: DESKTOP,
      platform: "MacIntel",
      maxTouchPoints: 5,
      displayMode: "standalone",
    }),
    "redirect",
  )
})

test("eingebettetes iOS-WebView wird nicht in den Google-OAuth geschickt", () => {
  assert.equal(chooseSignInMethod({ userAgent: WEBVIEW, platform: "iPhone", maxTouchPoints: 5 }), "blocked-webview")
})

test("Desktop-Safari bleibt beim Popup und fällt nur bei echten Popup-Sperren auf Redirect zurück", () => {
  assert.equal(chooseSignInMethod({ userAgent: DESKTOP, platform: "MacIntel", maxTouchPoints: 0 }), "popup")
  assert.equal(shouldFallbackToRedirect("auth/popup-blocked"), true)
  assert.equal(shouldFallbackToRedirect("auth/operation-not-supported-in-this-environment"), true)
  assert.equal(shouldFallbackToRedirect("auth/web-storage-unsupported"), true)
  assert.equal(shouldFallbackToRedirect("auth/popup-closed-by-user"), false)
  assert.equal(shouldFallbackToRedirect("auth/cancelled-popup-request"), false)
})

test("ein Redirect ist nur same-site mit der authDomain tragfähig", () => {
  assert.equal(sameSiteAuth("fuel-vos.web.app", "fuel-vos.web.app"), true)
  assert.equal(sameSiteAuth("Fuel-VOS.web.app.", "fuel-vos.web.app"), true)
  assert.equal(sameSiteAuth("vos-fuel-log.web.app", "fitness-aos.firebaseapp.com"), false)
  assert.equal(sameSiteAuth("192.168.1.20", CONFIGURED), false)
})

test("die Browser-Umgebung liest Standalone aus navigator und display-mode", () => {
  const env = readBrowserSignInEnvironment(
    { userAgent: IPHONE, platform: "iPhone", maxTouchPoints: 5, standalone: true },
    { matchMedia: () => ({ matches: false }) },
  )
  assert.equal(env.standalone, true)
  assert.equal(chooseSignInMethod(env), "redirect")
})

test("Auth startet mit fester Persistence und die Seiten-Domain als authDomain", () => {
  const src = readFileSync(new URL("../src/client/lib/firebase.js", import.meta.url), "utf8")
  assert.match(src, /initializeAuth\(/)
  assert.match(src, /browserLocalPersistence/)
  assert.match(src, /resolveAuthDomain\(/)
  assert.doesNotMatch(src, /setPersistence\(/)
})

test("der Service Worker fasst den Firebase-Auth-Handler nicht an", () => {
  const src = readFileSync(new URL("../scripts/mini-app-shell/sw-template.js", import.meta.url), "utf8")
  const fetchAt = src.indexOf("self.addEventListener('fetch'")
  const navAt = src.indexOf("req.mode === 'navigate'", fetchAt)
  const bypassAt = src.indexOf("path.startsWith('/__/')", fetchAt)
  assert.ok(fetchAt >= 0 && bypassAt > fetchAt && bypassAt < navAt)
  const shellWrite = src.indexOf("c.put(INDEX, res.clone())")
  assert.match(src.slice(shellWrite - 180, shellWrite), /startsWith\('\/__\/'\)/)
})

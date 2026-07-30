// Service-Worker-Registrierung — ausgelagert aus index.html, damit sie
// import.meta.env.DEV sehen kann (ein rohes <script> in index.html hat
// keinen Zugriff auf Vite-Env).
//
// Warum das wichtig ist: der SW cached cache-first fast alles (siehe
// public/sw.js — nur /health, /fuel/, /nutrition/, /supplements/ sind
// "API"-Pfade mit Network-first). Im Vite-Dev-Modus lief der SW bisher
// UNBEDINGT mit — jeder Reload konnte dadurch eine eingefrorene alte
// main.jsx/routes.js oder eine stale /coach/health-Antwort ausliefern,
// komplett am Vite-Dev-Server und seinem HMR vorbei. Neue Tabs (z.B. der
// Dev/Prod-Tab) blieben so unsichtbar, obwohl der Quellcode längst korrekt
// war (2026-07-30 entdeckt). Production/Cloud-Build braucht den SW für
// Offline-Fähigkeit — dort bleibt er aktiv.
if (import.meta.env.DEV) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) reg.unregister();
    });
  }
  if (typeof caches !== "undefined") {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
} else if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").then((reg) => {
    window.__swRegistration = reg;
    const notify = () => window.dispatchEvent(new CustomEvent("sw-update-available"));
    if (reg.waiting) notify();
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      if (!nw) return;
      nw.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) notify();
      });
    });
  }).catch(() => {});

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

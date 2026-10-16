// Inline-Snippet für die SW-Registrierung. Lädt bei einem Update einmal neu —
// nicht bei der Erstinstallation (kein Controller vorher). Der Splash deckt den Reload ab.
const START = "<!-- vos-sw-register:start -->";
const END = "<!-- vos-sw-register:end -->";

export function registerSnippet({ swUrl = "./sw.js" } = {}) {
  return `${START}
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          var hadController = !!navigator.serviceWorker.controller
          navigator.serviceWorker.register(${JSON.stringify(swUrl)}).catch(function () {})
          var reloading = false
          navigator.serviceWorker.addEventListener('controllerchange', function () {
            if (!hadController || reloading) return
            reloading = true
            window.location.reload()
          })
        })
      }
    </script>
    ${END}`;
}

export function injectRegister(html, opts) {
  const block = new RegExp(`${START}[\\s\\S]*?${END}`);
  const snippet = registerSnippet(opts);
  if (block.test(html)) return html.replace(block, () => snippet.trim());
  return html.replace(/<\/body>/i, () => `    ${snippet}\n  </body>`);
}

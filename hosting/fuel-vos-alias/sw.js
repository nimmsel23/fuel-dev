// Kill-Switch für installierte Fuel-PWAs auf fuel-vos.web.app.
// Die alte App lief cache-first. Ohne diesen Worker bliebe sie für immer auf dem gecachten
// Stand, weil ein umgeleitetes sw.js nie als Update angenommen wird. Er räumt den Cache,
// meldet sich ab und schickt offene Fenster auf vos-fuel.web.app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key);
    await self.registration.unregister();
    for (const client of await self.clients.matchAll({ type: "window" })) {
      const url = new URL(client.url);
      client.navigate("https://vos-fuel.web.app" + url.pathname + url.search + url.hash).catch(() => {});
    }
  })());
});

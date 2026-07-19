const CACHE = "fuel-v50";
const BASE_PATH = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const withBase = (path) => `${BASE_PATH}${path}`;
const STATIC_ASSETS = [withBase("/"), withBase("/index.html"), withBase("/manifest.json")];
const API_PATHS = ["/health", "/fuel/", "/nutrition/", "/supplements/"];
const stripBase = (pathname) => {
  if (pathname.startsWith(BASE_PATH + "/")) return pathname.slice(BASE_PATH.length);
  if (pathname === BASE_PATH) return "/";
  return pathname;
};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("message", (e) => {
  if (!e.data) return;
  if (e.data.type === "SKIP_WAITING") self.skipWaiting();
  if (e.data.type === "GET_VERSION" && e.source) {
    e.source.postMessage({ type: "VERSION", version: CACHE });
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const cleanPath = stripBase(url.pathname);
  const isApi = API_PATHS.some((p) => cleanPath.startsWith(p));

  if (isApi) {
    event.respondWith(fetch(event.request).then((response) => {
      if (event.request.method === "GET" && response.ok) {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request)));
  } else {
    event.respondWith(caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }));
  }
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  
  try {
    let data;
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
    
    // FCM HTTP v1 payload check
    if (data && data.notification) {
      data.title = data.notification.title;
      data.body = data.notification.body;
      data.icon = data.notification.icon || "/favicon-192x192.png";
      data.url = data.fcm_options?.link || "/supplements";
    }

    const options = {
      body: data.body || "Du hast noch offene Supplements für heute.",
      icon: data.icon || "/favicon-192x192.png",
      badge: "/favicon-192x192.png",
      vibrate: [200, 100, 200],
      data: {
        url: data.url || "/supplements"
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || "Fuel Reminder", options)
    );
  } catch (err) {
    console.error("Push event payload not JSON", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url;
  
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

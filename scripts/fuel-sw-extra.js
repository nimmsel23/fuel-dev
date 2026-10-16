// Fuel-spezifischer SW-Teil (Push, Supplement-Quick-Actions, eigener notificationclick) — wird vom Template
// (@vos/mini-app-shell, mini-app.json → apps.fuel.sw.extraFile) an den generierten SW angehängt.
// BASE kommt aus dem Template (Scope-Pfad der Registrierung); notificationClick ist dort abgeschaltet.
const withBase = (path) => `${BASE}${path}`;

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

    if (typeof data.actions === "string") {
      try {
        data.actions = JSON.parse(data.actions);
      } catch (_error) {
        data.actions = [];
      }
    }
    if (typeof data.meta === "string") {
      try {
        data.meta = JSON.parse(data.meta);
      } catch (_error) {
        data.meta = {};
      }
    }

    const options = {
      body: data.body || "Du hast noch offene Supplements für heute.",
      icon: data.icon || "/favicon-192x192.png",
      badge: "/favicon-192x192.png",
      vibrate: [200, 100, 200],
      tag: data.tag || "fuel-reminder",
      renotify: Boolean(data.renotify),
      requireInteraction: Boolean(data.requireInteraction),
      actions: Array.isArray(data.actions) ? data.actions.slice(0, 3).map((action) => ({
        action: action.action,
        title: action.title,
      })) : [],
      data: {
        url: data.url || "/supplements",
        actions: Array.isArray(data.actions) ? data.actions : [],
        meta: data.meta || {},
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || "Fuel Reminder", options)
    );
  } catch (err) {
    console.error("Push event payload not JSON", err);
  }
});

// Supplement-Quick-Actions: laufen komplett im SW, ohne ein Client-Window zu
// fokussieren. "quick-yes" loggt alle due_items direkt, "snooze" haelt sie
// 30min zurueck. Zwei Backends je Origin:
// - local (Fastify, /opt/fuel): /supplements/log + /push/snooze
// - cloud (fuel-vos.web.app): keine eigene API hinter der Origin — ruft die
//   quickLogSupplement/snoozeSupplement Cloud Functions direkt an
//   (functions/index.js, Projekt fitness-aos, region europe-west1). Die uid
//   kommt im Push-Payload selbst mit (meta.uid), kein Login-State im SW.
const IS_CLOUD = self.location.hostname.includes("web.app") || self.location.hostname.includes("firebaseapp.com");
const CLOUD_FN_BASE = "https://europe-west1-fitness-aos.cloudfunctions.net";

async function logSupplementIntake(item, dateStr, uid) {
  if (IS_CLOUD) {
    const response = await fetch(`${CLOUD_FN_BASE}/quickLogSupplement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid, date: dateStr, item }),
    });
    if (!response.ok) throw new Error(`cloud log failed: ${response.status}`);
    return;
  }
  const response = await fetch(withBase("/supplements/log"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      date: dateStr,
      intake: {
        supplement_id: item.id,
        name: item.name,
        dose: item.dose,
        unit: item.unit,
        time_of_day: item.time_of_day,
      },
    }),
  });
  if (!response.ok) throw new Error(`log failed: ${response.status}`);
}

async function handleQuickYes(data) {
  const items = Array.isArray(data.due_items) ? data.due_items : [];
  const dateStr = data.date || new Date().toISOString().slice(0, 10);
  const results = await Promise.allSettled(items.map((item) => logSupplementIntake(item, dateStr, data.uid)));
  const failed = results.filter((r) => r.status === "rejected").length;
  const names = items.map((i) => i.name).join(", ") || "Supplements";
  return self.registration.showNotification(failed > 0 ? "Teilweise nicht geloggt" : "Erledigt ✓", {
    body: failed > 0 ? `${names} — ${failed} fehlgeschlagen, bitte App öffnen.` : `${names} eingetragen.`,
    icon: "/favicon-192x192.png",
    badge: "/favicon-192x192.png",
    tag: "fuel-supplements-ack",
  });
}

async function handleSnooze(data) {
  const items = Array.isArray(data.due_items) ? data.due_items : [];
  const dateStr = data.date || new Date().toISOString().slice(0, 10);
  const itemIds = items.map((i) => i.id);
  try {
    if (IS_CLOUD) {
      await fetch(`${CLOUD_FN_BASE}/snoozeSupplement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: data.uid, item_ids: itemIds, date: dateStr }),
      });
      return;
    }
    await fetch(withBase("/push/snooze"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_ids: itemIds, date: dateStr }),
    });
  } catch (err) {
    // Lokaler Server offline oder Cloud-Function nicht erreichbar — bewusst
    // stumm, der Nutzer bekommt den naechsten regulaeren Reminder ohnehin.
    console.error("[SW] Snooze request failed", err);
  }
}

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  const meta = data.meta || {};

  if (event.action === "quick-yes" && Array.isArray(meta.due_items) && meta.due_items.length > 0) {
    event.notification.close();
    event.waitUntil(handleQuickYes(meta));
    return;
  }
  if (event.action === "snooze" && Array.isArray(meta.due_items) && meta.due_items.length > 0) {
    event.notification.close();
    event.waitUntil(handleSnooze(meta));
    return;
  }

  event.notification.close();
  const actionMatch = Array.isArray(data.actions)
    ? data.actions.find((entry) => entry.action === event.action)
    : null;
  const urlToOpen = actionMatch?.url || data.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ("focus" in client) {
          return client.focus().then(() => {
            if ("navigate" in client && urlToOpen) return client.navigate(urlToOpen);
            return client;
          });
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

import fs from "fs";
import path from "path";
import webpush from "web-push";

// Konfiguration der VAPID Keys
// Für Produktion sollten diese aus Umgebungsvariablen kommen (.env)
// public: BOafCxLae9KCsYm5j6NJv0csS_Qmvtef8XWszQBootQiX6Cpvkih3fL3P71dXP_2T05CMSXO3bwGxLNZN_SbF_w
// private: zD3-SRxK2iGrs8XVEavlgkgQn9X9XtrXVef7ams3VXI

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "BOafCxLae9KCsYm5j6NJv0csS_Qmvtef8XWszQBootQiX6Cpvkih3fL3P71dXP_2T05CMSXO3bwGxLNZN_SbF_w";
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "zD3-SRxK2iGrs8XVEavlgkgQn9X9XtrXVef7ams3VXI";
const DEFAULT_PUSH_SETTINGS = {
  enabled: true,
  times: {
    morning: "08:00",
    midday: "13:00",
    evening: "19:00",
    night: "21:00",
  },
};

webpush.setVapidDetails(
  "mailto:example@yourdomain.org",
  PUBLIC_KEY,
  PRIVATE_KEY
);

// Hilfsfunktion zum Lesen/Schreiben von Abonnements
function getSubscriptionsPath(req) {
  return path.join(req.paths.dataDir, "push-subscriptions.json");
}

function getSettingsPath(req) {
  return path.join(req.paths.dataDir, "push-settings.json");
}

function loadSubscriptions(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (e) {
    console.error("Error loading subscriptions:", e);
  }
  return [];
}

function saveSubscriptions(filePath, subscriptions) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(subscriptions, null, 2));
}

function loadPushSettings(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return {
        enabled: raw.enabled ?? DEFAULT_PUSH_SETTINGS.enabled,
        times: {
          ...DEFAULT_PUSH_SETTINGS.times,
          ...(raw.times || {}),
        },
      };
    }
  } catch (e) {
    console.error("Error loading push settings:", e);
  }
  return DEFAULT_PUSH_SETTINGS;
}

function savePushSettings(filePath, settings) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
}

function sanitizeTime(value, fallback) {
  const next = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(next) ? next : fallback;
}

function normalizePushSettings(input) {
  const current = {
    enabled: input?.enabled ?? DEFAULT_PUSH_SETTINGS.enabled,
    times: {
      ...DEFAULT_PUSH_SETTINGS.times,
      ...(input?.times || {}),
    },
  };
  return {
    enabled: Boolean(current.enabled),
    times: {
      morning: sanitizeTime(current.times.morning, DEFAULT_PUSH_SETTINGS.times.morning),
      midday: sanitizeTime(current.times.midday, DEFAULT_PUSH_SETTINGS.times.midday),
      evening: sanitizeTime(current.times.evening, DEFAULT_PUSH_SETTINGS.times.evening),
      night: sanitizeTime(current.times.night, DEFAULT_PUSH_SETTINGS.times.night),
    },
  };
}

export default async function pushRoute(fastify, options) {
  // Liefert den Public Key ans Frontend
  fastify.get("/push/vapidPublicKey", async (req, reply) => {
    return { publicKey: PUBLIC_KEY };
  });

  // Nimmt ein neues Abonnement vom Frontend entgegen
  fastify.post("/push/subscribe", async (req, reply) => {
    const subscription = req.body;
    const subPath = getSubscriptionsPath(req);
    
    let subscriptions = loadSubscriptions(subPath);
    
    // Prüfen, ob schon vorhanden (einfacher check via endpoint)
    const exists = subscriptions.find(sub => sub.endpoint === subscription.endpoint);
    if (!exists) {
      subscriptions.push(subscription);
      saveSubscriptions(subPath, subscriptions);
      fastify.log.info("New push subscription added");
    }

    reply.status(201).send({ ok: true });
  });

  fastify.get("/push/settings", async (req) => {
    return loadPushSettings(getSettingsPath(req));
  });

  fastify.post("/push/settings", async (req, reply) => {
    const normalized = normalizePushSettings(req.body || {});
    savePushSettings(getSettingsPath(req), normalized);
    reply.send({ ok: true, settings: normalized });
  });
}

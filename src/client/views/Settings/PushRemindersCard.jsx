import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { useSettings } from "../../store.js";

const DEFAULTS = {
  enabled: true,
  times: {
    morning: "08:00",
    midday: "13:00",
    evening: "19:00",
    night: "21:00",
  },
};

function isCloudMode() {
  return window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com");
}

export default function PushRemindersCard({ sectionCls, labelCls, inputCls }) {
  const cloud = useMemo(() => isCloudMode(), []);
  const {
    supplement_push_enabled,
    supplement_push_morning_time,
    supplement_push_midday_time,
    supplement_push_evening_time,
    supplement_push_night_time,
    setSetting,
  } = useSettings();
  const [localSettings, setLocalSettings] = useState(DEFAULTS);
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (cloud) return;
    fetch("/push/settings")
      .then((res) => res.json())
      .then((data) => setLocalSettings({
        enabled: data.enabled ?? DEFAULTS.enabled,
        times: { ...DEFAULTS.times, ...(data.times || {}) },
      }))
      .catch(() => setLocalSettings(DEFAULTS));
  }, [cloud]);

  const settings = cloud
    ? {
        enabled: supplement_push_enabled,
        times: {
          morning: supplement_push_morning_time,
          midday: supplement_push_midday_time,
          evening: supplement_push_evening_time,
          night: supplement_push_night_time,
        },
      }
    : localSettings;

  function updateSettings(next) {
    if (cloud) {
      setSetting("supplement_push_enabled", next.enabled);
      setSetting("supplement_push_morning_time", next.times.morning);
      setSetting("supplement_push_midday_time", next.times.midday);
      setSetting("supplement_push_evening_time", next.times.evening);
      setSetting("supplement_push_night_time", next.times.night);
    } else {
      setLocalSettings(next);
    }
  }

  async function saveLocalSettings(next) {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/push/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setLocalSettings(data.settings);
      setMessage("Lokale Reminder gespeichert.");
    } catch (error) {
      setMessage(`Speichern fehlgeschlagen: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubscribe() {
    if (!window.Notification || !navigator.serviceWorker) return;
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== "granted") return;

      if (cloud) {
        const { messaging } = await import("../../lib/firebase.js");
        const { getToken } = await import("firebase/messaging");
        const { saveFcmToken } = await import("../../lib/db.firestore.js");
        if (!messaging) throw new Error("FCM wird in diesem Browser nicht unterstützt.");
        const registration = await navigator.serviceWorker.ready;
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_VAPID_KEY,
          serviceWorkerRegistration: registration,
        });
        if (!token) throw new Error("Kein FCM-Token erhalten.");
        await saveFcmToken(token);
        setMessage("Cloud-Push aktiviert. Reminder-Delivery-Backend folgt noch.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const response = await fetch("/push/vapidPublicKey");
      const { publicKey } = await response.json();
      const padding = "=".repeat((4 - publicKey.length % 4) % 4);
      const base64 = (publicKey + padding).replace(/\-/g, "+").replace(/_/g, "/");
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: outputArray,
      });
      await fetch("/push/subscribe", {
        method: "POST",
        body: JSON.stringify(subscription),
        headers: { "Content-Type": "application/json" },
      });
      setMessage("Lokale Push-Subscriptions aktiviert.");
    } catch (error) {
      setMessage(`Push-Aktivierung fehlgeschlagen: ${error.message}`);
    }
  }

  function handleToggleEnabled(enabled) {
    const next = { ...settings, enabled };
    updateSettings(next);
    if (!cloud) saveLocalSettings(next);
  }

  function handleTimeChange(slot, value) {
    const next = {
      ...settings,
      times: {
        ...settings.times,
        [slot]: value,
      },
    };
    updateSettings(next);
  }

  function handleTimeBlur() {
    if (!cloud) saveLocalSettings(settings);
  }

  return (
    <section className={sectionCls}>
      <div className="flex items-center gap-2 mb-1">
        <BellRing className="h-5 w-5 text-violet-300" />
        <h2 className="text-lg font-semibold">Supplement Reminders</h2>
      </div>
      <p className="text-sm text-slate-400">
        Uhrzeiten fuer Morning, Midday, Evening und Night Reminder. Die Due-Logik kommt weiter aus dem Supplement-Katalog.
      </p>

      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
        <div>
          <div className="text-sm text-slate-200">Push Status</div>
          <div className="text-xs text-slate-500">{permission}</div>
        </div>
        {permission !== "granted" && permission !== "unsupported" && (
          <button
            onClick={handleSubscribe}
            className="flex items-center gap-2 rounded-2xl border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm text-violet-200 transition hover:bg-violet-400/20"
          >
            <Bell className="h-4 w-4" />
            Push aktivieren
          </button>
        )}
      </div>

      <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
        <div>
          <div className="text-sm text-slate-200">Reminder aktiv</div>
          <div className="text-xs text-slate-500">
            {cloud ? "Einstellungen werden in der Cloud gespeichert." : "Lokaler Scheduler liest diese Zeiten serverseitig."}
          </div>
        </div>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => handleToggleEnabled(e.target.checked)}
          className="h-4 w-4 accent-violet-400"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(settings.times).map(([slot, value]) => (
          <label key={slot}>
            <span className={labelCls}>{slot}</span>
            <input
              type="time"
              value={value}
              onChange={(e) => handleTimeChange(slot, e.target.value)}
              onBlur={handleTimeBlur}
              className={inputCls}
            />
          </label>
        ))}
      </div>

      {cloud && (
        <p className="text-xs text-amber-300">
          Cloud-Hinweis: Die Preferences sind speicherbar, aber der automatische Reminder-Versand auf Firebase Hosting hat aktuell noch keinen laufenden Scheduler.
        </p>
      )}
      {!cloud && message && (
        <p className={`text-xs ${message.includes("fehlgeschlagen") ? "text-rose-300" : "text-emerald-300"}`}>
          {saving ? "Speichere…" : message}
        </p>
      )}
      {cloud && message && <p className="text-xs text-slate-400">{message}</p>}
    </section>
  );
}

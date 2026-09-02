import { useEffect, useMemo, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { useSettings } from "../../store.js";

const DEFAULTS = {
  supplements: {
    enabled: true,
    times: {
      morning: "08:00",
      midday: "13:00",
      evening: "19:00",
      night: "21:00",
    },
  },
  daily_prompts: {
    fuel_quick_log: {
      enabled: true,
      time: "09:30",
    },
    journal_entry: {
      enabled: true,
      time: "20:30",
    },
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
    daily_fuel_quick_log_enabled,
    daily_fuel_quick_log_time,
    daily_journal_entry_enabled,
    daily_journal_entry_time,
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
        supplements: {
          enabled: data?.supplements?.enabled ?? DEFAULTS.supplements.enabled,
          times: { ...DEFAULTS.supplements.times, ...(data?.supplements?.times || {}) },
        },
        daily_prompts: {
          fuel_quick_log: {
            enabled: data?.daily_prompts?.fuel_quick_log?.enabled ?? DEFAULTS.daily_prompts.fuel_quick_log.enabled,
            time: data?.daily_prompts?.fuel_quick_log?.time || DEFAULTS.daily_prompts.fuel_quick_log.time,
          },
          journal_entry: {
            enabled: data?.daily_prompts?.journal_entry?.enabled ?? DEFAULTS.daily_prompts.journal_entry.enabled,
            time: data?.daily_prompts?.journal_entry?.time || DEFAULTS.daily_prompts.journal_entry.time,
          },
        },
      }))
      .catch(() => setLocalSettings(DEFAULTS));
  }, [cloud]);

  const settings = cloud
    ? {
        supplements: {
          enabled: supplement_push_enabled,
          times: {
            morning: supplement_push_morning_time,
            midday: supplement_push_midday_time,
            evening: supplement_push_evening_time,
            night: supplement_push_night_time,
          },
        },
        daily_prompts: {
          fuel_quick_log: {
            enabled: daily_fuel_quick_log_enabled,
            time: daily_fuel_quick_log_time,
          },
          journal_entry: {
            enabled: daily_journal_entry_enabled,
            time: daily_journal_entry_time,
          },
        },
      }
    : localSettings;

  function updateSettings(next) {
    if (cloud) {
      setSetting("supplement_push_enabled", next.supplements.enabled);
      setSetting("supplement_push_morning_time", next.supplements.times.morning);
      setSetting("supplement_push_midday_time", next.supplements.times.midday);
      setSetting("supplement_push_evening_time", next.supplements.times.evening);
      setSetting("supplement_push_night_time", next.supplements.times.night);
      setSetting("daily_fuel_quick_log_enabled", next.daily_prompts.fuel_quick_log.enabled);
      setSetting("daily_fuel_quick_log_time", next.daily_prompts.fuel_quick_log.time);
      setSetting("daily_journal_entry_enabled", next.daily_prompts.journal_entry.enabled);
      setSetting("daily_journal_entry_time", next.daily_prompts.journal_entry.time);
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
    const next = { ...settings, supplements: { ...settings.supplements, enabled } };
    updateSettings(next);
    if (!cloud) saveLocalSettings(next);
  }

  function handleTimeChange(slot, value) {
    const next = {
      ...settings,
      supplements: {
        ...settings.supplements,
        times: {
          ...settings.supplements.times,
          [slot]: value,
        },
      },
    };
    updateSettings(next);
  }

  function handleDailyPromptToggle(promptId, enabled) {
    const next = {
      ...settings,
      daily_prompts: {
        ...settings.daily_prompts,
        [promptId]: {
          ...settings.daily_prompts[promptId],
          enabled,
        },
      },
    };
    updateSettings(next);
    if (!cloud) saveLocalSettings(next);
  }

  function handleDailyPromptTime(promptId, value) {
    const next = {
      ...settings,
      daily_prompts: {
        ...settings.daily_prompts,
        [promptId]: {
          ...settings.daily_prompts[promptId],
          time: value,
        },
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
        Daily Prompts und Supplement-Reminder nutzen jetzt denselben Push-Unterbau mit interaktiven Actions und Deep-Links.
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
          checked={settings.supplements.enabled}
          onChange={(e) => handleToggleEnabled(e.target.checked)}
          className="h-4 w-4 accent-violet-400"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(settings.supplements.times).map(([slot, value]) => (
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

      <div className="grid gap-3">
        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Daily Prompts</div>

        <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
          <div>
            <div className="text-sm text-slate-200">Fuel Quick Log</div>
            <div className="text-xs text-slate-500">
              Oeffnet den AI-Freitext-Logger direkt im Notification-Flow.
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.daily_prompts.fuel_quick_log.enabled}
            onChange={(e) => handleDailyPromptToggle("fuel_quick_log", e.target.checked)}
            className="h-4 w-4 accent-violet-400"
          />
        </label>
        <input
          type="time"
          value={settings.daily_prompts.fuel_quick_log.time}
          onChange={(e) => handleDailyPromptTime("fuel_quick_log", e.target.value)}
          onBlur={handleTimeBlur}
          className={inputCls}
        />

        <label className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
          <div>
            <div className="text-sm text-slate-200">Journal Entry</div>
            <div className="text-xs text-slate-500">
              Springt direkt in die Tagesnotizen fuer einen kurzen Check-in.
            </div>
          </div>
          <input
            type="checkbox"
            checked={settings.daily_prompts.journal_entry.enabled}
            onChange={(e) => handleDailyPromptToggle("journal_entry", e.target.checked)}
            className="h-4 w-4 accent-violet-400"
          />
        </label>
        <input
          type="time"
          value={settings.daily_prompts.journal_entry.time}
          onChange={(e) => handleDailyPromptTime("journal_entry", e.target.value)}
          onBlur={handleTimeBlur}
          className={inputCls}
        />
      </div>

      {cloud && (
        <p className="text-xs text-amber-300">
          Cloud-Hinweis: Daily Prompts und Reminder werden ueber User-Settings plus FCM-Tokens aus der Cloud gelesen.
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

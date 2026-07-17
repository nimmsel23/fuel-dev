import { useState } from "react";
import { Check, Bell } from "lucide-react";
import { Empty } from "../../components/ui.jsx";
import { formatMetric, normalizeSupplementUnit } from "../../../shared/utils/utils.js";
import { isDueToday } from "./utils.js";
import { useSupplementMutations } from "./useSupplementMutations.js";

export default function DailyChecklist({ date, catalog, intakes }) {
  const { createIntake, deleteIntake } = useSupplementMutations(date);
  
  const intakeCountBySupplement = intakes.reduce((map, intake) => {
    map[intake.supplement_id] = (map[intake.supplement_id] || 0) + 1;
    return map;
  }, {});

  const dueTodayItems = catalog.filter(item => isDueToday(item, date));
  const groupedDue = {
    morning: dueTodayItems.filter(i => i.default_time_of_day === "morning"),
    midday: dueTodayItems.filter(i => i.default_time_of_day === "midday"),
    evening: dueTodayItems.filter(i => i.default_time_of_day === "evening"),
    night: dueTodayItems.filter(i => i.default_time_of_day === "night"),
    any: dueTodayItems.filter(i => i.default_time_of_day === "any" || !i.default_time_of_day)
  };

  const [pushStatus, setPushStatus] = useState(window.Notification ? Notification.permission : "unsupported");

  async function subscribeToPush() {
    if (!window.Notification || !navigator.serviceWorker) return;
    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission);
      if (permission !== "granted") return;

      if (isCloudMode) {
        const { messaging } = await import("../../../lib/firebase.js");
        const { getToken } = await import("firebase/messaging");
        const { saveFcmToken } = await import("../../../lib/db.firestore.js");
        
        if (!messaging) throw new Error("FCM is not supported in this browser.");
        
        const registration = await navigator.serviceWorker.ready;
        // VAPID key should ideally be provided in env, if not provided it might fail
        const token = await getToken(messaging, { 
          vapidKey: import.meta.env.VITE_VAPID_KEY,
          serviceWorkerRegistration: registration 
        });
        if (token) {
          await saveFcmToken(token);
          alert("Firebase Push-Benachrichtigungen (Cloud) aktiviert!");
        } else {
          throw new Error("Konnte kein FCM Token generieren.");
        }
      } else {
        const registration = await navigator.serviceWorker.ready;
        const response = await fetch("/push/vapidPublicKey");
        const { publicKey } = await response.json();
        
        const padding = '='.repeat((4 - publicKey.length % 4) % 4);
        const base64 = (publicKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true, applicationServerKey: outputArray
        });
        
        await fetch("/push/subscribe", {
          method: "POST", body: JSON.stringify(subscription), headers: { "Content-Type": "application/json" }
        });
        alert("Lokale Push-Benachrichtigungen aktiviert!");
      }
    } catch (err) {
      console.error("Push Error:", err);
      alert("Fehler bei Push-Aktivierung: " + err.message);
    }
  }

  function toggleIntake(item, isChecked) {
    if (isChecked) {
      const lastIntake = intakes.slice().reverse().find(i => i.supplement_id === item.id);
      if (lastIntake) deleteIntake.mutate({ delete_id: lastIntake.id });
    } else {
      createIntake.mutate({
        supplement_id: item.id, dose: item.default_dose ?? 0,
        unit: normalizeSupplementUnit(item.unit), time_of_day: item.default_time_of_day || "any",
      });
    }
  }

  // TODO: Check isCloud and hide Push if so
  const isCloudMode = window.location.hostname.includes("web.app") || window.location.hostname.includes("firebaseapp.com");

  return (
    <section className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-400" />
            <h3 className="text-lg font-semibold">Daily Habit Checklist</h3>
          </div>
          <p className="text-sm text-slate-400">Deine geplante Supplement-Routine für heute.</p>
        </div>
        <div className="flex items-center gap-2">
          {pushStatus !== "granted" && pushStatus !== "unsupported" && (
            <button onClick={subscribeToPush} className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-400/30 bg-violet-400/10 text-violet-300 transition hover:bg-violet-400/20" title="Push-Reminders aktivieren">
              <Bell className="h-4 w-4" />
            </button>
          )}
          <span className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-400">{date}</span>
        </div>
      </div>
      <div className="grid gap-6">
        {Object.entries(groupedDue).map(([time, items]) => {
          if (!items.length) return null;
          return (
            <div key={time}>
              <h4 className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">{time}</h4>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                  const isChecked = (intakeCountBySupplement[item.id] || 0) > 0;
                  return (
                    <div key={item.id} className={`group relative rounded-2xl border ${isChecked ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-slate-950/60'} p-4 transition hover:bg-slate-900 cursor-pointer`} onClick={() => toggleIntake(item, isChecked)}>
                      <div className="flex items-start justify-between gap-3">
                        <strong className={isChecked ? 'text-emerald-300' : 'text-slate-100'}>{item.name}</strong>
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${isChecked ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-slate-500'}`}>
                           {isChecked && <Check className="h-3 w-3" />}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-slate-400">{formatMetric(item.default_dose ?? 0)} {normalizeSupplementUnit(item.unit)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {dueTodayItems.length === 0 && <Empty text="Keine Supplements fuer heute geplant." />}
      </div>
      {createIntake.isError && <p className="mt-3 text-sm text-rose-300">{createIntake.error.message}</p>}
    </section>
  );
}

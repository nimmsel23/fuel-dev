import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase.js";
import { getUserSettings, getUid } from "../../lib/db.firestore.js";
import { withStorageFeedback } from "../../lib/storageFeedback.js";
import { TIME_LABELS } from "./utils.js";

const DEFAULTS = { morning: "08:00", midday: "13:00", evening: "19:00", night: "21:00" };

export default function ReminderSettings() {
  const query = useQuery({ queryKey: ["supp-reminders", getUid()], queryFn: getUserSettings });
  if (query.isPending) return <p role="status">Reminder werden geladen…</p>;
  if (query.isError) return <div role="alert"><p>{query.error.message}</p><button onClick={() => query.refetch()}>Erneut laden</button></div>;
  return <ReminderForm initial={query.data || {}} />;
}

function ReminderForm({ initial }) {
  const [enabled, setEnabled] = useState(initial.supplement_push_enabled ?? true);
  const [times, setTimes] = useState(Object.fromEntries(Object.entries(DEFAULTS).map(([slot, fallback]) => [slot, initial[`supplement_push_${slot}_time`] || fallback])));
  const [pushMessage, setPushMessage] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const save = useMutation({ mutationFn: () => withStorageFeedback("Supplement-Reminder", () => setDoc(doc(db, "users", getUid(), "meta", "settings"), {
    supplement_push_enabled: enabled,
    ...Object.fromEntries(Object.entries(times).map(([slot, time]) => [`supplement_push_${slot}_time`, time])),
    updated_at: serverTimestamp(),
  }, { merge: true })) });

  async function enablePush() {
    setSubscribing(true);
    setPushMessage("");
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) throw new Error("Push wird in diesem Browser nicht unterstützt.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Bitte Benachrichtigungen in den Browser-Einstellungen erlauben.");
      const { messaging } = await import("../../lib/firebase.js");
      const { getToken } = await import("firebase/messaging");
      const { saveFcmToken } = await import("../../lib/db.firestore.js");
      if (!messaging) throw new Error("Push wird in diesem Browser nicht unterstützt.");
      const registration = await navigator.serviceWorker.ready;
      const token = await getToken(messaging, { vapidKey: import.meta.env.VITE_VAPID_KEY, serviceWorkerRegistration: registration });
      if (!token) throw new Error("Kein Push-Token erhalten.");
      await saveFcmToken(token);
      setPushMessage("Dieses Gerät ist für Push registriert.");
    } catch (error) { setPushMessage(error.message); }
    finally { setSubscribing(false); }
  }

  return <section className="space-y-5 rounded-3xl border border-white/10 bg-white/5 p-5">
    <div><h3 className="text-lg font-semibold">Deine Erinnerungen</h3><p className="mt-2 text-sm text-slate-400">Lege die Uhrzeiten für deine Tagesroutine fest. Eigene Reminder am Produkt haben Vorrang.</p></div>
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-slate-950/50 p-4">Supplement-Reminder aktiv<input type="checkbox" checked={enabled} onChange={e => { setEnabled(e.target.checked); save.reset(); }} className="h-5 w-5 accent-lime-300" /></label>
    <div className="grid gap-4 sm:grid-cols-2">{Object.entries(times).map(([slot, time]) => <label key={slot} className="text-sm text-slate-300">{TIME_LABELS[slot]}<input type="time" required value={time} onChange={e => { setTimes({ ...times, [slot]: e.target.value }); save.reset(); }} className="mt-2 block w-full rounded-xl border border-white/10 bg-slate-950/60 p-3" /></label>)}</div>
    <div className="flex flex-wrap gap-3"><button disabled={save.isPending || Object.values(times).some(time => !/^\d{2}:\d{2}$/.test(time))} onClick={() => save.mutate()} className="rounded-full bg-lime-300 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">{save.isPending ? "Speichert…" : "Zeiten speichern"}</button><button disabled={subscribing} onClick={enablePush} className="rounded-full border border-white/20 px-4 py-3 text-sm disabled:opacity-50">{subscribing ? "Registriert…" : "Push auf diesem Gerät aktivieren"}</button></div>
    {save.isError && <p role="alert" className="text-sm text-rose-300">{save.error.message}</p>}
    {save.isSuccess && <p role="status" className="text-sm text-lime-200">Reminder gespeichert.</p>}
    {pushMessage && <p role="status" className="text-sm text-slate-300">{pushMessage}</p>}
  </section>;
}

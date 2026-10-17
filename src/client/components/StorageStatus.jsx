import { useEffect, useState } from "react";
import { useIsMutating, useMutationState, useQueryClient } from "@tanstack/react-query";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase.js";
import { watchAuth } from "../lib/db/firestore/core.js";
import { discardCloudOperation, flushCloudOutbox, outboxEntries, OUTBOX_EVENT } from "../lib/cloudOutbox.js";
import { STORAGE_FEEDBACK_EVENT } from "../lib/storageFeedback.js";
import { useApp } from "../store.js";

export default function StorageStatus() {
  const cloud = import.meta.env.VITE_APP_MODE === "client";
  const qc = useQueryClient();
  const date = useApp(s => s.activeDate);
  const [uid, setUid] = useState(auth.currentUser?.uid);
  const [online, setOnline] = useState(navigator.onLine);
  const [entries, setEntries] = useState([]);
  const [snapshots, setSnapshots] = useState({});
  const [queryErrors, setQueryErrors] = useState([]);
  const [error, setError] = useState("");
  const [writeFailure, setWriteFailure] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const mutating = useIsMutating();
  const mutationErrors = useMutationState({ filters: { status: "error" }, select: m => ({ error: m.state.error, time: m.state.submittedAt }) });
  const [dismissedAt, setDismissedAt] = useState(0);
  const recentError = mutationErrors.find(e => e.time > dismissedAt)?.error;

  useEffect(() => watchAuth(user => { setUid(user?.uid); setError(""); setWriteFailure(null); setDismissedAt(Date.now()); }), []);
  useEffect(() => {
    const feedback = e => setWriteFailure(old => e.detail.error ? e.detail : old?.label === e.detail.label ? null : old);
    window.addEventListener(STORAGE_FEEDBACK_EVENT, feedback);
    return () => window.removeEventListener(STORAGE_FEEDBACK_EVENT, feedback);
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  useEffect(() => {
    const update = () => setQueryErrors(qc.getQueryCache().getAll().filter(q => q.state.status === "error" && q.getObserversCount() > 0));
    update();
    return qc.getQueryCache().subscribe(update);
  }, [qc]);
  useEffect(() => {
    if (!cloud || !uid) { setEntries([]); return; }
    const refresh = event => {
      if (event?.entry?.uid === uid && event.entry.kind === "supplements") {
        void qc.invalidateQueries({ queryKey: ["supp-log", event.entry.date], exact: true });
        void qc.invalidateQueries({ queryKey: ["supp-stats"] });
      }
      try { setEntries(outboxEntries(uid)); } catch (e) { setError(`Warteschlange nicht lesbar: ${e.message}`); }
    };
    let running = false;
    const flush = async () => {
      if (running || !navigator.onLine || auth.currentUser?.uid !== uid) return;
      running = true;
      try {
        await flushCloudOutbox();
        setError("");
        // Update cached views after reconnect/replay, including frontdoors.
        qc.invalidateQueries();
      } catch (e) { setError(e.message); }
      finally { running = false; refresh(); }
    };
    refresh(); void flush();
    const timer = setInterval(() => {
      try { if (outboxEntries(uid).some(e => !e.blocked)) void flush(); } catch (e) { setError(e.message); }
    }, 15000);
    window.addEventListener(OUTBOX_EVENT, refresh); window.addEventListener("storage", refresh); window.addEventListener("online", flush);
    return () => { clearInterval(timer); window.removeEventListener(OUTBOX_EVENT, refresh); window.removeEventListener("storage", refresh); window.removeEventListener("online", flush); };
  }, [cloud, uid, qc]);
  useEffect(() => {
    setSnapshots({});
    if (!cloud || !uid) return;
    const paths = [["nutrition", uid, "logs", date], ["supplements", uid, "logs", date], ["nutrition", uid, "journal", date], ["users", uid, "meta", "settings"], ["users", uid, "meta", "fuelFrame"]];
    const stops = paths.map((parts, i) => onSnapshot(doc(db, ...parts), { includeMetadataChanges: true }, snap => {
      setSnapshots(old => ({ ...old, [i]: { pending: snap.metadata.hasPendingWrites, cached: snap.metadata.fromCache } }));
    }, e => { setSnapshots(old => ({ ...old, [i]: { error: e.message } })); }));
    return () => stops.forEach(stop => stop());
  }, [cloud, uid, date]);

  const values = Object.values(snapshots);
  const pending = entries.length || values.some(s => s.pending);
  const problem = error || (writeFailure ? `${writeFailure.label}: ${writeFailure.error}. Bitte erneut speichern.` : "") || recentError?.message || values.find(s => s.error)?.error;
  const retry = async () => {
    setRetrying(true); setError(""); setDismissedAt(Date.now());
    try { if (cloud && uid) await flushCloudOutbox(); await qc.refetchQueries({ type: "active" }); }
    catch (e) { setError(e.message); }
    finally { setRetrying(false); }
  };
  if (cloud && !uid) return null;
  return (
    <aside aria-label="Speicherstatus" className="sticky top-0 z-50 border-b border-white/10 bg-slate-950 px-4 py-2 text-xs text-slate-300">
      <div role="status" aria-live="polite">
        {!online ? "Offline" : problem || queryErrors.length ? "Speichern / Laden fehlgeschlagen" : mutating ? "Speichert …" : pending ? "Synchronisierung ausstehend" : cloud ? (values.length === 5 && values.every(s => !s.cached && !s.error) ? "Aktueller Tag synchronisiert" : "Cloud-Verbindung wird geprüft …") : "Lokaler Speicher"}
        {entries.length > 0 && ` · ${entries.length} Änderung(en) auf diesem Gerät gespeichert, Cloud-Bestätigung ausstehend`}
        {values.some(s => s.cached) && " · Daten aus lokalem Cache"}
      </div>
      {(problem || queryErrors.length > 0) && <p role="alert" className="mt-1 text-rose-300">{problem || "Daten konnten nicht geladen werden. Angezeigte Werte sind möglicherweise unvollständig."}</p>}
      {(pending || problem || queryErrors.length > 0) && <button type="button" onClick={retry} disabled={!online || retrying} className="mt-1 underline disabled:opacity-50">{retrying ? "Prüft …" : "Erneut synchronisieren / laden"}</button>}
      {writeFailure && <button type="button" className="ml-3 underline" onClick={() => setWriteFailure(null)}>Meldung ausblenden</button>}
      {entries.filter(e => e.blocked).map(entry => <div key={entry.id} className="mt-2 text-rose-300">
        {entry.date || entry.kind}: {entry.error}
        <button type="button" className="ml-3 underline" onClick={() => {
          discardCloudOperation(entry.id); qc.invalidateQueries();
        }}>Fehlgeschlagene Änderung verwerfen</button>
      </div>)}
    </aside>
  );
}

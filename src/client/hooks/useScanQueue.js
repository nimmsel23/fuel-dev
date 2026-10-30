import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase.js";
import { createScanQueue } from "../lib/scanQueue.js";

const cloud = import.meta.env.VITE_APP_MODE === "client";
const currentOwner = () => cloud ? auth.currentUser?.uid : "local";
const queue = createScanQueue(currentOwner);

export function useScanQueue() {
  const [owner, setOwner] = useState(currentOwner);
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState("");
  const mounted = useRef(false);
  const refresh = async () => {
    const uid = currentOwner();
    if (!uid) { setEntries([]); return; }
    try {
      const next = await queue.list(uid);
      if (mounted.current && currentOwner() === uid) { setEntries(next); setError(""); }
    } catch (err) { if (mounted.current) setError(err.message || "Foto-Warteliste konnte nicht geladen werden."); }
  };
  useEffect(() => {
    mounted.current = true;
    const unsubscribe = onAuthStateChanged(auth, () => {
      setOwner(currentOwner()); setEntries([]); refresh();
    });
    refresh();
    return () => { mounted.current = false; unsubscribe(); };
  }, []);
  return {
    owner, entries: owner === currentOwner() ? entries : [], error,
    async add(file, date, scanType) {
      const entry = await queue.add(currentOwner(), file, date, scanType);
      await refresh(); return entry;
    },
    async remove(entry) { await queue.remove(entry.owner, entry.id); await refresh(); },
    isOwner: uid => !!uid && uid === currentOwner(),
  };
}

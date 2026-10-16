import { useEffect, useRef, useState } from "react";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { watchAuth } from "../../lib/db/firestore/core.js";
import { exportCloudBackup, previewCloudRestore, restoreCloudBackup } from "../../lib/cloudBackup.js";
import { summarizeBackup } from "../../lib/backupFormat.js";
import { useSettings } from "../../store.js";

const labels = { 'nutrition-log': 'Ernährungstage', 'nutrition-note': 'Tagesnotizen', 'nutrition-catalog': 'Essenskatalog', 'supplement-log': 'Supplement-Tage', 'supplement-catalog': 'Supplement-Katalog', settings: 'Einstellungen / Profil', 'fuel-frame': 'Fuel Frame' };
export default function BackupCard({ sectionCls }) {
  const qc = useQueryClient();
  const mutations = useIsMutating();
  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);
  const generation = useRef(0);
  useEffect(() => {
    const stop = watchAuth(u => { generation.current++; setUser(u); setPreview(null); setMessage(""); setError(""); });
    return () => { generation.current++; stop(); };
  }, []);
  const run = async fn => {
    const token = generation.current;
    setBusy(true); setError(""); setMessage("");
    try { await fn(() => token === generation.current); }
    catch (e) { if (token === generation.current) setError(e.message); }
    finally { setBusy(false); }
  };
  const download = () => run(async active => {
    const backup = await exportCloudBackup();
    if (!active()) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `fuel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`${backup.documents.length} Cloud-Dokumente als Backup bereitgestellt.`);
  });
  const select = e => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setPreview(null);
    run(async active => {
      if (file.size > 10 * 1024 * 1024) throw new Error("Backup-Datei ist größer als 10 MB.");
      let input;
      try { input = JSON.parse(await file.text()); } catch { throw new Error("Die Datei enthält kein lesbares JSON."); }
      const result = await previewCloudRestore(input);
      if (active()) setPreview(result);
    });
  };
  const restore = () => run(async active => {
    const result = await restoreCloudBackup(preview.backup, (done, total) => { if (active()) setMessage(`${done}/${total} Dokumente geprüft …`); });
    if (!active()) return;
    setPreview(null);
    await qc.invalidateQueries();
    await useSettings.getState().hydrateFromCloud();
    setMessage(`Wiederherstellung abgeschlossen: ${result.changed} Dokumente ergänzt. Vorhandene Einträge wurden beibehalten.`);
  });
  return <section className={sectionCls}>
    <h2 className="text-lg font-semibold">Cloud-Backup & Wiederherstellung</h2>
    <p className="text-sm text-slate-400">Sichert Ernährung, Wasser, Tagesnotizen, Supplements, private Kataloge, Profil und Fuel Frame des angemeldeten Kontos als JSON-Datei. Quelle ist Firestore; lokale Serverdaten sind separat.</p>
    {!user && <p className="text-sm text-amber-200">Bitte zuerst anmelden.</p>}
    {user && <p className="text-xs text-slate-400">Konto: {user.email || user.uid}</p>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy || !user || mutations > 0} onClick={download} className="rounded-xl bg-sky-300 px-4 py-3 text-slate-950 disabled:opacity-50">Backup herunterladen</button>
      <button type="button" disabled={busy || !user || mutations > 0} onClick={() => fileRef.current?.click()} className="rounded-xl border border-white/20 px-4 py-3 disabled:opacity-50">Backup-Datei prüfen</button>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={select} className="hidden" aria-label="Backup-Datei auswählen" />
    </div>
    {preview && <div className="grid gap-3 rounded-xl border border-white/15 p-4">
      <p>Backup vom {new Date(preview.backup.exportedAt).toLocaleString('de-AT')}</p>
      <ul className="text-sm text-slate-300">{Object.entries(summarizeBackup(preview.backup)).map(([kind, count]) => <li key={kind}>{labels[kind]}: {count}</li>)}</ul>
      <p className="text-sm">Vorschau: {preview.addedDocuments} neue Dokumente, {preview.addedEntries} ergänzte Einträge; insgesamt {preview.changedDocuments} Dokumente mit Ergänzungen. Der aktuelle Stand hat bei Konflikten Vorrang. Löschmarkierungen bleiben wirksam.</p>
      <button type="button" disabled={busy || mutations > 0} onClick={restore} className="rounded-xl bg-emerald-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-50">Fehlende Daten jetzt wiederherstellen</button>
      <button type="button" disabled={busy} onClick={() => setPreview(null)} className="text-sm underline">Abbrechen</button>
    </div>}
    {busy && <p role="status">Vorgang läuft …</p>}
    {message && <p role="status" className="text-sm text-emerald-200">{message}</p>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
  </section>;
}

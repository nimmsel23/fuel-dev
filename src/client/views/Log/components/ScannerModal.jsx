import { useState, useRef, useEffect } from "react";
import { Camera, Upload, Loader2, RotateCcw } from "lucide-react";
import { Modal } from "../../../components/ui.jsx";
import { decodeBarcode, lookupBarcode } from "../../../lib/barcode.js";
import { analyzeMealImage } from "../../../lib/visionScan.js";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@api";
import { catalogToMeal } from "../../../lib/mealDetails.js";
import { useScanQueue } from "../../../hooks/useScanQueue.js";

export default function ScannerModal({ onClose, onResult, date, initialFile = null }) {
  const [mode, setMode] = useState("food");
  const [catalogName, setCatalogName] = useState("");
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const queue = useScanQueue();
  const { data: catalog } = useQuery({ queryKey: ["nutrition-catalog"], queryFn: () => fetchJson("nutrition/catalog") });
  const catalogHits = catalogName.trim().length >= 2
    ? (catalog?.items || []).filter(i => String(i.name || i.description || "").toLocaleLowerCase().includes(catalogName.trim().toLocaleLowerCase())).slice(0, 5) : [];
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const [barcode, setBarcode] = useState("");
  const requestRef = useRef(null);
  const closedRef = useRef(false);
  useEffect(() => { closedRef.current = false; return () => { closedRef.current = true; requestRef.current?.abort(); }; }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const lastFileRef = useRef(null);
  const queuedRef = useRef(null);
  const originalOwner = useRef(queue.owner);
  useEffect(() => {
    if (originalOwner.current !== queue.owner) onClose();
  }, [queue.owner, onClose]);

  const saveForLater = async () => {
    setLoading(true); setError("");
    try {
      if (!queuedRef.current) queuedRef.current = await queue.add(lastFileRef.current, date, mode);
      if (!closedRef.current) setNotice("Foto auf diesem Gerät gesichert. Später mit „Analysieren“ fortsetzen; gespeichert wird die Mahlzeit erst nach deiner Bestätigung.");
    } catch (err) { if (!closedRef.current) setError(err.message || "Foto konnte nicht gesichert werden."); }
    finally { if (!closedRef.current) setLoading(false); }
  };

  const acceptResult = (res) => {
    if (closedRef.current) return;
    onResult(res); onClose();
  };
  const findProduct = async () => {
    setLoading(true); setError("");
    const owner = queue.owner;
    requestRef.current = new AbortController();
    try {
      const result = await lookupBarcode(barcode, { signal: requestRef.current.signal });
      if (queue.isOwner(owner)) acceptResult(result);
    }
    catch (e) { if (!closedRef.current) setError(e.message || "Produktabfrage fehlgeschlagen."); }
    finally { if (!closedRef.current) setLoading(false); }
  };

  const processImage = async (file, queuedEntry = null) => {
    if (!file) return;
    const owner = queue.owner;
    const scanType = queuedEntry?.scanType || mode;
    lastFileRef.current = file;
    queuedRef.current = queuedEntry;
    setNotice("");
    if (!navigator.onLine && scanType !== "barcode") { await saveForLater(); return; }
    setLoading(true);
    setError("");

    try {
      // Gemeinsame Vision-Pipeline (lib/visionScan.js) — identisch mit dem
      // Shutter-Frontdoor, damit es nur eine Implementierung gibt.
      requestRef.current = new AbortController();
      const res = scanType === "barcode"
        ? await lookupBarcode(await decodeBarcode(file), { signal: requestRef.current.signal })
        : await analyzeMealImage(file, { scanType });
      if (closedRef.current || !queue.isOwner(owner)) return;
      if (queuedEntry) await queue.remove(queuedEntry);
      acceptResult(res);
    } catch (e) {
      console.error(e);
      if (!closedRef.current) setError(e.message || "Fehler beim Scannen.");
    } finally {
      if (!closedRef.current) setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    processImage(file);
  };
  const initialStarted = useRef(false);
  useEffect(() => {
    if (initialFile && !initialStarted.current) {
      initialStarted.current = true;
      processImage(initialFile);
    }
  }, [initialFile]);

  return (
    <Modal
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title="Essen & Barcodes scannen"
      description="Essen per KI schätzen oder ein Produkt anhand seines Barcodes nachschlagen."
    >
      <div className="space-y-4">
        <label className="block text-sm">Bekanntes Essen? Ohne KI aus dem Katalog übernehmen
          <input value={catalogName} onChange={e => setCatalogName(e.target.value)} disabled={loading}
            placeholder="Name suchen" className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 p-3" />
        </label>
        {catalogHits.map(item => <button key={item.id || item.name} type="button" disabled={loading}
          onClick={() => { try { acceptResult(catalogToMeal(item)); } catch (err) { setError(err.message); } }}
          className="block w-full rounded-xl border border-sky-300/30 p-3 text-left text-sm text-sky-200">
          {item.name || item.description} · Katalogportion übernehmen
        </button>)}
        {catalogName.trim().length >= 2 && !catalogHits.length && <p className="text-xs text-slate-400">Kein passender Katalogeintrag. Foto analysieren oder Barcode suchen.</p>}
        <div className="flex flex-wrap gap-3">
          {[['food', 'Essen'], ['label', 'Etikett / Beleg'], ['barcode', 'Barcode']].map(([key, label]) => <button type="button" key={key} disabled={loading} aria-pressed={mode === key}
            onClick={() => { setMode(key); setError(""); setNotice(""); lastFileRef.current = null; queuedRef.current = null; }}
            className={`rounded-xl border px-4 py-2 ${mode === key ? "border-sky-300 text-sky-200" : "border-white/10"}`}>{label}</button>)}
        </div>
        {mode === "label" && <p className="text-xs text-slate-400">Höhere Bildauflösung für kleine Schrift. Etikett flach, nah und scharf fotografieren; Portion anschließend prüfen.</p>}
        <div className="rounded-xl border border-white/10 p-3 text-sm" aria-live="polite">
          <p>{online ? "Online" : "Offline"} · {queue.entries.length} wartende Fotos auf diesem Gerät</p>
          {queue.error && <p className="text-red-300">{queue.error}</p>}
          {notice && <p className="mt-2 text-sky-200">{notice}</p>}
          {queue.entries.map(entry => <div key={entry.id} className="mt-2 flex flex-wrap items-center gap-2">
            <span className="min-w-0 break-all">{entry.date} · {entry.file.name || "Foto"}</span>
            {entry.date === date
              ? <button type="button" disabled={loading || !online} onClick={() => { setMode(entry.scanType); processImage(entry.file, entry); }} className="rounded-lg border border-white/20 px-2 py-1 disabled:opacity-40">Analysieren</button>
              : <span className="text-xs text-slate-400">Zum Fortsetzen dieses Datum im Log wählen.</span>}
            <button type="button" disabled={loading} onClick={() => queue.remove(entry).catch(err => setError(err.message))} className="rounded-lg border border-white/20 px-2 py-1">Entfernen</button>
          </div>)}
        </div>
        {mode === "barcode" && <form onSubmit={e => { e.preventDefault(); findProduct(); }} className="grid gap-3">
          <label className="text-sm">EAN / UPC
            <input value={barcode} onChange={e => setBarcode(e.target.value)} inputMode="numeric" autoComplete="off" required
              className="mt-1 w-full rounded-xl border border-white/20 bg-slate-900 p-3" placeholder="Barcode-Nummer" />
          </label>
          <button type="submit" disabled={loading || !barcode.trim()} className="rounded-xl bg-sky-300 p-3 text-slate-950 disabled:opacity-50">Produkt suchen</button>
          <p className="text-xs text-slate-400">Produktwerte pro 100 g von <a className="underline" href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a> (ODbL). Portionsgewicht anschließend prüfen und anpassen. Bekannte Produkte sind 30 Tage offline verfügbar.</p>
          {!("BarcodeDetector" in globalThis) && <p className="text-xs text-amber-200">Dieser Browser unterstützt keine Barcode-Fotos. Die Nummerneingabe funktioniert hier ebenfalls.</p>}
        </form>}
        {error && (
          <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-400 border border-red-500/20 flex items-center justify-between gap-3">
            <span>{error}</span>
            {lastFileRef.current && (
              <button
                disabled={loading}
                onClick={() => processImage(lastFileRef.current, queuedRef.current)}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/30 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Erneut versuchen
              </button>
            )}
          </div>
        )}
        {error && lastFileRef.current && mode !== "barcode" && !queuedRef.current && <button type="button" disabled={loading} onClick={saveForLater} className="rounded-xl border border-white/20 p-3 text-sm">Foto für später sichern</button>}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
            <p>{mode === "barcode" ? "Barcode / Produkt wird gelesen …" : "Gemini analysiert das Bild …"}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-900 p-8 hover:bg-slate-800 transition-colors"
            >
              <Camera className="h-8 w-8 text-sky-400" />
              <span className="font-semibold text-slate-200">Kamera</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-slate-900 p-8 hover:bg-slate-800 transition-colors"
            >
              <Upload className="h-8 w-8 text-violet-400" />
              <span className="font-semibold text-slate-200">Foto wählen</span>
            </button>
          </div>
        )}

        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          ref={cameraInputRef}
          onChange={handleFileChange}
        />
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
      </div>
    </Modal>
  );
}

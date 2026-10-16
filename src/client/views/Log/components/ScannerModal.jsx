import { useState, useRef, useEffect } from "react";
import { Camera, Upload, X, Loader2, RotateCcw } from "lucide-react";
import { Modal } from "../../../components/ui.jsx";
import { decodeBarcode, lookupBarcode } from "../../../lib/barcode.js";
import { analyzeMealImage } from "../../../lib/visionScan.js";

export default function ScannerModal({ onClose, onResult }) {
  const [mode, setMode] = useState("food");
  const [barcode, setBarcode] = useState("");
  const requestRef = useRef(null);
  const closedRef = useRef(false);
  useEffect(() => { closedRef.current = false; return () => { closedRef.current = true; requestRef.current?.abort(); }; }, []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const lastFileRef = useRef(null);

  const acceptResult = (res) => {
    if (closedRef.current) return;
    onResult(res); onClose();
  };
  const findProduct = async () => {
    setLoading(true); setError("");
    requestRef.current = new AbortController();
    try { acceptResult(await lookupBarcode(barcode, { signal: requestRef.current.signal })); }
    catch (e) { if (!closedRef.current) setError(e.message || "Produktabfrage fehlgeschlagen."); }
    finally { if (!closedRef.current) setLoading(false); }
  };

  const processImage = async (file) => {
    if (!file) return;
    lastFileRef.current = file;
    setLoading(true);
    setError("");

    try {
      // Gemeinsame Vision-Pipeline (lib/visionScan.js) — identisch mit dem
      // Shutter-Frontdoor, damit es nur eine Implementierung gibt.
      requestRef.current = new AbortController();
      const res = mode === "barcode"
        ? await lookupBarcode(await decodeBarcode(file), { signal: requestRef.current.signal })
        : await analyzeMealImage(file);
      acceptResult(res);
    } catch (e) {
      console.error(e);
      setError(e.message || "Fehler beim Scannen.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    processImage(file);
  };

  return (
    <Modal
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title="Essen & Barcodes scannen"
      description="Essen per KI schätzen oder ein Produkt anhand seines Barcodes nachschlagen."
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          {[['food', 'Essen / Etikett'], ['barcode', 'Barcode']].map(([key, label]) => <button type="button" key={key} disabled={loading} aria-pressed={mode === key}
            onClick={() => { setMode(key); setError(""); lastFileRef.current = null; }}
            className={`rounded-xl border px-4 py-2 ${mode === key ? "border-sky-300 text-sky-200" : "border-white/10"}`}>{label}</button>)}
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
                onClick={() => processImage(lastFileRef.current)}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/30 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Erneut versuchen
              </button>
            )}
          </div>
        )}

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

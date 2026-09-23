import { useState, useRef } from "react";
import { Camera, Upload, X, Loader2, RotateCcw } from "lucide-react";
import { Modal } from "../../../components/ui.jsx";
import { analyzeMealImage } from "../../../lib/visionScan.js";

export default function ScannerModal({ onClose, onResult }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const lastFileRef = useRef(null);

  const processImage = async (file) => {
    if (!file) return;
    lastFileRef.current = file;
    setLoading(true);
    setError("");

    try {
      // Gemeinsame Vision-Pipeline (lib/visionScan.js) — identisch mit dem
      // Shutter-Frontdoor, damit es nur eine Implementierung gibt.
      const res = await analyzeMealImage(file);
      onResult(res);
      onClose();
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
      description="Fotografiere dein Essen, scanne einen Barcode oder lade eine Einkaufsquittung hoch."
    >
      <div className="space-y-4">
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
            <p>Gemini analysiert das Bild...</p>
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

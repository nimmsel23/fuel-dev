import { useState, useRef } from "react";
import { Camera, Upload, X, Loader2 } from "lucide-react";
import { Modal } from "./ui.jsx";
import { postJson } from "@api";

export default function ScannerModal({ onClose, onResult }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const processImage = async (file) => {
    if (!file) return;
    setLoading(true);
    setError("");

    try {
      // Create an image object to compress via canvas
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
      });

      // Compress to max 800px width/height
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;
      const maxSize = 800;

      if (width > height && width > maxSize) {
        height *= maxSize / width;
        width = maxSize;
      } else if (height > maxSize) {
        width *= maxSize / height;
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const base64Data = canvas.toDataURL("image/jpeg", 0.7);

      // Send to backend (adjust endpoint as needed for Vite proxy or direct)
      // Since this is the local node app, we use our standard api handler
      // Wait, the API handler maps to the python backend if properly routed.
      // We added /nutrition/vision to fuel-fastapi-server.py
      // But how does the UI talk to it? Through the Node server.
      // So we must add a /nutrition/vision route to Node server to proxy it, OR call it directly.
      const res = await postJson("/nutrition/vision", {
        image_b64: base64Data,
        mime_type: "image/jpeg"
      });

      if (res.macros) {
        onResult({
          description: res.name || "Gescannte Mahlzeit",
          ...res.macros
        });
        onClose();
      } else {
        throw new Error("Konnte keine Makros erkennen.");
      }
    } catch (e) {
      console.error(e);
      setError(e.message || "Fehler beim Scannen.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => processImage(e.target.files[0]);

  return (
    <Modal
      open={true}
      onOpenChange={(open) => !open && onClose()}
      title="Essen & Barcodes scannen"
      description="Fotografiere dein Essen, scanne einen Barcode oder lade eine Einkaufsquittung hoch."
    >
      <div className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-400 border border-red-500/20">
            {error}
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

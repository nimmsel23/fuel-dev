import { useState, useRef } from "react";
import { Camera, Upload, X, Loader2, RotateCcw } from "lucide-react";
import { Modal } from "../../../components/ui.jsx";
import { postJson } from "@api";
import { vertexAI } from "../../../lib/firebase.js";
import { getGenerativeModel } from "firebase/vertexai";
import { withAiRetry } from "../../../lib/aiRetry.js";

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
      const b64Raw = base64Data.split(",")[1];
      const cloud = import.meta.env.VITE_APP_MODE === "client";
      
      let macrosResult;
      
      if (cloud) {
        // Vertex AI Cloud Mode
        const { MICRO_KEYS } = await import("../../../lib/db/firestore/utils.js");
        const { SchemaType } = await import("firebase/vertexai");
        const model = getGenerativeModel(vertexAI, { 
          model: "gemini-2.5-flash",
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING, description: "Identifiziertes Essen" },
                grams: { type: SchemaType.NUMBER, description: "Geschätztes/erkanntes Gewicht der Portion in Gramm, auf das sich die Makros beziehen (z.B. von einer Verpackungsangabe oder geschätzter Portionsgröße)." },
                macros: {
                  type: SchemaType.OBJECT,
                  properties: {
                    kcal: { type: SchemaType.NUMBER },
                    protein: { type: SchemaType.NUMBER },
                    carbs: { type: SchemaType.NUMBER },
                    fat: { type: SchemaType.NUMBER }
                  }
                },
                micros: {
                  type: SchemaType.OBJECT,
                  properties: Object.fromEntries(MICRO_KEYS.map(k => [k, { type: SchemaType.NUMBER, description: "Wert in mg oder ug" }]))
                }
              }
            }
          }
        });

        const prompt = "Dies ist ein Foto von Essen, einem Barcode oder einer Einkaufsquittung. Identifiziere die Mahlzeit oder Zutaten und schätze die Nährwerte (Makros) sowie die genauen Mikronährstoffe (Vitamine, Mineralstoffe) so genau wie möglich ab. Gib außerdem in 'grams' an, auf welches Gewicht (in Gramm) sich diese Makros beziehen — von einer erkannten Verpackungsangabe oder sonst deiner besten Schätzung der abgebildeten Portionsgröße.";

        const result = await withAiRetry(() => model.generateContent([
          prompt,
          { inlineData: { data: b64Raw, mimeType: "image/jpeg" } }
        ]));
        const text = result.response.text();
        macrosResult = JSON.parse(text);

        if (macrosResult && macrosResult.micros) {
          const mealName = macrosResult.name || "Gescannte Mahlzeit";
          await postJson("/nutrition/micros", {
            items: [{
              meal_name: mealName,
              kcal: macrosResult.macros?.kcal || 0,
              ...Object.fromEntries(MICRO_KEYS.map(k => [k, macrosResult.micros[k] || 0]))
            }]
          });
        }
      } else {
        // Local Mode via Python Backend
        macrosResult = await postJson("/nutrition/vision", {
          image_b64: b64Raw,
          mime_type: "image/jpeg"
        });
      }

      if (macrosResult && macrosResult.macros) {
        onResult({
          description: macrosResult.name || "Gescannte Mahlzeit",
          grams: macrosResult.grams || null,
          ...macrosResult.macros
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

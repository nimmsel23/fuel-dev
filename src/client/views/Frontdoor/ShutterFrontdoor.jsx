import React from "react";
import { Camera, Loader2, RotateCcw, Type, X, ImageUp } from "lucide-react";
import { analyzeMealImage } from "../../lib/visionScan.js";

// Frontdoor "Shutter": die App öffnet direkt in den Sucher. Auslösen ist
// Loggen — das Bild geht durch dieselbe Vision-Pipeline wie der Scanner im
// Log-Tab (lib/visionScan.js), das Ergebnis kommt als Blatt über dem Foto.
export default function ShutterFrontdoor({ fd, onOpenApp }) {
  const { logMeal, catalogItems } = fd;
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const fileRef = React.useRef(null);
  const lastFileRef = React.useRef(null);

  const [camError, setCamError] = React.useState("");
  const [phase, setPhase] = React.useState("view"); // view | analyzing | result
  const [error, setError] = React.useState("");
  const [shot, setShot] = React.useState(null); // dataURL
  const [result, setResult] = React.useState(null);
  const [factor, setFactor] = React.useState(1);

  // Sucher nur laufen lassen, solange er sichtbar ist — spart Akku, sobald
  // das Ergebnis-Blatt oben ist.
  React.useEffect(() => {
    let cancelled = false;
    async function start() {
      if (phase !== "view") return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamError("");
      } catch (err) {
        console.warn("Kamera nicht verfügbar:", err);
        setCamError("Kamera nicht freigegeben. Du kannst stattdessen ein Foto auswählen oder tippen.");
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [phase]);

  const runAnalysis = async (file, previewUrl) => {
    lastFileRef.current = file;
    setShot(previewUrl);
    setPhase("analyzing");
    setError("");
    try {
      const res = await analyzeMealImage(file);
      setResult(res);
      setFactor(1);
      setPhase("result");
    } catch (err) {
      setError(err.message || "Analyse fehlgeschlagen.");
      setPhase("result");
      setResult(null);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    await runAnalysis(new File([blob], "shutter.jpg", { type: "image/jpeg" }), dataUrl);
  };

  const onPick = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) runAnalysis(file, URL.createObjectURL(file));
  };

  const reset = () => {
    setPhase("view");
    setResult(null);
    setShot(null);
    setError("");
  };

  // Katalog schlägt Schätzung: gibt es einen Treffer mit gleichem Namen,
  // wird er als verlässlichere Quelle angeboten.
  const catalogHit = React.useMemo(() => {
    if (!result?.description) return null;
    const q = result.description.toLowerCase();
    return catalogItems.find((i) => i.name && (q.includes(i.name.toLowerCase()) || i.name.toLowerCase().includes(q))) || null;
  }, [result, catalogItems]);

  const save = (source) => {
    const base = source === "catalog" && catalogHit
      ? { description: catalogHit.name, kcal: catalogHit.kcal, protein: catalogHit.protein, carbs: catalogHit.carbs, fat: catalogHit.fat, catalog_id: catalogHit.id }
      : result;
    logMeal.mutate({
      ...base,
      kcal: (base.kcal || 0) * factor,
      protein: (base.protein || 0) * factor,
      carbs: (base.carbs || 0) * factor,
      fat: (base.fat || 0) * factor,
      notes: source === "catalog" ? "Foto-Log, Makros aus Katalog" : "Foto-Log (Gemini Vision)",
    }, { onSuccess: reset });
  };

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-black" style={{ aspectRatio: "9 / 16" }}>
      {/* Sucher bzw. eingefrorenes Foto */}
      {phase === "view" ? (
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        shot && <img src={shot} alt="Aufgenommene Mahlzeit" className="absolute inset-0 h-full w-full object-cover brightness-50" />
      )}

      {phase === "view" && camError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950 p-8 text-center">
          <Camera className="h-10 w-10 text-slate-600" />
          <p className="text-sm text-slate-400">{camError}</p>
        </div>
      )}

      {/* Kopfzeile */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-3 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {phase === "view" ? "Teller anvisieren" : phase === "analyzing" ? "Analyse" : "Foto aufgenommen"}
        </span>
        {phase !== "view" && (
          <button onClick={reset} aria-label="Verwerfen" className="grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Fokus-Ecken */}
      {phase === "view" && !camError && (
        <div className="pointer-events-none absolute inset-x-10 top-1/4 h-1/3">
          {["left-0 top-0 border-r-0 border-b-0", "right-0 top-0 border-l-0 border-b-0", "left-0 bottom-0 border-r-0 border-t-0", "right-0 bottom-0 border-l-0 border-t-0"].map((cls) => (
            <span key={cls} className={`absolute h-7 w-7 border-2 border-emerald-400/80 ${cls}`} />
          ))}
        </div>
      )}

      {/* Auslöser */}
      {phase === "view" && (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-8 pb-8">
          <button onClick={() => fileRef.current?.click()} aria-label="Foto wählen" className="grid h-12 w-12 place-items-center rounded-xl border border-white/25 bg-black/50 text-white backdrop-blur">
            <ImageUp className="h-5 w-5" />
          </button>
          <button
            onClick={capture}
            disabled={!!camError}
            aria-label="Auslösen und loggen"
            className="grid h-20 w-20 place-items-center rounded-full border-[3px] border-white bg-white/20 backdrop-blur disabled:opacity-40"
          >
            <span className="block h-[60px] w-[60px] rounded-full bg-white" />
          </button>
          <button onClick={() => onOpenApp("log")} aria-label="Stattdessen tippen" className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur">
            <Type className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Analyse */}
      {phase === "analyzing" && (
        <div className="absolute inset-x-4 bottom-6 rounded-2xl border border-white/10 bg-slate-950/90 p-5 backdrop-blur">
          <div className="flex items-center gap-3 text-sm text-emerald-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Gemini liest das Bild …
          </div>
          <p className="mt-2 text-xs text-slate-500">Makros und Mikronährstoffe werden geschätzt.</p>
        </div>
      )}

      {/* Ergebnis-Blatt */}
      {phase === "result" && (
        <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/10 bg-slate-950/95 p-5 backdrop-blur">
          {error ? (
            <>
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => lastFileRef.current && runAnalysis(lastFileRef.current, shot)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 py-3 text-sm text-slate-200"
              >
                <RotateCcw className="h-4 w-4" /> Erneut versuchen
              </button>
              <button onClick={reset} className="mt-2 w-full py-2 text-xs uppercase tracking-[0.16em] text-slate-500">Verwerfen</button>
            </>
          ) : (
            <>
              <h3 className="text-xl font-semibold leading-tight text-slate-100">{result.description}</h3>
              {catalogHit ? (
                <button onClick={() => save("catalog")} className="mt-2 text-left text-[11px] uppercase tracking-[0.14em] text-emerald-400">
                  Im Katalog gefunden: {catalogHit.name} — Zahlen übernehmen
                </button>
              ) : (
                <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  Gemini Vision{result.grams ? ` · ca. ${Math.round(result.grams)} g` : ""}
                </p>
              )}

              <div className="mt-4 grid grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10">
                {[["kcal", result.kcal], ["Prot", result.protein], ["KH", result.carbs], ["Fett", result.fat]].map(([k, v], i) => (
                  <div key={k} className="bg-slate-950 p-3 text-center">
                    <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500">{k}</div>
                    <div className={`mt-1 text-base font-semibold tabular-nums ${i === 0 ? "text-orange-300" : "text-slate-100"}`}>
                      {Math.round((v || 0) * factor)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-slate-500">
                <span>Portion</span>
                <span className="tabular-nums text-slate-300">{factor.toFixed(2).replace(/\.?0+$/, "")}×</span>
              </div>
              <input
                type="range" min="0.5" max="2" step="0.25" value={factor}
                onChange={(e) => setFactor(Number(e.target.value))}
                aria-label="Portionsfaktor"
                className="mt-2 w-full accent-orange-400"
              />

              <button
                onClick={() => save("vision")}
                disabled={logMeal.isPending}
                className="mt-4 w-full rounded-2xl bg-emerald-400 py-4 font-semibold text-slate-950 disabled:opacity-60"
              >
                {logMeal.isPending ? "Speichert …" : "Speichern"}
              </button>
              <button onClick={reset} className="mt-2 w-full py-2 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                Verwerfen
              </button>
            </>
          )}
        </div>
      )}

      <input type="file" accept="image/*" ref={fileRef} onChange={onPick} className="hidden" />
    </div>
  );
}

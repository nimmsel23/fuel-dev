import React from "react";

export class ChunkErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Chrome/Edge: "Failed to fetch dynamically imported module", Safari: "Importing a module script failed",
    // Firefox: "error loading dynamically imported module". Der Client baut keine Lazy-Chunks mehr (siehe
    // scripts/vite-no-dynamic-chunks.mjs) — das hier fängt nur noch Altstände ab (alte Shell im SW-Cache).
    const isChunkError = /dynamically imported module|Importing a module script failed|MIME type/i.test(error?.message || "");

    if (isChunkError) {
      // Höchstens ein automatischer Reload pro Minute, sonst Endlosschleife bei echtem Ausfall.
      let reloaded = false;
      try {
        const last = Number(sessionStorage.getItem("fuel:chunk-reload") || 0);
        if (Date.now() - last > 60_000) {
          sessionStorage.setItem("fuel:chunk-reload", String(Date.now()));
          reloaded = true;
        }
      } catch { reloaded = true; }
      if (reloaded) {
        console.warn("Chunk load error detected, reloading page to fetch new version...");
        window.location.reload();
        return;
      }
    }
    console.error("Tab crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="py-20 text-center text-rose-400 text-sm">
          Ein Fehler ist aufgetreten. Modul wird neu geladen...
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 block mx-auto underline text-slate-400 hover:text-white"
          >
            Manuell neu laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

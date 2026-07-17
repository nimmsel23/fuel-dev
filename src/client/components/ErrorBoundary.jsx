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
    const isChunkError = 
      error.message && 
      (error.message.includes("Failed to fetch dynamically imported module") || 
       error.message.includes("Importing a module script failed"));

    if (isChunkError) {
      console.warn("Chunk load error detected, reloading page to fetch new version...");
      window.location.reload();
    } else {
      console.error("Tab crash:", error, errorInfo);
    }
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

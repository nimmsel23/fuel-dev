// Build-Guard: kein einzelnes Nachladen von Chunks (lazy()/import()) im Client.
// Warum: Firebase Hosting hält nur den jeweils letzten Release vor. Ein Tab/SW mit alter Shell
// fordert nach einem Deploy Chunks an, die es nicht mehr gibt; der SPA-Rewrite antwortet mit
// index.html ("MIME-Typ text/html") → "Modul wird neu geladen…". Statische Imports (Entry + vendor-*)
// hängen an der index.html und bleiben immer konsistent.
export function noDynamicChunks() {
  return {
    name: "fuel-no-dynamic-chunks",
    generateBundle(_options, bundle) {
      const dynamic = Object.values(bundle).filter((c) => c.type === "chunk" && c.isDynamicEntry);
      if (dynamic.length) {
        this.error(
          `Dynamische Chunks sind verboten (lazy()/import() durch statische Imports ersetzen): ${dynamic.map((c) => `${c.name} (${(c.facadeModuleId || c.moduleIds?.[c.moduleIds.length - 1] || "?").replace(/^.*\/(?=[^/]+\/[^/]+$)/, "")})`).join(", ")}`,
        );
      }
    },
  };
}

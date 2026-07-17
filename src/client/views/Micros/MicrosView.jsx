import MicrosLegend from "./MicrosLegend.jsx";
import MicrosGrid from "./MicrosGrid.jsx";

export default function MicrosView() {
  return (
    <div className="space-y-6 p-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Mikronährstoffe</h2>
        <p className="text-sm text-slate-400">Ø täglich vs. DACH-Referenzwerte · letzte 8 Wochen</p>
      </div>
      
      <MicrosLegend />
      <MicrosGrid />
      
      <p className="text-xs text-slate-600">
        Mikronährstoffe werden aus dem Micros-Katalog geschätzt. Mahlzeiten ohne Eintrag zählen als 0.
      </p>
    </div>
  );
}


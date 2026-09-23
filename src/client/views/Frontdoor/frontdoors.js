import { lazy } from "react";
import { LayoutGrid, Camera, MessageSquareText, Gauge } from "lucide-react";

// Frontdoor = der Screen, den die App beim Öffnen zeigt. Der Nutzer wählt ihn
// beim ersten Start (FrontdoorChooser) und kann ihn jederzeit im Setup-Tab
// umstellen (Settings/FrontdoorCard.jsx). Gespeichert als `frontdoor` in
// useSettings (store.js), mit Firestore-Sync wie die übrigen Settings.
export const FRONTDOORS = [
  {
    key: "tapboard",
    label: "Tap Board",
    tagline: "Ein Tap auf das, was du sonst isst",
    description:
      "Öffnet auf einem Kachelfeld deiner häufigsten Mahlzeiten, sortiert nach Tageszeit. Ein Tap loggt — keine Tastatur, kein Formular.",
    best: "Wenn du oft dasselbe isst",
    Icon: LayoutGrid,
    accent: "orange",
    View: lazy(() => import("./TapBoardFrontdoor.jsx")),
  },
  {
    key: "shutter",
    label: "Shutter",
    tagline: "Kamera auf, auslösen, fertig",
    description:
      "Die App startet im Sucher. Ein Foto vom Teller, Gemini erkennt Mahlzeit und Nährwerte, du bestätigst nur noch die Portion.",
    best: "Wenn du auswärts oder wechselnd isst",
    Icon: Camera,
    accent: "emerald",
    View: lazy(() => import("./ShutterFrontdoor.jsx")),
  },
  {
    key: "tagesfaden",
    label: "Tagesfaden",
    tagline: "Sag oder schreib einfach, was du gegessen hast",
    description:
      "Der Tag als fortlaufender Faden mit einem Eingabefeld unten. Ein Satz wie „2 Eier, Semmel und Kaffee\" wird zerlegt und eingetragen — getippt oder diktiert.",
    best: "Wenn du mehrere Sachen auf einmal nachträgst",
    Icon: MessageSquareText,
    accent: "sky",
    View: lazy(() => import("./TagesfadenFrontdoor.jsx")),
  },
  {
    key: "classic",
    label: "Klassisch",
    tagline: "Direkt ins Dashboard",
    description:
      "Kein Schnelleinstieg — die App öffnet wie bisher mit Dashboard und Tab-Leiste.",
    best: "Wenn du lieber den vollen Überblick zuerst hast",
    Icon: Gauge,
    accent: "slate",
    View: null,
  },
];

export const ACCENT = {
  orange: { ring: "border-orange-400/50 bg-orange-400/10", text: "text-orange-300", solid: "bg-orange-400" },
  emerald: { ring: "border-emerald-400/50 bg-emerald-400/10", text: "text-emerald-300", solid: "bg-emerald-400" },
  sky: { ring: "border-sky-400/50 bg-sky-400/10", text: "text-sky-300", solid: "bg-sky-400" },
  slate: { ring: "border-white/20 bg-white/5", text: "text-slate-300", solid: "bg-slate-400" },
};

export function getFrontdoor(key) {
  return FRONTDOORS.find((f) => f.key === key) || null;
}

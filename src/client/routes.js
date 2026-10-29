import { Flame, UtensilsCrossed, NotebookPen, Pill, Microscope, Settings2, History, LayoutGrid, GitCommitVertical, TerminalSquare, ChefHat, Library, FileText, CookingPot, Refrigerator } from "lucide-react";

// Keine dynamischen Imports/lazy(): jeder Chunk, der einzeln nachgeladen wird, bricht nach einem Deploy weg
// (Firebase Hosting hält nur den letzten Release vor, der SPA-Rewrite liefert dann index.html als "Modul").
import DashboardView from "./views/DashboardView.jsx";
import LogView from "./views/Log/LogView.jsx";
import FoodView from "./views/FoodView.jsx";
import PotsView from "./views/Pots/PotsView.jsx";
import KitchenView from "./views/Kitchen/KitchenView.jsx";
import RecipeBuilderView from "./views/RecipeBuilderView.jsx";
import CatalogView from "./views/CatalogView.jsx";
import HistoryView from "./views/HistoryView.jsx";
import NutritionReportView from "./views/Report/NutritionReportView.jsx";
import SupplementsView from "./views/SupplementsView.jsx";
import MicrosView from "./views/MicrosView.jsx";
import SettingsView from "./views/SettingsView.jsx";
import DevView from "./views/Dev/DevView.jsx";

const BUILD_IS_LOCAL = import.meta.env.VITE_APP_MODE !== "client" && import.meta.env.MODE !== "firebase";
const BUILD_IS_SHELL = import.meta.env.MODE === "firebase";
// Mini-App-Build (VITE_SOLO=log|supplements|micros|report): nur dieser eine Tab wird gebündelt.
// Die Bedingungen unten stehen bewusst als Literal-Vergleich, damit Rollup die übrigen
// Views (und deren Imports) per Tree-Shaking aus dem Bundle wirft.
const SOLO = import.meta.env.VITE_SOLO || "";

// Tab-Reihenfolge (2026-09-06, User-Vorgabe): Dashboard · Log · Food · Rezepte ·
// Katalog · Historie · Supplements · Mikros · Setup · Dev.
export const TAB_CONFIG = [
  ...((!BUILD_IS_SHELL && !SOLO) ? [{
    key: "dashboard",
    label: "Dashboard",
    Icon: Flame,
    View: DashboardView,
    getProps: (ctx) => ({ nutrition: ctx.nutrition, sup: ctx.sup, journal: ctx.journal, macroTrend: ctx.macroTrend, setActiveTab: ctx.setActiveTab, activeDate: ctx.activeDate }),
  }] : []),
  ...((!SOLO || SOLO === "log") ? [{
    key: "log",
    label: "Log",
    Icon: NotebookPen,
    View: LogView,
    getProps: (ctx) => ({ date: ctx.activeDate, nutrition: ctx.nutrition, journal: ctx.journal || "" }),
  }] : []),
  ...(!SOLO ? [{
    // Log-Ansichten als eigene Tab-Pills (gleiche LogView, erzwungener Modus).
    key: "log-dashboard",
    label: "Log-Dashboard",
    Icon: LayoutGrid,
    View: LogView,
    getProps: (ctx) => ({ date: ctx.activeDate, nutrition: ctx.nutrition, journal: ctx.journal || "", mode: "dashboard" }),
  }, {
    key: "log-timeline",
    label: "Timeline",
    Icon: GitCommitVertical,
    View: LogView,
    getProps: (ctx) => ({ date: ctx.activeDate, nutrition: ctx.nutrition, journal: ctx.journal || "", mode: "timeline" }),
  }] : []),
  ...((!SOLO || SOLO === "food") ? [{
    key: "food",
    label: "Food",
    Icon: UtensilsCrossed,
    View: FoodView,
    getProps: (ctx) => ({ activeDate: ctx.activeDate, setActiveDate: ctx.setActiveDate, nutrition: ctx.nutrition }),
  }] : []),
  ...(!SOLO ? [{
    // Töpfe (2026-10-26): was man gekocht hat als Gericht anlegen und tagweise
    // festhalten, wie viel vom Topf schon gegessen ist (Timeline). Cloud-Kanal.
    key: "pots",
    label: "Töpfe",
    Icon: CookingPot,
    View: PotsView,
    getProps: () => ({}),
    cloudOnly: true,
  }, {
    // Küche (2026-10-26): Subtabs Einkauf (Kassenbon-Scan, Einkäufe) und Vorrat
    // (Bestand, KI-Rezeptvorschläge). Cloud-Kanal.
    key: "kitchen",
    label: "Küche",
    Icon: Refrigerator,
    View: KitchenView,
    getProps: (ctx) => ({ activeDate: ctx.activeDate }),
    cloudOnly: true,
  }] : []),
  ...((!SOLO || SOLO === "recipes") ? [{
    key: "recipes",
    label: "Rezepte",
    Icon: ChefHat,
    View: RecipeBuilderView,
    getProps: () => ({}),
  }] : []),
  ...((!SOLO || SOLO === "catalog") ? [{
    key: "catalog",
    label: "Katalog",
    Icon: Library,
    View: CatalogView,
    getProps: (ctx) => ({ activeDate: ctx.activeDate }),
  }] : []),
  ...((!SOLO || SOLO === "history") ? [{
    key: "history",
    label: "Historie",
    Icon: History,
    View: HistoryView,
    getProps: (ctx) => ({ setActiveDate: ctx.setActiveDate, setActiveTab: ctx.setActiveTab }),
  }] : []),
  ...((!SOLO || SOLO === "report") ? [{
    // Ernährungsprotokoll-Report (2026-09-06): abgabefertiges 7-/14-Tage-
    // Protokoll für die FFA-Pflichtaufgaben (Ernährungstrainer Task 1/19,
    // Fitnesstrainer-Zusatzaufgabe Task 147). Druck-/PDF-Ausgabe via window.print().
    key: "report",
    label: "Protokoll",
    Icon: FileText,
    View: NutritionReportView,
    getProps: () => ({}),
  }] : []),
  ...((!SOLO || SOLO === "supplements") ? [{
    key: "supplements",
    label: "Supplements",
    Icon: Pill,
    View: SupplementsView,
    getProps: (ctx) => ({ date: ctx.activeDate, sup: ctx.sup, catalog: ctx.suppCatalog || [], suppLog: ctx.suppLog, onDateChange: ctx.setActiveDate }),
  }] : []),
  ...((!SOLO || SOLO === "micros") ? [{
    key: "micros",
    label: "Mikros",
    Icon: Microscope,
    View: MicrosView,
    getProps: () => ({}),
  }] : []),
  ...((!BUILD_IS_SHELL && !SOLO) ? [{
    key: "settings",
    label: "Setup",
    Icon: Settings2,
    View: SettingsView,
    getProps: () => ({}),
  }] : []),
  ...((BUILD_IS_LOCAL && !SOLO) ? [{
    // Lokale Builds (Fuel standalone coach + VitalOS ohne firebase mode)
    // dürfen den Dev/Prod-Server-Tab bundlen; Cloud-/Firebase-Builds nicht.
    key: "dev",
    label: "Dev",
    Icon: TerminalSquare,
    View: DevView,
    getProps: () => ({}),
    localOnly: true,
  }] : []),
];

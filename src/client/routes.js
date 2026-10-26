import { lazy } from "react";
import { Flame, UtensilsCrossed, NotebookPen, Pill, Microscope, Settings2, History, LayoutGrid, GitCommitVertical, TerminalSquare, ChefHat, Library, FileText, CookingPot, Refrigerator } from "lucide-react";

const BUILD_IS_LOCAL = import.meta.env.VITE_APP_MODE !== "client" && import.meta.env.MODE !== "firebase";
const BUILD_IS_SHELL = import.meta.env.MODE === "firebase";
// Mini-App-Build (VITE_SOLO=log|supplements|micros|report): nur dieser eine Tab wird gebündelt.
// Die Bedingungen unten stehen bewusst als Literal-Vergleich, damit Rollup die übrigen
// dynamischen Imports (und damit deren Chunks) komplett aus dem Bundle wirft.
const SOLO = import.meta.env.VITE_SOLO || "";

// Tab-Reihenfolge (2026-09-06, User-Vorgabe): Dashboard · Log · Food · Rezepte ·
// Katalog · Historie · Supplements · Mikros · Setup · Dev.
export const TAB_CONFIG = [
  ...((!BUILD_IS_SHELL && !SOLO) ? [{
    key: "dashboard",
    label: "Dashboard",
    Icon: Flame,
    View: lazy(() => import("./views/DashboardView.jsx")),
    getProps: (ctx) => ({ nutrition: ctx.nutrition, sup: ctx.sup, journal: ctx.journal, macroTrend: ctx.macroTrend, setActiveTab: ctx.setActiveTab, activeDate: ctx.activeDate }),
  }] : []),
  ...((!SOLO || SOLO === "log") ? [{
    key: "log",
    label: "Log",
    Icon: NotebookPen,
    View: lazy(() => import("./views/Log/LogView.jsx")),
    getProps: (ctx) => ({ date: ctx.activeDate, nutrition: ctx.nutrition, journal: ctx.journal || "" }),
  }] : []),
  ...(!SOLO ? [{
    // Log-Ansichten als eigene Tab-Pills (gleiche LogView, erzwungener Modus).
    key: "log-dashboard",
    label: "Log-Dashboard",
    Icon: LayoutGrid,
    View: lazy(() => import("./views/Log/LogView.jsx")),
    getProps: (ctx) => ({ date: ctx.activeDate, nutrition: ctx.nutrition, journal: ctx.journal || "", mode: "dashboard" }),
  }, {
    key: "log-timeline",
    label: "Timeline",
    Icon: GitCommitVertical,
    View: lazy(() => import("./views/Log/LogView.jsx")),
    getProps: (ctx) => ({ date: ctx.activeDate, nutrition: ctx.nutrition, journal: ctx.journal || "", mode: "timeline" }),
  }] : []),
  ...((!SOLO || SOLO === "food") ? [{
    key: "food",
    label: "Food",
    Icon: UtensilsCrossed,
    View: lazy(() => import("./views/FoodView.jsx")),
    getProps: (ctx) => ({ activeDate: ctx.activeDate, setActiveDate: ctx.setActiveDate, nutrition: ctx.nutrition }),
  }] : []),
  ...(!SOLO ? [{
    // Töpfe (2026-10-26): was man gekocht hat als Gericht anlegen und tagweise
    // festhalten, wie viel vom Topf schon gegessen ist (Timeline). Cloud-Kanal.
    key: "pots",
    label: "Töpfe",
    Icon: CookingPot,
    View: lazy(() => import("./views/Pots/PotsView.jsx")),
    getProps: () => ({}),
    cloudOnly: true,
  }, {
    // Küche (2026-10-26): Subtabs Einkauf (Kassenbon-Scan, Einkäufe) und Vorrat
    // (Bestand, KI-Rezeptvorschläge). Cloud-Kanal.
    key: "kitchen",
    label: "Küche",
    Icon: Refrigerator,
    View: lazy(() => import("./views/Kitchen/KitchenView.jsx")),
    getProps: (ctx) => ({ activeDate: ctx.activeDate }),
    cloudOnly: true,
  }] : []),
  ...((!SOLO || SOLO === "recipes") ? [{
    key: "recipes",
    label: "Rezepte",
    Icon: ChefHat,
    View: lazy(() => import("./views/RecipeBuilderView.jsx")),
    getProps: () => ({}),
  }] : []),
  ...((!SOLO || SOLO === "catalog") ? [{
    key: "catalog",
    label: "Katalog",
    Icon: Library,
    View: lazy(() => import("./views/CatalogView.jsx")),
    getProps: (ctx) => ({ activeDate: ctx.activeDate }),
  }] : []),
  ...((!SOLO || SOLO === "history") ? [{
    key: "history",
    label: "Historie",
    Icon: History,
    View: lazy(() => import("./views/HistoryView.jsx")),
    getProps: (ctx) => ({ setActiveDate: ctx.setActiveDate, setActiveTab: ctx.setActiveTab }),
  }] : []),
  ...((!SOLO || SOLO === "report") ? [{
    // Ernährungsprotokoll-Report (2026-09-06): abgabefertiges 7-/14-Tage-
    // Protokoll für die FFA-Pflichtaufgaben (Ernährungstrainer Task 1/19,
    // Fitnesstrainer-Zusatzaufgabe Task 147). Druck-/PDF-Ausgabe via window.print().
    key: "report",
    label: "Protokoll",
    Icon: FileText,
    View: lazy(() => import("./views/Report/NutritionReportView.jsx")),
    getProps: () => ({}),
  }] : []),
  ...((!SOLO || SOLO === "supplements") ? [{
    key: "supplements",
    label: "Supplements",
    Icon: Pill,
    View: lazy(() => import("./views/SupplementsView.jsx")),
    getProps: (ctx) => ({ date: ctx.activeDate, sup: ctx.sup, catalog: ctx.suppCatalog || [], suppLog: ctx.suppLog, onDateChange: ctx.setActiveDate }),
  }] : []),
  ...((!SOLO || SOLO === "micros") ? [{
    key: "micros",
    label: "Mikros",
    Icon: Microscope,
    View: lazy(() => import("./views/MicrosView.jsx")),
    getProps: () => ({}),
  }] : []),
  ...((!BUILD_IS_SHELL && !SOLO) ? [{
    key: "settings",
    label: "Setup",
    Icon: Settings2,
    View: lazy(() => import("./views/SettingsView.jsx")),
    getProps: () => ({}),
  }] : []),
  ...((BUILD_IS_LOCAL && !SOLO) ? [{
    // Lokale Builds (Fuel standalone coach + VitalOS ohne firebase mode)
    // dürfen den Dev/Prod-Server-Tab bundlen; Cloud-/Firebase-Builds nicht.
    key: "dev",
    label: "Dev",
    Icon: TerminalSquare,
    View: lazy(() => import("./views/Dev/DevView.jsx")),
    getProps: () => ({}),
    localOnly: true,
  }] : []),
];

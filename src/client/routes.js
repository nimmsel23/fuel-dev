import { lazy } from "react";
import { Flame, UtensilsCrossed, NotebookPen, BookOpen, Pill, Microscope, Settings2, History, TerminalSquare } from "lucide-react";

const BUILD_IS_LOCAL = import.meta.env.VITE_APP_MODE !== "client" && import.meta.env.MODE !== "firebase";
const BUILD_IS_SHELL = import.meta.env.MODE === "firebase";

export const TAB_CONFIG = [
  ...(!BUILD_IS_SHELL ? [{
    key: "dashboard",
    label: "Dashboard",
    Icon: Flame,
    View: lazy(() => import("./views/DashboardView.jsx")),
    getProps: (ctx) => ({ nutrition: ctx.nutrition, sup: ctx.sup, journal: ctx.journal, macroTrend: ctx.macroTrend, setActiveTab: ctx.setActiveTab, activeDate: ctx.activeDate }),
  }] : []),
  {
    key: "food",
    label: "Food",
    Icon: UtensilsCrossed,
    View: lazy(() => import("./views/FoodView.jsx")),
    getProps: (ctx) => ({ activeDate: ctx.activeDate, setActiveDate: ctx.setActiveDate, nutrition: ctx.nutrition }),
  },
  {
    key: "history",
    label: "Historie",
    Icon: History,
    View: lazy(() => import("./views/HistoryView.jsx")),
    getProps: (ctx) => ({ setActiveDate: ctx.setActiveDate, setActiveTab: ctx.setActiveTab }),
  },
  ...(!BUILD_IS_SHELL ? [{
    // Seit 2026-08-07 (TODO.md): im Firebase-Frontend (cloud) ausgeblendet —
    // Journal-VOS-Tab ist Cross-Repo-Import aus journal-dev, nicht Teil des
    // Ernährungs-Tagebuchs. Das bleibt via JournalWidget im Dashboard
    // weiterhin ladbar (siehe DashboardView.jsx). Habits-Tab wurde entfernt
    // (2026-08-23) — fuel-dev braucht habits-dev nicht als Dependency.
    key: "journal",
    label: "Journal",
    Icon: BookOpen,
    View: lazy(() => import("./views/JournalVosView.jsx")),
    getProps: (ctx) => ({ date: ctx.activeDate }),
    cloudHidden: true,
  }] : []),
  {
    key: "log",
    label: "Log",
    Icon: NotebookPen,
    View: lazy(() => import("./views/Log/LogView.jsx")),
    getProps: (ctx) => ({ date: ctx.activeDate, nutrition: ctx.nutrition, journal: ctx.journal || "" }),
  },
  {
    key: "supplements",
    label: "Supplements",
    Icon: Pill,
    View: lazy(() => import("./views/SupplementsView.jsx")),
    getProps: (ctx) => ({ date: ctx.activeDate, sup: ctx.sup, catalog: ctx.suppCatalog || [], suppLog: ctx.suppLog }),
  },
  {
    key: "micros",
    label: "Mikros",
    Icon: Microscope,
    View: lazy(() => import("./views/MicrosView.jsx")),
    getProps: () => ({}),
  },
  ...(!BUILD_IS_SHELL ? [{
    key: "settings",
    label: "Setup",
    Icon: Settings2,
    View: lazy(() => import("./views/SettingsView.jsx")),
    getProps: () => ({}),
  }] : []),
  ...(BUILD_IS_LOCAL ? [{
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

import { lazy } from "react";
import { Flame, UtensilsCrossed, CalendarDays, NotebookPen, Pill, Microscope, Settings2 } from "lucide-react";

export const TAB_CONFIG = [
  {
    key: "dashboard",
    label: "Dashboard",
    Icon: Flame,
    View: lazy(() => import("./views/DashboardView.jsx")),
    getProps: (ctx) => ({ nutrition: ctx.nutrition, sup: ctx.sup, journal: ctx.journal, macroTrend: ctx.macroTrend }),
  },
  {
    key: "food",
    label: "Food",
    Icon: UtensilsCrossed,
    View: lazy(() => import("./views/FoodView.jsx")),
    getProps: (ctx) => ({ activeDate: ctx.activeDate, setActiveDate: ctx.setActiveDate, nutrition: ctx.nutrition }),
  },
  {
    key: "calendar",
    label: "Big Calendar",
    Icon: CalendarDays,
    View: lazy(() => import("./views/CalendarView.jsx")),
    getProps: (ctx) => ({ date: ctx.activeDate, nutrition: ctx.nutrition }),
  },
  {
    key: "journal",
    label: "Journal",
    Icon: NotebookPen,
    View: lazy(() => import("./views/JournalView.jsx")),
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
  {
    key: "settings",
    label: "Setup",
    Icon: Settings2,
    View: lazy(() => import("./views/SettingsView.jsx")),
    getProps: () => ({}),
  },
];

import { lazy } from "react";
import { Flame, UtensilsCrossed, NotebookPen, CheckSquare, BookOpen, Pill, Microscope, Settings2 } from "lucide-react";

export const TAB_CONFIG = [
  {
    key: "dashboard",
    label: "Dashboard",
    Icon: Flame,
    View: lazy(() => import("./views/DashboardView.jsx")),
    getProps: (ctx) => ({ nutrition: ctx.nutrition, sup: ctx.sup, macroTrend: ctx.macroTrend }),
  },
  {
    key: "food",
    label: "Food",
    Icon: UtensilsCrossed,
    View: lazy(() => import("./views/FoodView.jsx")),
    getProps: (ctx) => ({ activeDate: ctx.activeDate, setActiveDate: ctx.setActiveDate, nutrition: ctx.nutrition, mealCatalog: ctx.mealCatalog || [] }),
  },
  {
    key: "journal",
    label: "Journal",
    Icon: BookOpen,
    View: lazy(() => import("./views/JournalVosView.jsx")),
    getProps: (ctx) => ({ date: ctx.activeDate }),
  },
  {
    key: "habits",
    label: "Habits",
    Icon: CheckSquare,
    View: lazy(() => import("./views/HabitVosView.jsx")),
    getProps: (ctx) => ({ date: ctx.activeDate }),
  },
  {
    key: "log",
    label: "Log",
    Icon: NotebookPen,
    View: lazy(() => import("./views/LogView.jsx")),
    getProps: (ctx) => ({ date: ctx.activeDate, nutrition: ctx.nutrition }),
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

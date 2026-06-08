import { lazy } from "react";
import { CalendarDays, Flame, Microscope, NotebookPen, Pill, Settings2, UtensilsCrossed } from "lucide-react";

export const TAB_CONFIG = [
  { key: "dashboard",   label: "Dashboard",   Icon: Flame,           View: lazy(() => import("./views/DashboardView.jsx")) },
  { key: "food",        label: "Food",         Icon: UtensilsCrossed, View: lazy(() => import("./views/FoodView.jsx")) },
  { key: "calendar",    label: "Big Calendar", Icon: CalendarDays,    View: lazy(() => import("./views/CalendarView.jsx")) },
  { key: "journal",     label: "Journal",      Icon: NotebookPen,     View: lazy(() => import("./views/JournalView.jsx")) },
  { key: "supplements", label: "Supplements",  Icon: Pill,            View: lazy(() => import("./views/SupplementsView.jsx")) },
  { key: "micros",      label: "Mikros",       Icon: Microscope,      View: lazy(() => import("./views/MicrosView.jsx")) },
  { key: "settings",    label: "Setup",        Icon: Settings2,       View: lazy(() => import("./views/SettingsView.jsx")) },
];

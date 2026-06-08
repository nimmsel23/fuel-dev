import { lazy } from "react";
import { Flame } from "lucide-react";

export default {
  key: "dashboard",
  label: "Dashboard",
  Icon: Flame,
  View: lazy(() => import("../views/DashboardView.jsx")),
  getProps: (ctx) => ({
    nutrition: ctx.nutrition,
    sup: ctx.sup,
    journal: ctx.journal,
    macroTrend: ctx.macroTrend,
  }),
};

import { lazy } from "react";
import { CalendarDays } from "lucide-react";

export default {
  key: "calendar",
  label: "Big Calendar",
  Icon: CalendarDays,
  View: lazy(() => import("../views/CalendarView.jsx")),
  getProps: (ctx) => ({
    date: ctx.activeDate,
    nutrition: ctx.nutrition,
  }),
};

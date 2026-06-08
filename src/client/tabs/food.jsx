import { lazy } from "react";
import { UtensilsCrossed } from "lucide-react";

export default {
  key: "food",
  label: "Food",
  Icon: UtensilsCrossed,
  View: lazy(() => import("../views/FoodView.jsx")),
  getProps: (ctx) => ({
    activeDate: ctx.activeDate,
    setActiveDate: ctx.setActiveDate,
    nutrition: ctx.nutrition,
  }),
};

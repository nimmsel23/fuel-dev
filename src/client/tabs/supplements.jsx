import { lazy } from "react";
import { Pill } from "lucide-react";

export default {
  key: "supplements",
  label: "Supplements",
  Icon: Pill,
  View: lazy(() => import("../views/SupplementsView.jsx")),
  getProps: (ctx) => ({
    date: ctx.activeDate,
    sup: ctx.sup,
    catalog: ctx.suppCatalog || [],
    suppLog: ctx.suppLog,
  }),
};

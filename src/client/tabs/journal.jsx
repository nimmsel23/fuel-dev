import { lazy } from "react";
import { NotebookPen } from "lucide-react";

export default {
  key: "journal",
  label: "Journal",
  Icon: NotebookPen,
  View: lazy(() => import("../views/JournalView.jsx")),
  getProps: (ctx) => ({
    date: ctx.activeDate,
    nutrition: ctx.nutrition,
    journal: ctx.journal || "",
  }),
};

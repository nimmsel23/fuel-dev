import { lazy } from "react";
import { Settings2 } from "lucide-react";

export default {
  key: "settings",
  label: "Setup",
  Icon: Settings2,
  View: lazy(() => import("../views/SettingsView.jsx")),
  getProps: () => ({}),
};

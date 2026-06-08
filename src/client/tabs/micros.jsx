import { lazy } from "react";
import { Microscope } from "lucide-react";

export default {
  key: "micros",
  label: "Mikros",
  Icon: Microscope,
  View: lazy(() => import("../views/MicrosView.jsx")),
  getProps: () => ({}),
};

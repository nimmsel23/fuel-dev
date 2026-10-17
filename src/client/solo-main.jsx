import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { createFuelQueryClient } from "./lib/queryClient.js";
import StorageStatus from "./components/StorageStatus.jsx";
import SoloShell from "./SoloShell.jsx";
import "./styles.css";

// Standalone entry: no Fuel dashboard, frontdoor or nutrition heatmap.
const queryClient = createFuelQueryClient();
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <StorageStatus />
      <SoloShell />
    </QueryClientProvider>
  </React.StrictMode>,
);

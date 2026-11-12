import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { auth } from "./firebase.js";
import {
  captureSupplementActionFromLocation,
  mergeLoggedIntakes,
  rememberSupplementAction,
} from "./supplementActionLink.js";
import { executePendingSupplementAction } from "./executeSupplementAction.js";

function showLoggedIntakes(qc, result) {
  if (!result?.date || result.action !== "quick-yes") return;
  if (result.intakes?.length) {
    qc.setQueryData(["supp-log", result.date], (current) => ({
      date: result.date,
      ...mergeLoggedIntakes(current, result.intakes),
    }));
  }
  qc.invalidateQueries({ queryKey: ["supp-log", result.date] });
  qc.invalidateQueries({ queryKey: ["supp-stats"] });
}

export function useSupplementAction(user, onDate) {
  const qc = useQueryClient();
  const onDateRef = React.useRef(onDate);
  onDateRef.current = onDate;

  const runIfSignedIn = React.useCallback(() => {
    if (!auth.currentUser) return;
    executePendingSupplementAction()
      .then((result) => showLoggedIntakes(qc, result))
      .catch((error) => console.error("[supplement-action]", error));
  }, [qc]);

  React.useEffect(() => {
    const apply = (pending) => {
      if (pending?.date) onDateRef.current?.(pending.date);
      runIfSignedIn();
    };
    apply(captureSupplementActionFromLocation());
    const onHash = () => apply(captureSupplementActionFromLocation());
    const onMessage = (event) => {
      const data = event.data;
      if (!data || data.type !== "FUEL_SUPPLEMENT_ACTION") return;
      apply(rememberSupplementAction(data));
    };
    window.addEventListener("hashchange", onHash);
    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("hashchange", onHash);
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [runIfSignedIn]);

  React.useEffect(() => {
    if (user) runIfSignedIn();
  }, [user, runIfSignedIn]);
}

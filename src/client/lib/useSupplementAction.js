import React from "react";
import { auth } from "./firebase.js";
import {
  captureSupplementActionFromLocation,
  rememberSupplementAction,
} from "./supplementActionLink.js";
import { executePendingSupplementAction } from "./executeSupplementAction.js";

function runIfSignedIn() {
  if (!auth.currentUser) return;
  executePendingSupplementAction().catch((error) => console.error("[supplement-action]", error));
}

// Merkt sich den Hash sofort und führt ihn erst aus, wenn ein Konto da ist.
export function useSupplementAction(user, onDate) {
  const onDateRef = React.useRef(onDate);
  onDateRef.current = onDate;

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
  }, []);

  React.useEffect(() => {
    if (user) runIfSignedIn();
  }, [user]);
}

import { Suspense } from "react";
import { TAB_CONFIG } from "../routes.js";
import { ChunkErrorBoundary } from "./ErrorBoundary.jsx";

export default function TabContent({ activeTab, ctx }) {
  const tab = TAB_CONFIG.find((t) => t.key === activeTab);
  if (!tab) return null;
  const { View, getProps } = tab;
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<div className="py-20 text-center text-slate-500 text-sm animate-pulse">Laden…</div>}>
        <View {...getProps(ctx)} />
      </Suspense>
    </ChunkErrorBoundary>
  );
}

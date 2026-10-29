import { TAB_CONFIG } from "../routes.js";
import { ChunkErrorBoundary } from "./ErrorBoundary.jsx";

export default function TabContent({ activeTab, ctx }) {
  const tab = TAB_CONFIG.find((t) => t.key === activeTab);
  if (!tab) return null;
  const { View, getProps } = tab;
  return (
    <ChunkErrorBoundary>
      <View {...getProps(ctx)} />
    </ChunkErrorBoundary>
  );
}

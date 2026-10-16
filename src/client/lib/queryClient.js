import { QueryClient } from "@tanstack/react-query";

// Execute mutations while offline so durable Firestore/outbox writes happen
// immediately. The default "online" mode pauses them only in volatile memory.
// Reads must also reach Firestore's persistent local cache without a network.
export function createFuelQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { networkMode: "always" },
      mutations: { networkMode: "always" },
    },
  });
}

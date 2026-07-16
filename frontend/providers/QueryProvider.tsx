"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ReactNode, useState } from "react";

/**
 * Exponential backoff with jitter.
 * Attempt 0 → ~1 s, attempt 1 → ~2 s, attempt 2 → ~4 s … capped at 10 s.
 */
function retryDelay(attempt: number): number {
  const base = Math.min(1000 * 2 ** attempt, 10_000);
  const jitter = Math.random() * 500;
  return base + jitter;
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 2,
        retryDelay,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always create a new client
    return makeQueryClient();
  }
  // Browser: reuse the same client across re-renders
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
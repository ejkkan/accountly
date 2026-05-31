"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

/**
 * Client-side providers wired into the root layout.
 *
 * - `QueryClient` lives in component state so each browser session gets one
 *   instance — never recreated across re-renders, never shared across
 *   server boundaries.
 * - `AuthUIProvider` hands better-auth-ui its router + Link primitives so
 *   the prebuilt sign-in / sign-up / forgot-password views can navigate
 *   without us writing any auth UI.
 */
export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache-friendly default: stay fresh for a minute, refetch on
            // window focus only after that.
            staleTime: 60_000,
            refetchOnWindowFocus: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthUIProvider
        authClient={authClient}
        navigate={router.push}
        replace={router.replace}
        onSessionChange={() => router.refresh()}
        Link={Link}
      >
        {children}
      </AuthUIProvider>
    </QueryClientProvider>
  );
}

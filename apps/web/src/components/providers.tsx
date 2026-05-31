"use client";

import { useState, type ReactNode } from "react";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { ApiError } from "@/lib/errors";

/**
 * Client-side providers wired into the root layout.
 *
 * Mutation errors get a global toast via `MutationCache.onError` — the
 * v5-correct hook for "do this for every mutation no matter what." Living
 * here (instead of `defaultOptions.mutations.onError`) means a hook's own
 * `onError` callback can't accidentally shadow it.
 *
 * Query errors deliberately don't toast — components render inline
 * "couldn't load" UI from the hook's `error` field. A toast firing on
 * every background refetch failure would be obnoxious.
 *
 * - `QueryClient` lives in component state so each browser session gets
 *   one instance — never recreated across re-renders, never shared across
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
            staleTime: 60_000,
            refetchOnWindowFocus: true,
          },
        },
        mutationCache: new MutationCache({
          onError: (err) => {
            const message = err instanceof ApiError ? err.message : "Something went wrong.";
            toast.error(message);
          },
        }),
        queryCache: new QueryCache({
          onError: (err) => {
            // Logged but not toasted — see comment above. Dev-only so prod
            // doesn't carry stray console output.
            if (process.env.NODE_ENV !== "production" && err instanceof ApiError) {
              console.debug("[query]", err.status, err.code, err.message);
            }
          },
        }),
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
        // Where every auth view lands the user after success. Defaults to
        // "/" otherwise, which is the marketing landing page.
        redirectTo="/bills"
      >
        {children}
      </AuthUIProvider>
    </QueryClientProvider>
  );
}

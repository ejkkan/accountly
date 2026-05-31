import type { ReactNode } from "react";

/**
 * Centered card shell shared by every /auth/* view. better-auth-ui renders
 * its own card chrome; this just provides the page background + vertical
 * centering.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

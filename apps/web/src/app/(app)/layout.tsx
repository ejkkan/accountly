"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

/**
 * Minimal shell for every (app) page. proxy.ts already enforces session-only
 * access, so this layout just paints chrome.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/auth/sign-in");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/bills" className="text-lg font-semibold">
            Accountly
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/bills">Bills</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}

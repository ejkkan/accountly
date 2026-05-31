"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Next.js error boundary for everything under (app). Catches React render
 * errors — *not* network failures (those are surfaced through react-query
 * hooks + the global toast cache). Shows a friendly card with a retry
 * button instead of a blank white page.
 */
export default function AppGroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app render error]", error);
  }, [error]);

  return (
    <div className="px-4 lg:px-6">
      <Card className="mx-auto mt-8 max-w-md">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="rounded-full bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            <AlertTriangle className="size-5" />
          </div>
          <div className="space-y-1">
            <CardTitle>Something broke on this page.</CardTitle>
            <CardDescription>
              The rest of the app should still work. Try the action again — if it keeps failing,
              refresh.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="rounded-md border bg-muted/30 p-3 font-mono text-xs text-muted-foreground">
            {error.message}
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={reset}>
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.location.reload()}>
              Refresh page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

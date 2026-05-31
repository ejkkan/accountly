"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * The one card we render whenever a `useQuery` hook surfaces an error. Lives
 * here (not duplicated per page) so list / detail / future pages all look
 * the same when the network is down or the API rejects the read.
 *
 * Mutation errors don't use this — they fire the global toast in
 * providers.tsx and the form stays put.
 */
export function ErrorCard({
  title = "Couldn't load this",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive flex items-center gap-2">
          <AlertCircle className="size-5" />
          {title}
        </CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      {onRetry && (
        <CardContent>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

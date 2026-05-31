import { Badge } from "@/components/ui/badge";

/**
 * Bill / journal-entry status chip. Single source for the pending / approved /
 * declined styling — used by the bills list, bill detail, and supplier detail.
 */
export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "approved"
      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400"
      : status === "declined"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400"
        : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-400";
  return (
    <Badge variant="outline" className={cls}>
      {status}
    </Badge>
  );
}

"use client";

import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Clock5, CheckCircle2, XCircle } from "lucide-react";

/**
 * Bills KPI row — same layout as the template's SectionCards
 * (`(dashboard)/dashboard/components/section-cards.tsx`): four gradient
 * Cards in a 1/2/4 responsive grid, each with a description, a tabular-nums
 * title, an action badge, and a footer caption.
 *
 * No trend deltas yet because we don't have a time window to compare to —
 * once we track approvals per month, the Badge slots can light up with
 * TrendingUp/TrendingDown like the template's demo.
 */
export interface BillsStats {
  total: number;
  pending: number;
  approved: number;
  declined: number;
}

export function BillsStatCards({ stats }: { stats: BillsStats }) {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total bills</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.total}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <FileText />
              All time
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Uploaded by your workspace</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Pending review</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.pending}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <Clock5 />
              Awaiting
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Need an accountant decision</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Approved</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.approved}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <CheckCircle2 />
              Posted
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Journal entry accepted</div>
        </CardFooter>
      </Card>

      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Declined</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.declined}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <XCircle />
              Rejected
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="text-muted-foreground">Proposal sent back</div>
        </CardFooter>
      </Card>
    </div>
  );
}

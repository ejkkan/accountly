"use client";

import Link from "next/link";
import {
  ArrowRight,
  Scale,
  Lock,
  ClipboardCheck,
  FileSearch,
  Sparkles,
  Database,
  Percent,
  SplitSquareHorizontal,
  FileText,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Graphic3D } from "@/components/graphic-3d";

const parseFeatures = [
  {
    icon: FileSearch,
    title: "Line-item extraction",
    description: "Supplier, dates, line items, VAT (moms), totals — pulled straight from the PDF.",
  },
  {
    icon: Sparkles,
    title: "Mapped to the BAS chart",
    description:
      "Our AI matches every line to a BAS kontoplan account — 5010 Lokalhyra, 6530 IT-tjänster, 4010 Inköp material, and so on.",
  },
  {
    icon: Percent,
    title: "VAT routed to 2640",
    description:
      "Swedish moms (25% / 12% / 6%) is pulled off the bill and debited to 2640 Ingående moms automatically.",
  },
  {
    icon: Scale,
    title: "Balanced double-entry",
    description: "Debits equal credits — server-side schema rejects anything that doesn't balance.",
  },
];

const reviewFeatures = [
  {
    icon: SplitSquareHorizontal,
    title: "PDF next to the entry",
    description:
      "The original PDF renders on the left, the proposed journal entry on the right. No tab-switching to sanity-check a posting.",
  },
  {
    icon: ClipboardCheck,
    title: "Approve or decline",
    description:
      "Every entry is a proposal until the accountant signs off — nothing posts silently.",
  },
  {
    icon: Lock,
    title: "Session-scoped access",
    description: "Backend routes are gated by better-auth sessions; uploads land in private R2.",
  },
  {
    icon: Database,
    title: "Status-tracked bills",
    description: "Pending → parsed → approved/declined, with the original PDF retrievable by ID.",
  },
];

const samplePostings = [
  { account: "5010", name: "Lokalhyra", debit: "10 000,00", credit: "" },
  { account: "2640", name: "Ingående moms", debit: "2 500,00", credit: "" },
  { account: "2440", name: "Leverantörsskulder", debit: "", credit: "12 500,00" },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-24 sm:py-32 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <Badge variant="outline" className="mb-4">
            How it works
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
            Our AI does the bookkeeping. You sign off.
          </h2>
          <p className="text-lg text-muted-foreground">
            Two flows, no busywork: upload a PDF, then approve or decline the journal entry our AI
            proposes. Everything in between — extraction, account mapping, VAT, balancing — happens
            for you.
          </p>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16 mb-24">
          <Graphic3D>
            <ExtractionMock />
          </Graphic3D>
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                Our AI does the boring half
              </h3>
              <p className="text-muted-foreground text-base text-pretty">
                Upload a PDF and our AI returns a structured bill — supplier, line items, VAT,
                totals — with every line already mapped to the right BAS kontoplan account.
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {parseFeatures.map((feature, index) => (
                <li
                  key={index}
                  className="group hover:bg-accent/5 flex items-start gap-3 p-2 rounded-lg transition-colors"
                >
                  <div className="mt-0.5 flex shrink-0 items-center justify-center">
                    <feature.icon className="size-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-foreground font-medium">{feature.title}</h3>
                    <p className="text-muted-foreground mt-1 text-sm">{feature.description}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="rounded-lg border bg-background/60 p-4 text-sm">
              <p className="text-xs font-medium text-muted-foreground mb-3">
                Example: a 10 000 kr rent invoice, 25% moms
              </p>
              <div className="space-y-1.5 font-mono text-xs">
                <div className="grid grid-cols-12 gap-2 text-muted-foreground border-b pb-1.5">
                  <span className="col-span-2">Konto</span>
                  <span className="col-span-5">Namn</span>
                  <span className="col-span-2 text-right">Debet</span>
                  <span className="col-span-3 text-right">Kredit</span>
                </div>
                {samplePostings.map((p) => (
                  <div key={p.account} className="grid grid-cols-12 gap-2">
                    <span className="col-span-2 text-foreground">{p.account}</span>
                    <span className="col-span-5 text-muted-foreground">{p.name}</span>
                    <span className="col-span-2 text-right tabular-nums">{p.debit}</span>
                    <span className="col-span-3 text-right tabular-nums">{p.credit}</span>
                  </div>
                ))}
                <div className="grid grid-cols-12 gap-2 border-t pt-1.5 font-semibold">
                  <span className="col-span-7 text-muted-foreground">Balanserad</span>
                  <span className="col-span-2 text-right tabular-nums">12 500,00</span>
                  <span className="col-span-3 text-right tabular-nums">12 500,00</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pe-4 pt-2">
              <Button size="lg" className="cursor-pointer" asChild>
                <Link href="/bills" className="flex items-center">
                  Open Dashboard
                  <ArrowRight className="ms-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="cursor-pointer" asChild>
                <Link href="/auth/sign-in">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16">
          <div className="space-y-6 order-2 lg:order-1">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                The accountant keeps the final say
              </h3>
              <p className="text-muted-foreground text-base text-pretty">
                Proposed entries never post on their own. The original PDF renders right next to the
                proposed journal, so the accountant can eyeball the numbers in one glance and flip
                it to approved or declined.
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {reviewFeatures.map((feature, index) => (
                <li
                  key={index}
                  className="group hover:bg-accent/5 flex items-start gap-3 p-2 rounded-lg transition-colors"
                >
                  <div className="mt-0.5 flex shrink-0 items-center justify-center">
                    <feature.icon className="size-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-foreground font-medium">{feature.title}</h3>
                    <p className="text-muted-foreground mt-1 text-sm">{feature.description}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-4 pe-4 pt-2">
              <Button size="lg" className="cursor-pointer" asChild>
                <Link href="/bills" className="flex items-center">
                  See it in the dashboard
                  <ArrowRight className="ms-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>

          <Graphic3D className="order-1 lg:order-2">
            <ReviewMock />
          </Graphic3D>
        </div>
      </div>
    </section>
  );
}

/** Feature 1 graphic: a PDF parsed into structured fields + BAS-mapped lines. */
function ExtractionMock() {
  const lines = [
    { desc: "Cloud hosting", acct: "6540", amt: "70 000,00" },
    { desc: "Support hours", acct: "6530", amt: "23 500,00" },
  ];
  return (
    <div className="flex h-full w-full flex-col gap-3 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="size-4" />
          <span className="font-mono">invoice_1047.pdf</span>
        </div>
        <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400">
          parsed
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border bg-background/60 p-3">
        <span className="text-muted-foreground">Supplier</span>
        <span className="truncate text-right">Bright IT Solutions AB</span>
        <span className="text-muted-foreground">Invoice #</span>
        <span className="text-right font-mono tabular-nums">1047</span>
        <span className="text-muted-foreground">Date</span>
        <span className="text-right font-mono tabular-nums">2026-03-10</span>
      </div>
      <div className="space-y-1.5 rounded-lg border bg-background/60 p-3 font-mono">
        {lines.map((l) => (
          <div key={l.acct} className="flex items-center justify-between gap-2">
            <span className="truncate text-muted-foreground">{l.desc}</span>
            <span className="flex items-center gap-2">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                {l.acct}
              </span>
              <span className="tabular-nums">{l.amt}</span>
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between border-t pt-1.5 font-semibold">
          <span className="text-muted-foreground">Total incl. moms</span>
          <span className="tabular-nums">116 875,00</span>
        </div>
      </div>
    </div>
  );
}

/** Feature 2 graphic: the PDF beside the proposed entry, with approve/decline. */
function ReviewMock() {
  const postings = [
    { code: "5010", amt: "10 000,00" },
    { code: "2640", amt: "2 500,00" },
    { code: "2440", amt: "12 500,00" },
  ];
  return (
    <div className="flex h-full w-full gap-3 text-xs">
      <div className="flex flex-1 flex-col gap-1.5 rounded-lg border bg-background/60 p-3">
        <div className="mb-1 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <FileText className="size-3" /> PDF
        </div>
        {[90, 70, 82, 55, 74, 40].map((w, i) => (
          <div
            key={i}
            className="h-1.5 rounded bg-muted-foreground/15"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-2 rounded-lg border bg-background/60 p-3">
        <div className="flex items-center justify-between">
          <span className="font-medium">Journal entry</span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            pending
          </span>
        </div>
        <div className="space-y-1 font-mono text-[11px]">
          {postings.map((p) => (
            <div key={p.code} className="flex justify-between">
              <span className="text-muted-foreground">{p.code}</span>
              <span className="tabular-nums">{p.amt}</span>
            </div>
          ))}
        </div>
        <div className="mt-auto flex gap-2 pt-1">
          <span className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground">
            <Check className="size-3" /> Approve
          </span>
          <span className="flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium">
            <X className="size-3" /> Decline
          </span>
        </div>
      </div>
    </div>
  );
}

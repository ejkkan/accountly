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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Image3D } from "@/components/image-3d";

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
      "Each line is matched to a BAS kontoplan account — 5010 Lokalhyra, 6530 IT-tjänster, 4010 Inköp material, and so on.",
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
            Parse the bill, propose the entry, hand it to the accountant
          </h2>
          <p className="text-lg text-muted-foreground">
            Accountly is intentionally small. Two flows: upload a PDF, and approve or decline the
            journal entry that comes back.
          </p>
        </div>

        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8 xl:gap-16 mb-24">
          <Image3D
            lightSrc="/feature-1-light.png"
            darkSrc="/feature-1-dark.png"
            alt="Parsed invoice mapped to BAS account codes"
            direction="left"
          />
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                The parser does the boring half
              </h3>
              <p className="text-muted-foreground text-base text-pretty">
                Upload a PDF and Claude returns a structured bill — supplier, line items, VAT,
                totals — with each line mapped to a BAS kontoplan account.
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
                <Link href="/dashboard" className="flex items-center">
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
                <Link href="/dashboard" className="flex items-center">
                  See it in the dashboard
                  <ArrowRight className="ms-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>

          <Image3D
            lightSrc="/feature-2-light.png"
            darkSrc="/feature-2-dark.png"
            alt="Accountant reviewing PDF next to proposed journal entry"
            direction="right"
            className="order-1 lg:order-2"
          />
        </div>
      </div>
    </section>
  );
}

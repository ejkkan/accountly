"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CardDecorator } from "@/components/ui/card-decorator";
import { FileUp, Sparkles, Scale, ClipboardCheck } from "lucide-react";

const steps = [
  {
    icon: FileUp,
    title: "1. Upload the PDF",
    description:
      "Drop a supplier invoice into the dashboard. The file goes straight to private R2 storage, scoped to your account.",
  },
  {
    icon: Sparkles,
    title: "2. Our AI reads it",
    description:
      "The PDF is handed to our in-house AI, which pulls supplier, dates, line items, VAT (moms) and totals into a clean structured shape.",
  },
  {
    icon: Scale,
    title: "3. It builds a balanced entry",
    description:
      "Every line is mapped to a BAS account (e.g. 5010 Lokalhyra, 6530 IT-tjänster), VAT routes to 2640, and debits always equal credits — no manual ledger work.",
  },
  {
    icon: ClipboardCheck,
    title: "4. You just approve",
    description:
      "The proposed journal sits next to the original PDF. Approve or decline in one click — status flips and the audit trail is preserved.",
  },
];

export function AboutSection() {
  return (
    <section id="about" className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center mb-16">
          <Badge variant="outline" className="mb-4">
            About Accountly
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            A take-home assignment, built around one boring problem
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Accountants spend hours retyping supplier invoices into their accounting system. With
            Accountly, our AI does the data entry and the accountant just approves — keeping a human
            in the loop on every entry without making them do the typing.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 xl:grid-cols-4 mb-12">
          {steps.map((step, index) => (
            <Card key={index} className="group shadow-xs py-2">
              <CardContent className="p-8">
                <div className="flex flex-col items-center text-center">
                  <CardDecorator>
                    <step.icon className="h-6 w-6" aria-hidden />
                  </CardDecorator>
                  <h3 className="mt-6 font-medium text-balance">{step.title}</h3>
                  <p className="text-muted-foreground mt-3 text-sm">{step.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="cursor-pointer" asChild>
              <Link href="/dashboard">Try the dashboard</Link>
            </Button>
            <Button size="lg" variant="outline" className="cursor-pointer" asChild>
              <Link href="/auth/sign-up">Create an account</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

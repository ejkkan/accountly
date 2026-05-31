"use client";

import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

type FaqItem = {
  value: string;
  question: string;
  answer: string;
};

const faqItems: FaqItem[] = [
  {
    value: "item-1",
    question: "What does Accountly actually do?",
    answer:
      "You drop a supplier invoice PDF in; our AI extracts the line items, maps each one to a BAS kontoplan account, and produces a balanced double-entry journal proposal. The accountant just approves or declines — no manual ledger entry.",
  },
  {
    value: "item-2",
    question: "Why is the accountant still in the loop?",
    answer:
      "Because models can misread totals, miscategorise accounts, or hallucinate a line item. Accountly treats every entry as a proposal — nothing posts to a ledger until the accountant explicitly approves it.",
  },
  {
    value: "item-3",
    question: "Where is my uploaded PDF stored?",
    answer:
      "Uploads land in a private Cloudflare R2 bucket, scoped to your account. The PDF is fetched on demand through a session-gated backend route — never exposed publicly.",
  },
  {
    value: "item-4",
    question: "How is Swedish VAT (moms) handled?",
    answer:
      "If the bill shows moms (typically 25%, 12%, or 6%), the parser pulls it out as a separate posting debited to 2640 Ingående moms. The supplier debt goes to 2440 Leverantörsskulder; the expense lines hit the right BAS account based on what was bought.",
  },
  {
    value: "item-4b",
    question: "What happens if the proposed entry doesn't balance?",
    answer:
      "The journal schema rejects unbalanced entries server-side, so the UI never surfaces a half-entry. If the parsed bill can't be turned into a balanced entry, you'll see why instead.",
  },
  {
    value: "item-5",
    question: "Is this production-ready accounting software?",
    answer:
      "No — Accountly is a take-home assignment / prototype. The aim is to demonstrate the end-to-end flow (upload → parse → review) cleanly, not to replace your accounting system.",
  },
  {
    value: "item-6",
    question: "What's the tech stack?",
    answer:
      "Next.js + shadcn/ui on the frontend, a Cloudflare Workers backend with R2 for PDF storage and Postgres for bill state, Accountly AI for PDF parsing, and better-auth for sessions.",
  },
];

const FaqSection = () => {
  return (
    <section id="faq" className="py-24 sm:py-32">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <Badge variant="outline" className="mb-4">
            FAQ
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">Common questions</h2>
          <p className="text-lg text-muted-foreground">
            How Accountly parses the PDF, what gets stored, and what the review flow looks like.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="bg-transparent">
            <div className="p-0">
              <Accordion type="single" collapsible className="space-y-5">
                {faqItems.map((item) => (
                  <AccordionItem
                    key={item.value}
                    value={item.value}
                    className="rounded-md !border bg-transparent"
                  >
                    <AccordionTrigger className="cursor-pointer items-center gap-4 rounded-none bg-transparent py-2 ps-3 pe-4 hover:no-underline data-[state=open]:border-b">
                      <div className="flex items-center gap-4">
                        <div className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full">
                          <CircleHelp className="size-5" />
                        </div>
                        <span className="text-start font-semibold">{item.question}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 bg-transparent">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">
              Still curious? Open the dashboard and try it.
            </p>
            <Button className="cursor-pointer" asChild>
              <a href="/bills">Open Dashboard</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export { FaqSection };

"use client";

import Link from "next/link";
import { ArrowRight, FileUp, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function CTASection() {
  return (
    <section className="py-16 lg:py-24 bg-muted/80">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <div className="space-y-8">
              <div className="flex flex-col items-center gap-4">
                <Badge variant="outline" className="flex items-center gap-2">
                  <FileUp className="size-3" />
                  Ready when you are
                </Badge>
              </div>

              <div className="space-y-6">
                <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                  Stop retyping
                  <span className="flex sm:inline-flex justify-center">
                    <span className="relative mx-2">
                      <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        supplier invoices
                      </span>
                      <div className="absolute start-0 -bottom-2 h-1 w-full bg-gradient-to-r from-primary/30 to-secondary/30" />
                    </span>
                  </span>
                </h1>

                <p className="text-muted-foreground mx-auto max-w-2xl text-balance lg:text-xl">
                  Upload a PDF, review the proposed journal entry, approve or decline. That&apos;s
                  the whole product.
                </p>
              </div>

              <div className="flex flex-col justify-center gap-4 sm:flex-row sm:gap-6">
                <Button size="lg" className="cursor-pointer px-8 py-6 text-lg font-medium" asChild>
                  <Link href="/dashboard">
                    <FileUp className="me-2 size-5" />
                    Open Dashboard
                    <ArrowRight className="ms-2 size-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="cursor-pointer px-8 py-6 text-lg font-medium"
                  asChild
                >
                  <Link href="/auth/sign-in">
                    <LogIn className="me-2 size-5" />
                    Sign In
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DotPattern } from "@/components/dot-pattern";

export function HeroSection() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden bg-gradient-to-b from-background to-background/80 pt-16 sm:pt-20 pb-16"
    >
      <div className="absolute inset-0">
        <DotPattern className="opacity-100" size="md" fadeStyle="ellipse" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-8 flex justify-center">
            <Badge variant="outline" className="px-4 py-2 border-foreground">
              <Sparkles className="w-3 h-3 mr-2" />
              Invoice PDFs in. Journal entries out.
            </Badge>
          </div>

          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            From supplier invoice to
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {" "}
              balanced journal entry{" "}
            </span>
            in seconds
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Drop a PDF bill into Accountly. Our AI does the data entry — pulls every line item, maps
            it to the right BAS account, and hands you a balanced journal entry to approve. You stay
            in control. The typing goes away.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Button size="lg" className="text-base cursor-pointer" asChild>
              <Link href="/bills">
                Open the dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="text-base cursor-pointer" asChild>
              <Link href="/auth/sign-in">
                <FileText className="mr-2 h-4 w-4" />
                Sign in
              </Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-20 max-w-6xl">
          <div className="relative group">
            <div className="absolute top-2 lg:-top-8 left-1/2 transform -translate-x-1/2 w-[90%] mx-auto h-24 lg:h-80 bg-primary/50 rounded-full blur-3xl"></div>

            <div className="relative overflow-hidden rounded-xl border bg-card shadow-2xl">
              <Image
                src="/hero.png"
                alt="Accountly bills dashboard"
                width={2980}
                height={1358}
                className="block w-full rounded-xl"
                priority
              />
              <div className="absolute bottom-0 left-0 h-24 w-full rounded-b-xl bg-gradient-to-b from-background/0 via-background/60 to-background lg:h-40"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

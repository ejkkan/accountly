"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A 3D-tilt frame that wraps rendered JSX instead of a screenshot — so the
 * landing's feature panels are real components, with no placeholder image
 * assets to ship or keep in sync.
 */
export function Graphic3D({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("group relative aspect-[4/3] w-full", className)}>
      <div className="perspective-distant transform-3d">
        {/* Animated background glow */}
        <div className="absolute rounded-3xl bg-gradient-to-r from-primary/10 via-blue-500/10 to-purple-500/10 opacity-0 blur-2xl transition-all duration-1000 group-hover:opacity-100 sm:-inset-8" />

        <div className="relative size-full transform-3d transition-all duration-700 ease-out group-hover:translate-z-16 group-hover:rotate-x-8 group-hover:rotate-y-12">
          {/* Depth layer */}
          <div className="absolute inset-0 translate-x-2 translate-y-4 -translate-z-8 rounded-2xl">
            <div className="size-full rounded-2xl bg-gradient-to-br from-primary/10 via-background/40 to-secondary/10 shadow-xl" />
          </div>

          {/* Card holding the rendered graphic */}
          <div className="relative z-10 size-full overflow-hidden rounded-2xl border bg-card p-5 shadow-2xl shadow-primary/20 sm:p-6">
            {children}
            <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/20 transition-all duration-500 group-hover:ring-primary/40 dark:ring-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** Minimal "cortex" mark — hexagonal circuit node with primary→secondary gradient. */
export function CortexMark({ className, size = 40 }: { className?: string; size?: number }) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="8" y1="5" x2="40" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82FF" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <path
        d="M24 4.5 40.45 13.9V33.1L24 42.5 7.55 33.1V13.9Z"
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M24 18.4v-5.6M24 28.6v5.6M18.4 23.5h-5.6M29.6 23.5h5.6"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="24" cy="23.5" r="4.4" fill={`url(#${gradientId})`} />
    </svg>
  );
}

/** Cortex AI logo lockup. */
export function CortexLogo({
  className,
  markSize = 36,
  compact = false,
}: {
  className?: string;
  markSize?: number;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <CortexMark size={markSize} />
      <div className="flex flex-col leading-tight">
        <span className="text-lg font-bold tracking-tight text-foreground">
          Cortex <span className="text-primary">AI</span>
        </span>
        {!compact && <span className="text-[11px] font-medium text-muted-foreground">محیط هوش و دانش</span>}
      </div>
    </div>
  );
}

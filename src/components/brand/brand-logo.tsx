import * as React from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  /**
   * - `full`: Logo penuh Accelera HUB (emblem + teks ACCELERA HUB), cocok untuk halaman Login, Home, Reset Password, dan Verifikasi QR.
   * - `mark`: Emblem huruf "A" saja, cocok untuk ikon ringkas atau mobile topbar.
   * - `horizontal`: Emblem "A" di kiri + wordmark "Accelera HUB" & subjudul opsional di kanan, cocok untuk Sidebar & Header.
   */
  variant?: "full" | "mark" | "horizontal";
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  className?: string;
  /** Paksa tampilan terang di atas banner gelap (misal header brand navy). */
  inverted?: boolean;
}

const FULL_HEIGHT: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "h-12",
  md: "h-20",
  lg: "h-28",
};

const MARK_SIZE: Record<NonNullable<BrandLogoProps["size"]>, string> = {
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
};

export function BrandLogo({
  variant = "horizontal",
  size = "md",
  subtitle,
  className,
  inverted = false,
}: BrandLogoProps) {
  if (variant === "full") {
    return (
      <span className={cn("inline-flex items-center justify-center", className)}>
        {inverted ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/brand/logo-full-dark.png"
            alt="Logo Accelera HUB"
            className={cn("w-auto object-contain select-none", FULL_HEIGHT[size])}
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-full-light.png"
              alt="Logo Accelera HUB"
              className={cn(
                "w-auto object-contain select-none dark:hidden",
                FULL_HEIGHT[size]
              )}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-full-dark.png"
              alt="Logo Accelera HUB"
              className={cn(
                "hidden w-auto object-contain select-none dark:block",
                FULL_HEIGHT[size]
              )}
            />
          </>
        )}
      </span>
    );
  }

  if (variant === "mark") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card p-1 shadow-2xs",
          MARK_SIZE[size],
          inverted && "border-white/20 bg-white/10",
          className
        )}
      >
        {inverted ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/brand/logo-mark-dark.png"
            alt="Accelera HUB"
            className="size-full object-contain select-none"
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-mark-light.png"
              alt="Accelera HUB"
              className="size-full object-contain select-none dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-mark-dark.png"
              alt="Accelera HUB"
              className="hidden size-full object-contain select-none dark:block"
            />
          </>
        )}
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-xl border p-1 shadow-2xs",
          inverted
            ? "border-white/20 bg-white/10"
            : "border-border/80 bg-background dark:bg-card",
          MARK_SIZE[size]
        )}
      >
        {inverted ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/brand/logo-mark-dark.png"
            alt="Accelera HUB"
            className="size-full object-contain select-none"
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-mark-light.png"
              alt="Accelera HUB"
              className="size-full object-contain select-none dark:hidden"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo-mark-dark.png"
              alt="Accelera HUB"
              className="hidden size-full object-contain select-none dark:block"
            />
          </>
        )}
      </span>

      <span className="flex min-w-0 flex-col leading-tight">
        <span
          className={cn(
            "flex items-baseline gap-1 font-extrabold tracking-tight",
            size === "sm"
              ? "text-sm"
              : size === "lg"
              ? "text-lg"
              : "text-[15px]"
          )}
        >
          <span className={inverted ? "text-white" : "text-brand-navy dark:text-foreground"}>
            ACCELERA
          </span>
          <span className={inverted ? "text-teal-300" : "text-brand-teal"}>
            HUB
          </span>
        </span>
        {subtitle && (
          <span
            className={cn(
              "truncate text-[11px] font-medium",
              inverted ? "text-slate-200" : "text-muted-foreground"
            )}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}

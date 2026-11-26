"use client";

import * as React from "react";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface PageFlowStep {
  title: string;
  description: string;
  badge?: string;
  status?: "completed" | "active" | "upcoming";
}

interface PageGuideProps {
  /** Label konteks halaman / modul (misal: "Portal Mitra", "Meja Verifikator") */
  eyebrow: string;
  /** Judul utama halaman */
  title: string;
  /** Penjelasan jelas & mudah dipahami tentang fungsi halaman ini */
  purpose: string;
  /** Daftar langkah alur kerja pada halaman ini */
  steps: PageFlowStep[];
  /** Tips singkat tindakan utama yang bisa dilakukan pengguna saat ini */
  tip?: string;
  /** Slot tombol aksi atau metadata di kanan atas header */
  actions?: React.ReactNode;
  /** Slot link kembali atau breadcrumb mini di atas judul */
  topSlot?: React.ReactNode;
  /** Default terlipat (cocok untuk layar split-screen pemeriksaan agar area dokumen lega) */
  defaultCollapsed?: boolean;
  /** Gaya header: "banner" (Navy/Teal korporat) atau "card" (permukaan bersih dengan aksen teal) */
  variant?: "banner" | "card";
  className?: string;
}

export function PageGuide({
  eyebrow,
  title,
  purpose,
  steps,
  tip,
  actions,
  topSlot,
  defaultCollapsed = false,
  variant = "card",
  className,
}: PageGuideProps) {
  const [flowOpen, setFlowOpen] = React.useState(!defaultCollapsed);

  const isBanner = variant === "banner";

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border shadow-xs transition-colors",
        isBanner
          ? "border-brand-navy/20 bg-gradient-to-br from-[#0B2E5C] via-[#0D386E] to-[#0A4D68] text-white dark:border-brand-teal/25 dark:from-[#0B2549] dark:via-[#0D2E57] dark:to-[#0A3D4D]"
          : "border-border bg-card text-card-foreground",
        className
      )}
    >
      {/* BAGIAN ATAS: FUNGSI HALAMAN + AKSI */}
      <div className="p-5 sm:p-6">
        {topSlot && <div className="mb-3">{topSlot}</div>}

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 px-2.5 py-0.5 text-xs font-semibold",
                  isBanner
                    ? "border-teal-300/40 bg-teal-400/15 text-teal-100"
                    : "border-brand-teal/35 bg-brand-teal/10 text-accent-foreground"
                )}
              >
                <Compass className="size-3.5" />
                {eyebrow}
              </Badge>

              {steps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFlowOpen((prev) => !prev)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    isBanner
                      ? "bg-white/10 text-slate-100 hover:bg-white/20"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span>
                    {flowOpen
                      ? "Sembunyikan Panduan Alur"
                      : `Lihat Alur Kerja (${steps.length} Langkah)`}
                  </span>
                  {flowOpen ? (
                    <ChevronUp className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </button>
              )}
            </div>

            <h1
              className={cn(
                "text-xl font-bold tracking-tight sm:text-2xl",
                isBanner ? "text-white" : "text-foreground"
              )}
            >
              {title}
            </h1>

            <p
              className={cn(
                "max-w-3xl text-sm leading-relaxed",
                isBanner ? "text-slate-100/90" : "text-muted-foreground"
              )}
            >
              {purpose}
            </p>
          </div>

          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* BAGIAN ALUR KERJA HALAMAN */}
      {flowOpen && steps.length > 0 && (
        <div
          className={cn(
            "border-t px-5 py-4 sm:px-6",
            isBanner
              ? "border-white/15 bg-black/15"
              : "border-border/80 bg-surface-subtle/70 dark:bg-muted/35"
          )}
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span
              className={cn(
                "text-xs font-bold tracking-wide uppercase",
                isBanner ? "text-teal-200" : "text-brand-navy dark:text-brand-teal"
              )}
            >
              Alur Penggunaan &amp; Proses Kerja
            </span>
            {tip && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-xs",
                  isBanner ? "text-slate-200" : "text-muted-foreground"
                )}
              >
                <Info className="size-3.5 shrink-0 text-brand-teal" />
                <span>{tip}</span>
              </span>
            )}
          </div>

          <div
            className={cn(
              "grid gap-3",
              steps.length === 3
                ? "sm:grid-cols-3"
                : steps.length === 4
                ? "sm:grid-cols-2 lg:grid-cols-4"
                : steps.length === 5
                ? "sm:grid-cols-2 lg:grid-cols-5"
                : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
            )}
          >
            {steps.map((step, index) => {
              const isActive = step.status === "active";
              const isCompleted = step.status === "completed";

              return (
                <div
                  key={`${step.title}-${index}`}
                  className={cn(
                    "relative flex flex-col justify-between gap-2 rounded-xl border p-3.5 transition-colors",
                    isBanner
                      ? isActive
                        ? "border-teal-300/60 bg-white/15 text-white ring-1 ring-teal-300/40"
                        : "border-white/15 bg-white/8 text-slate-100"
                      : isActive
                      ? "border-brand-teal bg-brand-teal/10 text-foreground ring-1 ring-brand-teal/30 dark:bg-brand-teal/15"
                      : isCompleted
                      ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                      : "border-border/80 bg-card text-foreground"
                  )}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                          isBanner
                            ? isActive
                              ? "bg-teal-400 text-[#04202C]"
                              : "bg-white/20 text-white"
                            : isActive
                            ? "bg-brand-teal text-brand-teal-foreground"
                            : isCompleted
                            ? "bg-emerald-600 text-white"
                            : "bg-brand-navy/10 text-brand-navy dark:bg-brand-teal/15 dark:text-brand-teal"
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : (
                          index + 1
                        )}
                      </span>

                      {step.badge ? (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            isBanner
                              ? "bg-white/15 text-teal-100"
                              : isActive
                              ? "bg-brand-teal/15 text-accent-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {step.badge}
                        </span>
                      ) : (
                        index < steps.length - 1 && (
                          <ArrowRight
                            className={cn(
                              "hidden size-3.5 lg:block",
                              isBanner ? "text-white/40" : "text-muted-foreground/50"
                            )}
                          />
                        )
                      )}
                    </div>

                    <p className="text-sm font-semibold leading-snug">
                      {step.title}
                    </p>
                    <p
                      className={cn(
                        "text-xs leading-relaxed",
                        isBanner ? "text-slate-200/90" : "text-muted-foreground"
                      )}
                    >
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

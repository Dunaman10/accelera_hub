import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-brand-navy/90 px-6 py-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2.5">
            <Skeleton className="h-6 w-72 bg-white/20" />
            <Skeleton className="h-4 w-96 max-w-full bg-white/15" />
          </div>
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-36 bg-white/20" />
            <Skeleton className="h-9 w-44 bg-white/20" />
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-5 shadow-xs"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-9 rounded-lg" />
            </div>
            <Skeleton className="mt-3.5 h-8 w-16" />
            <Skeleton className="mt-2 h-3.5 w-32" />
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-5 shadow-xs"
          >
            <Skeleton className="mb-4 h-4 w-44" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((__, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-5 shadow-xs"
          >
            <Skeleton className="mb-4 h-4 w-48" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TablePageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2.5">
            <Skeleton className="h-5 w-32 rounded-full" />
            <Skeleton className="h-7 w-72 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="grid gap-3.5 sm:grid-cols-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <Skeleton className="mb-4 h-5 w-52" />
        <div className="space-y-3.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border/60 pb-3.5 last:border-0"
            >
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-40 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function QueuePageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2.5">
            <Skeleton className="h-5 w-36 rounded-full" />
            <Skeleton className="h-7 w-80 max-w-full" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <Skeleton className="h-9 w-48" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-5 shadow-xs"
          >
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-3 h-7 w-14" />
            <Skeleton className="mt-2 h-3.5 w-44" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <Skeleton className="mb-4 h-5 w-56" />
        <div className="space-y-3.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border/60 pb-3.5 last:border-0"
            >
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-32 flex-1" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DetailPageSkeleton() {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <Skeleton className="mb-2.5 h-4 w-44" />
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      </div>

      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="w-full rounded-2xl border border-border bg-card p-5 shadow-xs lg:w-[55%]">
          <Skeleton className="mb-3 h-10 w-full" />
          <Skeleton className="h-[520px] w-full rounded-xl" />
        </div>
        <div className="w-full space-y-5 lg:w-[45%]">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <Skeleton className="mb-3 h-5 w-52" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
            <Skeleton className="mb-3 h-5 w-44" />
            <Skeleton className="h-36 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

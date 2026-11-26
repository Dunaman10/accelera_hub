import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3.5 rounded-2xl border border-dashed border-border bg-surface-subtle/60 px-6 py-12 text-center",
        className
      )}
    >
      <div className="flex size-13 items-center justify-center rounded-2xl bg-brand-teal/12 text-brand-teal">
        <Icon className="size-6 stroke-[1.75]" />
      </div>
      <div className="max-w-md space-y-1.5">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

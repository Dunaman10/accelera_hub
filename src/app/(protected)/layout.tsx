import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getAuthenticatedContext } from "@/lib/auth";
import { getHomeRouteForRole } from "@/lib/constants";
import { DashboardShell } from "@/components/layout/dashboard-shell";

async function AuthenticatedShellLoader({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    redirect("/login");
  }

  if (!ctx.profile.is_active) {
    redirect("/login?error=account_inactive");
  }

  return (
    <DashboardShell profile={ctx.profile} vendor={ctx.vendor}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Memuat data halaman...
          </div>
        }
      >
        {children}
      </Suspense>
    </DashboardShell>
  );
}

export default function ProtectedShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center gap-2 bg-muted/20 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat ruang kerja Accelera HUB...
        </div>
      }
    >
      <AuthenticatedShellLoader>{children}</AuthenticatedShellLoader>
    </Suspense>
  );
}

export { getHomeRouteForRole };

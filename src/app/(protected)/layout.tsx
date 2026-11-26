import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthenticatedContext } from "@/lib/auth";
import { getHomeRouteForRole } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TablePageSkeleton } from "@/components/ui/page-skeletons";

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

  // Hitung badge jumlah antrean kerja secara ringan sesuai RLS role
  const supabase = await createClient();
  let subQuery = supabase
    .from("billing_submissions")
    .select("current_stage, final_status");

  if (ctx.profile.role === "mitra" && ctx.profile.vendor_id) {
    subQuery = subQuery.eq("vendor_id", ctx.profile.vendor_id);
  }

  const { data: stageRows } = await subQuery;
  const rows = stageRows ?? [];

  const adminPendingCount = rows.filter((r) =>
    [
      "SUBMITTED",
      "PRE_CHECK",
      "PHYSICAL_CHECK",
      "REVISION_PIC",
      "REVISION_ACCOUNTING",
    ].includes(r.current_stage)
  ).length;

  const picPendingCount = rows.filter(
    (r) => r.current_stage === "PIC_APPROVAL"
  ).length;

  const akuntansiPendingCount = rows.filter(
    (r) => r.current_stage === "ACCOUNTING_APPROVAL"
  ).length;

  const sppPendingCount = rows.filter(
    (r) => r.current_stage === "SPP_PROCESSING"
  ).length;

  const mitraActionCount = rows.filter((r) =>
    [
      "WAITING_HARDCOPY",
      "REVISION_SOFTCOPY",
      "REVISION_HARDCOPY",
      "REVISION_PIC",
      "REVISION_ACCOUNTING",
    ].includes(r.current_stage)
  ).length;

  const queueCounts: Record<string, number> = {
    "/admin/queue": adminPendingCount,
    "/pic": picPendingCount,
    "/akuntansi": akuntansiPendingCount,
    "/spp": sppPendingCount,
    "/mitra": mitraActionCount,
  };

  return (
    <DashboardShell
      profile={ctx.profile}
      vendor={ctx.vendor}
      queueCounts={queueCounts}
    >
      <Suspense fallback={<TablePageSkeleton />}>{children}</Suspense>
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
        <div className="min-h-screen bg-background p-6">
          <div className="mx-auto max-w-6xl">
            <TablePageSkeleton />
          </div>
        </div>
      }
    >
      <AuthenticatedShellLoader>{children}</AuthenticatedShellLoader>
    </Suspense>
  );
}

export { getHomeRouteForRole };

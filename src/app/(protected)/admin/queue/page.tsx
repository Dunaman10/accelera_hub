import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  AdminQueueClient,
  type AdminQueueTabKey,
  type SubmissionWithVendor,
} from "./admin-queue-client";

const VALID_TABS = new Set<AdminQueueTabKey>([
  "precheck_softcopy",
  "menunggu_hardcopy",
  "cek_fisik_hardcopy",
  "koordinasi_temuan",
  "menunggu_revisi_mitra",
]);

async function AdminQueueContent({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole(["admin_accelera", "super_admin"]);
  const resolvedSearch = await searchParams;
  const requestedTab = resolvedSearch.tab as AdminQueueTabKey | undefined;
  const initialTab: AdminQueueTabKey =
    requestedTab && VALID_TABS.has(requestedTab)
      ? requestedTab
      : "precheck_softcopy";

  const supabase = await createClient();

  const [
    { count: activeVendorsCount },
    { count: userCount },
    { data: submissions },
  ] = await Promise.all([
    supabase
      .from("vendors")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase
      .from("billing_submissions")
      .select("*, vendors(name, npwp)")
      .order("received_date", { ascending: false }),
  ]);

  return (
    <AdminQueueClient
      submissions={(submissions ?? []) as SubmissionWithVendor[]}
      initialTab={initialTab}
      showMasterLinks={true}
      activeVendorsCount={activeVendorsCount ?? 0}
      userCount={userCount ?? 0}
    />
  );
}

export default function AdminQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Antrean Kerja Admin Accelera...
        </div>
      }
    >
      <AdminQueueContent searchParams={searchParams} />
    </Suspense>
  );
}

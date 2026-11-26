import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  AdminQueueClient,
  type SubmissionWithVendor,
} from "./queue/admin-queue-client";

async function AdminHomeContent() {
  await requireRole(["admin_accelera", "super_admin"]);
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
      initialTab="precheck_softcopy"
      showMasterLinks={true}
      activeVendorsCount={activeVendorsCount ?? 0}
      userCount={userCount ?? 0}
    />
  );
}

export default function AdminHomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Panel Admin Accelera...
        </div>
      }
    >
      <AdminHomeContent />
    </Suspense>
  );
}

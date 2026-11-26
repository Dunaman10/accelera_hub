import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QueuePageSkeleton } from "@/components/ui/page-skeletons";
import { MitraDashboardClient } from "./mitra-dashboard-client";

async function MitraHomeContent() {
  const ctx = await requireRole(["mitra", "super_admin"]);
  const supabase = await createClient();

  // Kebijakan RLS submissions_select_policy menjamin Mitra hanya mendapatkan pengajuan milik vendor_id sendiri
  let query = supabase
    .from("billing_submissions")
    .select("*")
    .order("received_date", { ascending: false });

  if (ctx.profile.role === "mitra" && ctx.profile.vendor_id) {
    query = query.eq("vendor_id", ctx.profile.vendor_id);
  }

  const { data: submissions } = await query;

  return (
    <MitraDashboardClient
      submissions={submissions ?? []}
      vendor={ctx.vendor}
    />
  );
}

export default function MitraHomePage() {
  return (
    <Suspense fallback={<QueuePageSkeleton />}>
      <MitraHomeContent />
    </Suspense>
  );
}

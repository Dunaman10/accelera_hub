import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TablePageSkeleton } from "@/components/ui/page-skeletons";
import { VendorsClient } from "./vendors-client";

async function AdminVendorsContent() {
  const ctx = await requireRole(["admin_accelera", "super_admin"]);
  const supabase = await createClient();

  const { data: vendors } = await supabase
    .from("vendors")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <VendorsClient
      initialVendors={vendors ?? []}
      currentUserRole={ctx.profile.role}
    />
  );
}

export default function AdminVendorsPage() {
  return (
    <Suspense fallback={<TablePageSkeleton />}>
      <AdminVendorsContent />
    </Suspense>
  );
}

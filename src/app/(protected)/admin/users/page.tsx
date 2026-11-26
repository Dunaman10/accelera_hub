import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TablePageSkeleton } from "@/components/ui/page-skeletons";
import { UsersClient } from "./users-client";

async function AdminUsersContent() {
  await requireRole(["admin_accelera", "super_admin"]);
  const supabase = await createClient();

  const [{ data: profiles }, { data: vendors }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("vendors").select("*").order("name", { ascending: true }),
  ]);

  return (
    <UsersClient
      initialProfiles={profiles ?? []}
      vendors={vendors ?? []}
    />
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<TablePageSkeleton />}>
      <AdminUsersContent />
    </Suspense>
  );
}

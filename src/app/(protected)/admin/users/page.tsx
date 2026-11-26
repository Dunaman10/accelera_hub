import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Manajemen User...
        </div>
      }
    >
      <AdminUsersContent />
    </Suspense>
  );
}

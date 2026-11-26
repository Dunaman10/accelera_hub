import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Master Data Vendor...
        </div>
      }
    >
      <AdminVendorsContent />
    </Suspense>
  );
}

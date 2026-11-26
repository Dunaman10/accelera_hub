import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Vendor } from "@/types";
import { NewSubmissionForm } from "./new-submission-form";

async function NewMitraSubmissionContent() {
  const ctx = await requireRole(["mitra", "admin_accelera", "super_admin"]);
  const isInternal = ctx.profile.role !== "mitra";

  let availableVendors: Vendor[] = [];
  if (isInternal) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("vendors")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true });
    availableVendors = data ?? [];
  }

  return (
    <NewSubmissionForm
      vendor={ctx.vendor}
      availableVendors={availableVendors}
      isInternalCreator={isInternal}
    />
  );
}

export default function NewMitraSubmissionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Formulir Pengajuan Tagihan...
        </div>
      }
    >
      <NewMitraSubmissionContent />
    </Suspense>
  );
}

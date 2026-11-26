import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DetailPageSkeleton } from "@/components/ui/page-skeletons";
import { AdminSubmissionInspectClient } from "./admin-submission-inspect-client";

async function AdminSubmissionDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["admin_accelera", "super_admin"]);

  const supabase = await createClient();

  const { data: submission, error: subError } = await supabase
    .from("billing_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (subError || !submission) {
    notFound();
  }

  const [{ data: vendor }, { data: documents }, { data: stageLogs }] =
    await Promise.all([
      supabase
        .from("vendors")
        .select("*")
        .eq("id", submission.vendor_id)
        .maybeSingle(),
      supabase
        .from("submission_documents")
        .select("*")
        .eq("submission_id", submission.id)
        .order("version", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("stage_logs")
        .select("*")
        .eq("submission_id", submission.id)
        .order("entered_at", { ascending: false }),
    ]);

  return (
    <AdminSubmissionInspectClient
      submission={submission}
      vendor={vendor ?? null}
      documents={documents ?? []}
      stageLogs={stageLogs ?? []}
    />
  );
}

export default function AdminSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <AdminSubmissionDetailContent params={params} />
    </Suspense>
  );
}

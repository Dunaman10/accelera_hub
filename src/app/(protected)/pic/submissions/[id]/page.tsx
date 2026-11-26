import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeStageSlaIndicator } from "@/lib/sla";
import { DetailPageSkeleton } from "@/components/ui/page-skeletons";
import { PicSubmissionInspectClient } from "./pic-submission-inspect-client";

async function PicSubmissionDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["pic_usaha", "super_admin"]);

  const supabase = await createClient();

  const { data: submission, error: subError } = await supabase
    .from("billing_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (subError || !submission) {
    notFound();
  }

  const [
    { data: vendor },
    { data: documents },
    { data: stageLogs },
    { data: holidays },
  ] = await Promise.all([
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
    supabase.from("national_holidays").select("holiday_date"),
  ]);

  const logs = stageLogs ?? [];
  const openLog = logs.find((l) => l.exited_at === null) ?? null;
  const holidayDates = (holidays ?? []).map((h) => h.holiday_date);
  const stageSla = computeStageSlaIndicator(
    submission.current_stage,
    openLog?.entered_at ?? submission.updated_at,
    holidayDates
  );

  return (
    <PicSubmissionInspectClient
      submission={submission}
      vendor={vendor ?? null}
      documents={documents ?? []}
      stageLogs={logs}
      stageSla={stageSla}
    />
  );
}

export default function PicSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <PicSubmissionDetailContent params={params} />
    </Suspense>
  );
}

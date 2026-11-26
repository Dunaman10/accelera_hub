import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computeStageSlaIndicator } from "@/lib/sla";
import { SppSubmissionInspectClient } from "./spp-submission-inspect-client";

async function SppSubmissionDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole(["divisi_usaha", "akuntansi", "super_admin"]);

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
    { data: sppDoc },
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
    supabase
      .from("spp_documents")
      .select("*")
      .eq("submission_id", submission.id)
      .maybeSingle(),
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
    <SppSubmissionInspectClient
      submission={submission}
      vendor={vendor ?? null}
      documents={documents ?? []}
      stageLogs={logs}
      sppDocument={sppDoc ?? null}
      stageSla={stageSla}
    />
  );
}

export default function SppSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Halaman Penyusunan &amp; Penerbitan SPP...
        </div>
      }
    >
      <SppSubmissionDetailContent params={params} />
    </Suspense>
  );
}

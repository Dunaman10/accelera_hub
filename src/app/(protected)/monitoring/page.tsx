import { Suspense } from "react";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { computeSubmissionSlaFromLogs } from "@/lib/sla";
import { fetchHolidayDateStrings } from "@/lib/sla/server";
import type { BillingSubmission, StageLog, Vendor } from "@/types";
import { TablePageSkeleton } from "@/components/ui/page-skeletons";
import {
  MonitoringTableClient,
  type MonitoringSubmissionRow,
} from "./monitoring-table-client";

async function MonitoringPageContent() {
  const ctx = await requireRole([
    "admin_accelera",
    "pic_usaha",
    "akuntansi",
    "divisi_usaha",
    "super_admin",
  ]);

  const adminSupabase = createAdminClient();

  const [
    { data: submissionsData },
    { data: vendorsData },
    { data: stageLogsData },
    holidayDates,
  ] = await Promise.all([
    adminSupabase
      .from("billing_submissions")
      .select("*, vendors(name)")
      .order("received_date", { ascending: false }),
    adminSupabase
      .from("vendors")
      .select("id, name, is_active")
      .order("name", { ascending: true }),
    adminSupabase
      .from("stage_logs")
      .select(
        "submission_id, to_stage, entered_at, exited_at, ended_at, is_paused, is_internal_sla, working_days_spent, working_days_used"
      )
      .order("entered_at", { ascending: true }),
    fetchHolidayDateStrings(),
  ]);

  const logsBySubmission = new Map<
    string,
    Array<
      Pick<
        StageLog,
        | "to_stage"
        | "entered_at"
        | "exited_at"
        | "ended_at"
        | "is_paused"
        | "is_internal_sla"
        | "working_days_spent"
        | "working_days_used"
      >
    >
  >();

  for (const log of stageLogsData ?? []) {
    const arr = logsBySubmission.get(log.submission_id) ?? [];
    arr.push(log);
    logsBySubmission.set(log.submission_id, arr);
  }

  const nowIso = new Date().toISOString();

  const rows: MonitoringSubmissionRow[] = (submissionsData ?? []).map((raw) => {
    const sub = raw as BillingSubmission & {
      vendors?: { name?: string } | Array<{ name?: string }> | null;
    };
    const vendorRel = sub.vendors;
    const vendorName =
      (Array.isArray(vendorRel) ? vendorRel[0]?.name : vendorRel?.name) ??
      "Mitra";

    const logs = logsBySubmission.get(sub.id) ?? [];
    if (logs.length > 0) {
      const computed = computeSubmissionSlaFromLogs({
        logs,
        currentStage: sub.current_stage,
        finalStatus: sub.final_status,
        slaTargetDays: sub.sla_target_days,
        holidayDates,
        nowAt: nowIso,
      });

      return {
        ...sub,
        vendor_name: vendorName,
        actual_working_days: computed.actualWorkingDays,
        sla_status: computed.slaStatus,
      };
    }

    return {
      ...sub,
      vendor_name: vendorName,
    };
  });

  const vendorOptions: Array<Pick<Vendor, "id" | "name" | "is_active">> =
    vendorsData ?? [];

  return (
    <MonitoringTableClient
      submissions={rows}
      vendors={vendorOptions}
      userRole={ctx.profile.role}
    />
  );
}

export default function MonitoringPage() {
  return (
    <Suspense fallback={<TablePageSkeleton />}>
      <MonitoringPageContent />
    </Suspense>
  );
}

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getDriveStorageQuota,
  type DriveStorageQuota,
} from "@/lib/google-drive";
import { computeSubmissionSlaFromLogs } from "@/lib/sla";
import { fetchHolidayDateStrings } from "@/lib/sla/server";
import type { BillingSubmission, StageLog } from "@/types";
import {
  DashboardMonitoringClient,
  type DashboardSubmissionItem,
} from "./dashboard-monitoring-client";

async function DashboardMonitoringContent() {
  const ctx = await requireRole([
    "admin_accelera",
    "pic_usaha",
    "akuntansi",
    "divisi_usaha",
    "super_admin",
  ]);

  const adminSupabase = createAdminClient();
  const isAdminOrSuper =
    ctx.profile.role === "admin_accelera" ||
    ctx.profile.role === "super_admin";

  // Ambil seluruh pengajuan, stage_logs, hari libur, serta kuota Google Drive (khusus Admin Accelera & Super Admin)
  const [
    { data: submissionsData },
    { data: stageLogsData },
    holidayDates,
    driveQuotaResult,
  ] = await Promise.all([
    adminSupabase
      .from("billing_submissions")
      .select("*, vendors(name)")
      .order("received_date", { ascending: false }),
    adminSupabase
      .from("stage_logs")
      .select(
        "submission_id, to_stage, entered_at, exited_at, ended_at, is_paused, is_internal_sla, working_days_spent, working_days_used"
      )
      .order("entered_at", { ascending: true }),
    fetchHolidayDateStrings(),
    isAdminOrSuper
      ? getDriveStorageQuota()
          .then((quota) => ({ quota, error: null as string | null }))
          .catch((err) => ({
            quota: null as DriveStorageQuota | null,
            error:
              err instanceof Error
                ? err.message
                : "Gagal membaca kuota penyimpanan Google Drive.",
          }))
      : Promise.resolve({
          quota: null as DriveStorageQuota | null,
          error: null as string | null,
        }),
  ]);

  // Kelompokkan stage_logs per submission_id untuk kalkulasi SLA real-time
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

  const items: DashboardSubmissionItem[] = (submissionsData ?? []).map(
    (raw) => {
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
    }
  );

  return (
    <DashboardMonitoringClient
      submissions={items}
      userRole={ctx.profile.role}
      driveQuota={driveQuotaResult.quota}
      driveQuotaError={driveQuotaResult.error}
    />
  );
}

export default function DashboardMonitoringPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Dashboard Monitoring Penagihan...
        </div>
      }
    >
      <DashboardMonitoringContent />
    </Suspense>
  );
}

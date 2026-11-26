import { createAdminClient } from "@/lib/supabase/server";
import type { BillingSubmission, SlaStatus, StageLog } from "@/types";
import {
  calculateWorkingDays,
  computeSubmissionSlaFromLogs,
  DEFAULT_INDONESIA_HOLIDAYS_2026_2027,
  SLA_TOTAL_TARGET_DAYS,
} from "./index";

export interface RecalculateSubmissionSlaServerResult {
  submission: BillingSubmission | null;
  actualWorkingDays: number;
  slaTargetDays: number;
  slaStatus: SlaStatus;
  isPaused: boolean;
}

/**
 * Mengambil seluruh daftar tanggal hari libur nasional (`national_holidays`)
 * dengan fallback ke seed Hari Libur Nasional Indonesia 2026-2027.
 */
export async function fetchHolidayDateStrings(): Promise<string[]> {
  try {
    const adminSupabase = createAdminClient();
    const { data } = await adminSupabase
      .from("national_holidays")
      .select("holiday_date");

    if (data && data.length > 0) {
      return data.map((row) => row.holiday_date);
    }
  } catch {
    // Fallback ke seed default jika koneksi gagal
  }

  return DEFAULT_INDONESIA_HOLIDAYS_2026_2027.map((h) => h.holiday_date);
}

/**
 * Menjalankan kalkulasi SLA hari kerja pengajuan (`recalculate_submission_sla(p_submission_id)`).
 * - Memanggil RPC PostgreSQL `recalculate_submission_sla` bila migrasi `002_sla_engine.sql` sudah aktif di DB.
 * - Dan juga menyinkronkan melalui mesin SLA TypeScript (kompatibel baik sebelum maupun sesudah migrasi SQL dijalankan)
 *   agar `working_days_used`, `working_days_spent`, `actual_working_days`, dan `sla_status` selalu akurat 100%.
 */
export async function recalculateSubmissionSlaServer(
  submissionId: string,
  nowAt: Date | string = new Date()
): Promise<RecalculateSubmissionSlaServerResult> {
  const adminSupabase = createAdminClient();
  const nowIso = new Date(nowAt).toISOString();

  // 1. Coba panggil RPC PostgreSQL `recalculate_submission_sla` terlebih dahulu
  try {
    await adminSupabase.rpc("recalculate_submission_sla", {
      p_submission_id: submissionId,
    });
  } catch {
    // Abaikan jika fungsi RPC belum dibuat di instance Supabase, lanjutkan kalkulasi sinkron di bawah
  }

  // 2. Ambil data pengajuan, stage_logs, dan national_holidays
  const [{ data: submission }, { data: stageLogs }, holidayDates] =
    await Promise.all([
      adminSupabase
        .from("billing_submissions")
        .select("*")
        .eq("id", submissionId)
        .maybeSingle(),
      adminSupabase
        .from("stage_logs")
        .select("*")
        .eq("submission_id", submissionId)
        .order("entered_at", { ascending: true }),
      fetchHolidayDateStrings(),
    ]);

  if (!submission) {
    return {
      submission: null,
      actualWorkingDays: 0,
      slaTargetDays: SLA_TOTAL_TARGET_DAYS,
      slaStatus: "Dalam Proses",
      isPaused: false,
    };
  }

  const logs: StageLog[] = stageLogs ?? [];

  // 3. Perbarui `working_days_spent` & `working_days_used` pada setiap baris stage_logs
  for (const log of logs) {
    const isInternal =
      log.is_internal_sla !== undefined
        ? log.is_internal_sla && !log.is_paused
        : !log.is_paused;
    const endedAt = log.ended_at ?? log.exited_at ?? nowIso;

    const calculatedDays = isInternal
      ? calculateWorkingDays(log.entered_at, endedAt, holidayDates)
      : 0;

    if (Number(log.working_days_spent ?? 0) !== calculatedDays) {
      await adminSupabase
        .from("stage_logs")
        .update({
          working_days_spent: calculatedDays,
        })
        .eq("id", log.id);
      log.working_days_spent = calculatedDays;
      log.working_days_used = calculatedDays;
    }
  }

  // 4. Hitung total durasi hari kerja internal & status SLA otomatis
  const computed = computeSubmissionSlaFromLogs({
    logs,
    currentStage: submission.current_stage,
    finalStatus: submission.final_status,
    slaTargetDays: submission.sla_target_days || SLA_TOTAL_TARGET_DAYS,
    holidayDates,
    nowAt: nowIso,
  });

  // 5. Update `billing_submissions`
  const { data: updatedSubmission } = await adminSupabase
    .from("billing_submissions")
    .update({
      actual_working_days: computed.actualWorkingDays,
      sla_status: computed.slaStatus,
    })
    .eq("id", submissionId)
    .select("*")
    .maybeSingle();

  return {
    submission: (updatedSubmission ?? {
      ...submission,
      actual_working_days: computed.actualWorkingDays,
      sla_status: computed.slaStatus,
    }) as BillingSubmission,
    actualWorkingDays: computed.actualWorkingDays,
    slaTargetDays: submission.sla_target_days || SLA_TOTAL_TARGET_DAYS,
    slaStatus: computed.slaStatus,
    isPaused: computed.isPaused,
  };
}

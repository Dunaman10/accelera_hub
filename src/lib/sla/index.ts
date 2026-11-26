import type { FinalStatus, SlaStatus, StageLog, SubmissionStage } from "@/types";

/**
 * Konfigurasi dasar SLA Internal Accelera HUB (Total = 6 Hari Kerja)
 * - Pre-check Softcopy: 1 hari kerja
 * - Cek Fisik Hardcopy: 1 hari kerja
 * - Approval PIC Usaha: 1 hari kerja
 * - Approval Akuntansi: 2 hari kerja
 * - Penerbitan SPP: 1 hari kerja
 */
export const SLA_TOTAL_TARGET_DAYS = 6;

export const SLA_STAGE_TARGETS: Partial<Record<SubmissionStage, number>> = {
  PRE_CHECK: 1,
  PHYSICAL_CHECK: 1,
  PIC_APPROVAL: 1,
  ACCOUNTING_APPROVAL: 2,
  SPP_PROCESSING: 1,
};

/**
 * Daftar stage yang otomatis menghentikan (PAUSE) perhitungan hari kerja SLA
 * karena bola berada di tangan Mitra (pengiriman berkas fisik / perbaikan revisi).
 */
export const SLA_PAUSED_STAGES: ReadonlySet<SubmissionStage> = new Set([
  "WAITING_HARDCOPY",
  "REVISION_SOFTCOPY",
  "REVISION_HARDCOPY",
  "REVISION_PIC",
  "REVISION_ACCOUNTING",
]);

export function isStagePaused(stage: SubmissionStage): boolean {
  return SLA_PAUSED_STAGES.has(stage);
}

/**
 * Daftar default Hari Libur Nasional & Cuti Bersama Indonesia 2026-2027
 * (Digunakan sebagai fallback/seed apabila tabel `national_holidays` belum dimuat)
 */
export const DEFAULT_INDONESIA_HOLIDAYS_2026_2027: Array<{
  holiday_date: string;
  description: string;
  year: number;
  is_joint_leave: boolean;
}> = [
  // 2026
  { holiday_date: "2026-01-01", description: "Tahun Baru 2026 Masehi", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-01-16", description: "Isra Mikraj Nabi Muhammad SAW", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-02-16", description: "Cuti Bersama Tahun Baru Imlek 2577 Kongzili", year: 2026, is_joint_leave: true },
  { holiday_date: "2026-02-17", description: "Tahun Baru Imlek 2577 Kongzili", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-03-18", description: "Cuti Bersama Hari Suci Nyepi Tahun Baru Saka 1948", year: 2026, is_joint_leave: true },
  { holiday_date: "2026-03-19", description: "Hari Suci Nyepi Tahun Baru Saka 1948", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-03-20", description: "Hari Raya Idul Fitri 1447 Hijriah (Hari Pertama)", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-03-21", description: "Hari Raya Idul Fitri 1447 Hijriah (Hari Kedua)", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-03-23", description: "Cuti Bersama Hari Raya Idul Fitri 1447 Hijriah", year: 2026, is_joint_leave: true },
  { holiday_date: "2026-03-24", description: "Cuti Bersama Hari Raya Idul Fitri 1447 Hijriah", year: 2026, is_joint_leave: true },
  { holiday_date: "2026-03-25", description: "Cuti Bersama Hari Raya Idul Fitri 1447 Hijriah", year: 2026, is_joint_leave: true },
  { holiday_date: "2026-04-03", description: "Wafat Yesus Kristus (Jumat Agung)", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-05-01", description: "Hari Buruh Internasional", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-05-14", description: "Kenaikan Yesus Kristus", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-05-15", description: "Cuti Bersama Kenaikan Yesus Kristus", year: 2026, is_joint_leave: true },
  { holiday_date: "2026-05-27", description: "Hari Raya Idul Adha 1447 Hijriah", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-05-28", description: "Cuti Bersama Hari Raya Idul Adha 1447 Hijriah", year: 2026, is_joint_leave: true },
  { holiday_date: "2026-05-31", description: "Hari Raya Waisak 2570 BE", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-06-01", description: "Hari Lahir Pancasila", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-06-16", description: "Tahun Baru Islam 1448 Hijriah", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-08-17", description: "Hari Kemerdekaan Republik Indonesia ke-81", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-08-25", description: "Maulid Nabi Muhammad SAW", year: 2026, is_joint_leave: false },
  { holiday_date: "2026-12-24", description: "Cuti Bersama Hari Raya Natal", year: 2026, is_joint_leave: true },
  { holiday_date: "2026-12-25", description: "Hari Raya Natal", year: 2026, is_joint_leave: false },
  // 2027
  { holiday_date: "2027-01-01", description: "Tahun Baru 2027 Masehi", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-01-05", description: "Isra Mikraj Nabi Muhammad SAW", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-02-05", description: "Cuti Bersama Tahun Baru Imlek 2578 Kongzili", year: 2027, is_joint_leave: true },
  { holiday_date: "2027-02-06", description: "Tahun Baru Imlek 2578 Kongzili", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-03-08", description: "Cuti Bersama Hari Raya Idul Fitri 1448 Hijriah", year: 2027, is_joint_leave: true },
  { holiday_date: "2027-03-09", description: "Hari Raya Idul Fitri 1448 Hijriah (Hari Pertama)", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-03-10", description: "Hari Raya Idul Fitri 1448 Hijriah (Hari Kedua)", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-03-11", description: "Cuti Bersama Hari Raya Idul Fitri 1448 Hijriah", year: 2027, is_joint_leave: true },
  { holiday_date: "2027-03-12", description: "Cuti Bersama Hari Raya Idul Fitri 1448 Hijriah", year: 2027, is_joint_leave: true },
  { holiday_date: "2027-03-26", description: "Wafat Yesus Kristus (Jumat Agung)", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-04-08", description: "Hari Suci Nyepi Tahun Baru Saka 1949", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-04-09", description: "Cuti Bersama Hari Suci Nyepi Tahun Baru Saka 1949", year: 2027, is_joint_leave: true },
  { holiday_date: "2027-05-01", description: "Hari Buruh Internasional", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-05-06", description: "Kenaikan Yesus Kristus", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-05-07", description: "Cuti Bersama Kenaikan Yesus Kristus", year: 2027, is_joint_leave: true },
  { holiday_date: "2027-05-16", description: "Hari Raya Idul Adha 1448 Hijriah", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-05-17", description: "Cuti Bersama Hari Raya Idul Adha 1448 Hijriah", year: 2027, is_joint_leave: true },
  { holiday_date: "2027-05-20", description: "Hari Raya Waisak 2571 BE", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-06-01", description: "Hari Lahir Pancasila", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-06-06", description: "Tahun Baru Islam 1449 Hijriah", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-08-14", description: "Maulid Nabi Muhammad SAW", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-08-17", description: "Hari Kemerdekaan Republik Indonesia ke-82", year: 2027, is_joint_leave: false },
  { holiday_date: "2027-12-24", description: "Cuti Bersama Hari Raya Natal", year: 2027, is_joint_leave: true },
  { holiday_date: "2027-12-25", description: "Hari Raya Natal", year: 2027, is_joint_leave: false },
];

/**
 * Menghitung jumlah hari kerja di antara dua timestamp (zona waktu WIB / Asia/Jakarta),
 * memotong hari Sabtu, Minggu, dan seluruh tanggal pada tabel `national_holidays`.
 * Identik secara matematis dengan fungsi PostgreSQL `calculate_working_days(start_ts, end_ts)`.
 */
export function calculateWorkingDays(
  startAt: Date | string,
  endAt: Date | string,
  holidayDates: Iterable<string> = []
): number {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    end.getTime() <= start.getTime()
  ) {
    return 0;
  }

  const holidaySet = new Set(holidayDates);
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7 (Asia/Jakarta)
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  const startWibMs = start.getTime() + WIB_OFFSET_MS;
  const endWibMs = end.getTime() + WIB_OFFSET_MS;

  const startDayIndex = Math.floor(startWibMs / MS_PER_DAY);
  const endDayIndex = Math.floor(endWibMs / MS_PER_DAY);

  let workingMs = 0;

  for (let dayIdx = startDayIndex; dayIdx <= endDayIndex; dayIdx++) {
    const dayStartMs = dayIdx * MS_PER_DAY;
    const dayEndMs = dayStartMs + MS_PER_DAY;

    const d = new Date(dayStartMs);
    const utcDay = d.getUTCDay(); // 0 = Sun, 6 = Sat
    if (utcDay === 0 || utcDay === 6) {
      continue;
    }

    const isoDate = d.toISOString().slice(0, 10);
    if (holidaySet.has(isoDate)) {
      continue;
    }

    const sliceStart = Math.max(startWibMs, dayStartMs);
    const sliceEnd = Math.min(endWibMs, dayEndMs);
    if (sliceEnd > sliceStart) {
      workingMs += sliceEnd - sliceStart;
    }
  }

  return Number((workingMs / MS_PER_DAY).toFixed(2));
}

export interface EvaluateSlaOptions {
  finalStatus?: FinalStatus;
  currentStage?: SubmissionStage;
  activeStageElapsedDays?: number;
  activeStageTargetDays?: number;
  isPaused?: boolean;
}

/**
 * Menentukan status SLA otomatis sesuai aturan Sprint 5:
 * - `final_status = 'Selesai'` & total <= target (6 hk) -> `'Sesuai SLA'`
 * - total > target (6 hk) -> `'Terlambat'`
 * - masih berjalan & (total >= 4.5 hk atau memasuki hari kerja ke-5, atau sisa kuota tahap aktif <= 25%) -> `'Perlu Perhatian'`
 * - selain itu -> `'Dalam Proses'`
 */
export function evaluateSlaStatus(
  actualWorkingDays: number,
  targetDays: number = SLA_TOTAL_TARGET_DAYS,
  isCompletedOrOptions: boolean | EvaluateSlaOptions = false
): SlaStatus {
  const effectiveTarget = targetDays > 0 ? targetDays : SLA_TOTAL_TARGET_DAYS;

  let isCompleted = false;
  let activeStageRemainingRatio = 1;
  let isPaused = false;

  if (typeof isCompletedOrOptions === "boolean") {
    isCompleted = isCompletedOrOptions;
  } else {
    isCompleted =
      isCompletedOrOptions.finalStatus === "Selesai" ||
      isCompletedOrOptions.currentStage === "COMPLETED";
    isPaused = Boolean(
      isCompletedOrOptions.isPaused ||
        isCompletedOrOptions.finalStatus === "Menunggu Mitra" ||
        (isCompletedOrOptions.currentStage &&
          isStagePaused(isCompletedOrOptions.currentStage))
    );

    const stageTarget =
      isCompletedOrOptions.activeStageTargetDays ??
      (isCompletedOrOptions.currentStage
        ? SLA_STAGE_TARGETS[isCompletedOrOptions.currentStage] ?? 1
        : 1);
    const stageElapsed = isCompletedOrOptions.activeStageElapsedDays ?? 0;

    if (stageTarget > 0) {
      activeStageRemainingRatio = Math.max(
        0,
        (stageTarget - stageElapsed) / stageTarget
      );
    }
  }

  if (actualWorkingDays > effectiveTarget) {
    return "Terlambat";
  }

  if (isCompleted) {
    return "Sesuai SLA";
  }

  const warningThreshold =
    effectiveTarget === 6 ? 4.5 : Math.max(0, effectiveTarget - 1.5);

  if (
    actualWorkingDays >= warningThreshold ||
    (!isPaused && activeStageRemainingRatio <= 0.25)
  ) {
    return "Perlu Perhatian";
  }

  return "Dalam Proses";
}

export interface StageSlaIndicator {
  stageLimitDays: number;
  elapsedDays: number;
  remainingDays: number;
  remainingRatio: number;
  isOverdue: boolean;
  isWarning: boolean;
  label: string;
}

/**
 * Menghitung indikator sisa SLA spesifik tahap aktif (Pre-check 1 HK, Cek Fisik 1 HK, PIC Usaha 1 HK, Akuntansi 2 HK, SPP 1 HK)
 */
export function computeStageSlaIndicator(
  stage: SubmissionStage,
  stageEnteredAt?: string | null,
  holidayDates: Iterable<string> = [],
  nowAt: Date | string = new Date()
): StageSlaIndicator {
  const stageLimitDays = SLA_STAGE_TARGETS[stage] ?? 1;
  const elapsedDays = stageEnteredAt
    ? calculateWorkingDays(stageEnteredAt, nowAt, holidayDates)
    : 0;
  const rawRemaining = Number((stageLimitDays - elapsedDays).toFixed(2));
  const remainingDays = Math.max(0, rawRemaining);
  const remainingRatio =
    stageLimitDays > 0
      ? Number((remainingDays / stageLimitDays).toFixed(4))
      : 1;
  const isOverdue = elapsedDays > stageLimitDays;
  const isWarning = !isOverdue && remainingRatio <= 0.25;

  const label = isOverdue
    ? `Lewat ${Number((elapsedDays - stageLimitDays).toFixed(2))} HK (Batas ${stageLimitDays} HK)`
    : `Sisa ${remainingDays} HK dari ${stageLimitDays} HK`;

  return {
    stageLimitDays,
    elapsedDays,
    remainingDays,
    remainingRatio,
    isOverdue,
    isWarning,
    label,
  };
}

export interface RecalculatedSubmissionSlaResult {
  actualWorkingDays: number;
  slaStatus: SlaStatus;
  openLogWorkingDays: number;
  activeStageIndicator: StageSlaIndicator;
  isPaused: boolean;
}

/**
 * Menghitung ulang SLA sebuah pengajuan dari daftar `stage_logs` (termasuk log yang masih terbuka hingga `nowAt`),
 * menjumlahkan HANYA baris dengan `is_internal_sla === true` (`is_paused === false`).
 */
export function computeSubmissionSlaFromLogs(params: {
  logs: Array<
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
  >;
  currentStage: SubmissionStage;
  finalStatus: FinalStatus;
  slaTargetDays?: number;
  holidayDates: Iterable<string>;
  nowAt?: Date | string;
}): RecalculatedSubmissionSlaResult {
  const nowIso = params.nowAt
    ? new Date(params.nowAt).toISOString()
    : new Date().toISOString();
  const targetDays = params.slaTargetDays || SLA_TOTAL_TARGET_DAYS;

  let totalDays = 0;
  let openLogWorkingDays = 0;
  let openLogEnteredAt: string | null = null;
  let openLogStage: SubmissionStage = params.currentStage;
  let isPaused =
    isStagePaused(params.currentStage) ||
    params.finalStatus === "Menunggu Mitra";

  for (const log of params.logs) {
    const isInternal =
      log.is_internal_sla !== undefined
        ? log.is_internal_sla && !log.is_paused
        : !log.is_paused;
    const endedAt = log.ended_at ?? log.exited_at ?? null;

    if (!endedAt) {
      openLogEnteredAt = log.entered_at;
      openLogStage = log.to_stage;
      isPaused = !isInternal || params.finalStatus === "Menunggu Mitra";
      if (isInternal) {
        openLogWorkingDays = calculateWorkingDays(
          log.entered_at,
          nowIso,
          params.holidayDates
        );
        totalDays += openLogWorkingDays;
      }
    } else if (isInternal) {
      const recalculated = calculateWorkingDays(
        log.entered_at,
        endedAt,
        params.holidayDates
      );
      totalDays += recalculated;
    }
  }

  const actualWorkingDays = Number(totalDays.toFixed(2));
  const activeStageIndicator = computeStageSlaIndicator(
    openLogStage,
    openLogEnteredAt,
    params.holidayDates,
    nowIso
  );

  const slaStatus = evaluateSlaStatus(actualWorkingDays, targetDays, {
    finalStatus: params.finalStatus,
    currentStage: params.currentStage,
    activeStageElapsedDays: activeStageIndicator.elapsedDays,
    activeStageTargetDays: activeStageIndicator.stageLimitDays,
    isPaused,
  });

  return {
    actualWorkingDays,
    slaStatus,
    openLogWorkingDays,
    activeStageIndicator,
    isPaused,
  };
}

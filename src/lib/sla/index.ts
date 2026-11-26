import type { SlaStatus, SubmissionStage } from "@/types";

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
 * Menghitung jumlah hari kerja di antara dua tanggal (zona waktu WIB / Asia/Jakarta),
 * memotong hari Sabtu, Minggu, dan daftar tanggal pada tabel `national_holidays`.
 */
export function calculateWorkingDays(
  startAt: Date | string,
  endAt: Date | string,
  holidayDates: Iterable<string> = []
): number {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (end.getTime() <= start.getTime()) {
    return 0;
  }

  const holidaySet = new Set(holidayDates);
  const wibFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const MS_PER_HOUR = 60 * 60 * 1000;
  const totalHours = (end.getTime() - start.getTime()) / MS_PER_HOUR;

  // Iterasi per jam untuk akurasi pecahan hari kerja (NUMERIC(6,2))
  let workingHours = 0;
  const cursor = new Date(start.getTime());
  const stepCount = Math.ceil(totalHours);

  for (let i = 0; i < stepCount; i++) {
    const nextMs = Math.min(end.getTime(), cursor.getTime() + MS_PER_HOUR);
    const deltaHours = (nextMs - cursor.getTime()) / MS_PER_HOUR;

    const parts = wibFormatter.formatToParts(cursor);
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    const weekday = parts.find((p) => p.type === "weekday")?.value;
    const isoDate = `${year}-${month}-${day}`;

    const isWeekend = weekday === "Sat" || weekday === "Sun";
    const isHoliday = holidaySet.has(isoDate);

    if (!isWeekend && !isHoliday) {
      workingHours += deltaHours;
    }

    cursor.setTime(nextMs);
  }

  return Number((workingHours / 24).toFixed(2));
}

export function evaluateSlaStatus(
  actualWorkingDays: number,
  targetDays: number = SLA_TOTAL_TARGET_DAYS,
  isCompleted: boolean = false
): SlaStatus {
  if (actualWorkingDays > targetDays) {
    return "Terlambat";
  }
  if (isCompleted) {
    return "Sesuai SLA";
  }
  if (actualWorkingDays >= targetDays - 1) {
    return "Perlu Perhatian";
  }
  return "Dalam Proses";
}

export interface StageSlaIndicator {
  stageLimitDays: number;
  elapsedDays: number;
  remainingDays: number;
  isOverdue: boolean;
  isWarning: boolean;
  label: string;
}

/**
 * Menghitung indikator sisa SLA spesifik tahap aktif (misal PIC Usaha = 1 HK, Akuntansi = 2 HK, SPP = 1 HK)
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
  const isOverdue = elapsedDays > stageLimitDays;
  const isWarning = !isOverdue && remainingDays <= 0.35;

  const label = isOverdue
    ? `Lewat ${Number((elapsedDays - stageLimitDays).toFixed(2))} HK (Batas ${stageLimitDays} HK)`
    : `Sisa ${remainingDays} HK dari ${stageLimitDays} HK`;

  return {
    stageLimitDays,
    elapsedDays,
    remainingDays,
    isOverdue,
    isWarning,
    label,
  };
}

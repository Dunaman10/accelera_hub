"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  ExternalLink,
  FileCheck2,
  HardDrive,
  Info,
  Layers,
  PieChart as PieChartIcon,
  TableProperties,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BillingSubmission, UserRole } from "@/types";
import type { DriveStorageQuota } from "@/lib/google-drive";
import { formatBytes, formatRupiah } from "@/lib/constants";
import { PageGuide } from "@/components/layout/page-guide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DashboardSubmissionItem extends BillingSubmission {
  vendor_name: string;
}

interface DashboardMonitoringClientProps {
  submissions: DashboardSubmissionItem[];
  userRole: UserRole;
  driveQuota: DriveStorageQuota | null;
  driveQuotaError: string | null;
}

const MONTH_SHORT_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

const SLA_CHART_COLORS: Record<string, string> = {
  "Sesuai SLA": "#16a34a",
  Terlambat: "#dc2626",
  "Perlu Perhatian": "#d97706",
  "Dalam Proses": "#059c95",
};

const FINAL_STATUS_BAR_COLORS: Record<string, string> = {
  "Dalam Proses": "#059c95",
  "Menunggu Mitra": "#d97706",
  Selesai: "#16a34a",
  Dibatalkan: "#64748b",
};

interface ChartTooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: {
    color?: string;
    fill?: string;
    pctText?: string;
  };
}

interface ShadcnChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string | number;
  unitLabel?: string;
}

function ShadcnChartTooltip({
  active,
  payload,
  label,
  unitLabel = "Tagihan",
}: ShadcnChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const first = payload[0];
  const itemName = label ? String(label) : String(first?.name ?? "");
  const dotColor =
    first?.color ?? first?.payload?.fill ?? first?.payload?.color ?? "#059c95";

  return (
    <div className="rounded-xl border border-border bg-popover px-3.5 py-2.5 font-sans text-xs text-popover-foreground shadow-lg">
      {itemName && (
        <p className="mb-1 text-sm font-semibold text-foreground">{itemName}</p>
      )}
      <div className="flex items-center gap-2 text-muted-foreground tabular-nums">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
        <span>
          <strong className="font-bold text-foreground">
            {String(first?.value ?? 0)}
          </strong>{" "}
          {unitLabel}
          {first?.payload?.pctText ? ` (${first.payload.pctText})` : ""}
        </span>
      </div>
    </div>
  );
}

function getWibYearAndMonth(isoStr: string): { year: number; monthIdx: number } {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) {
    return { year: new Date().getFullYear(), monthIdx: 0 };
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(d);
  const year = Number(
    parts.find((p) => p.type === "year")?.value ?? d.getUTCFullYear()
  );
  const monthIdx =
    Number(parts.find((p) => p.type === "month")?.value ?? "1") - 1;
  return { year, monthIdx: Math.max(0, Math.min(11, monthIdx)) };
}

export function DashboardMonitoringClient({
  submissions,
  userRole,
  driveQuota,
  driveQuotaError,
}: DashboardMonitoringClientProps) {
  const availableYears = React.useMemo(() => {
    const years = new Set<number>([2026]);
    for (const s of submissions) {
      const { year } = getWibYearAndMonth(s.received_date);
      if (Number.isFinite(year)) years.add(year);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [submissions]);

  const [selectedYear, setSelectedYear] = React.useState<string>("ALL");

  const filteredSubmissions = React.useMemo(() => {
    if (selectedYear === "ALL") return submissions;
    const targetYear = Number(selectedYear);
    return submissions.filter(
      (s) => getWibYearAndMonth(s.received_date).year === targetYear
    );
  }, [submissions, selectedYear]);

  // ===========================================================================
  // KALKULASI METRIK UTAMA (BARIS 1 — 5 KARTU KPI)
  // ===========================================================================
  const totalCount = filteredSubmissions.length;

  const selesaiCount = filteredSubmissions.filter(
    (s) => s.final_status === "Selesai"
  ).length;
  const dalamProsesOnlyCount = filteredSubmissions.filter(
    (s) => s.final_status === "Dalam Proses"
  ).length;
  const menungguMitraCount = filteredSubmissions.filter(
    (s) => s.final_status === "Menunggu Mitra"
  ).length;
  const dibatalkanCount = filteredSubmissions.filter(
    (s) => s.final_status === "Dibatalkan"
  ).length;

  const combinedDalamProsesCount = dalamProsesOnlyCount + menungguMitraCount;

  const sesuaiSlaCount = filteredSubmissions.filter(
    (s) => s.sla_status === "Sesuai SLA"
  ).length;
  const terlambatCount = filteredSubmissions.filter(
    (s) => s.sla_status === "Terlambat"
  ).length;
  const perluPerhatianCount = filteredSubmissions.filter(
    (s) => s.sla_status === "Perlu Perhatian"
  ).length;
  const slaDalamProsesCount = filteredSubmissions.filter(
    (s) => s.sla_status === "Dalam Proses"
  ).length;

  const combinedTerlambatPerhatianCount = terlambatCount + perluPerhatianCount;

  const totalBillingAmount = filteredSubmissions.reduce(
    (acc, s) => acc + Number(s.amount ?? 0),
    0
  );

  // ===========================================================================
  // BARIS 2 — 3 TABEL RINGKASAN SEJAJAR
  // ===========================================================================
  const pct = (count: number) =>
    totalCount > 0 ? `${((count / totalCount) * 100).toFixed(1)}%` : "0.0%";

  const summaryFinalStatusRows = [
    {
      label: "Dalam Proses",
      count: dalamProsesOnlyCount,
      percentage: pct(dalamProsesOnlyCount),
    },
    {
      label: "Menunggu Mitra",
      count: menungguMitraCount,
      percentage: pct(menungguMitraCount),
    },
    {
      label: "Selesai",
      count: selesaiCount,
      percentage: pct(selesaiCount),
    },
    {
      label: "Dibatalkan",
      count: dibatalkanCount,
      percentage: pct(dibatalkanCount),
    },
  ];

  const summarySlaStatusRows = [
    {
      label: "Sesuai SLA",
      count: sesuaiSlaCount,
      percentage: pct(sesuaiSlaCount),
    },
    {
      label: "Terlambat",
      count: terlambatCount,
      percentage: pct(terlambatCount),
    },
    {
      label: "Perlu Perhatian",
      count: perluPerhatianCount,
      percentage: pct(perluPerhatianCount),
    },
    {
      label: "Dalam Proses",
      count: slaDalamProsesCount,
      percentage: pct(slaDalamProsesCount),
    },
  ];

  const softcopyPassCount = filteredSubmissions.filter(
    (s) => s.precheck_status === "Pass"
  ).length;
  const hardcopyLengkapCount = filteredSubmissions.filter(
    (s) => s.physical_status === "Lengkap"
  ).length;
  const verifikasiLulusCount = filteredSubmissions.filter(
    (s) => s.verification_status === "Lulus"
  ).length;
  const validasiLulusCount = filteredSubmissions.filter(
    (s) => s.validation_status === "Lulus"
  ).length;

  const summaryStageCheckRows = [
    {
      label: "Softcopy Pass",
      count: softcopyPassCount,
      percentage: pct(softcopyPassCount),
    },
    {
      label: "Hardcopy Lengkap",
      count: hardcopyLengkapCount,
      percentage: pct(hardcopyLengkapCount),
    },
    {
      label: "Verifikasi Lulus",
      count: verifikasiLulusCount,
      percentage: pct(verifikasiLulusCount),
    },
    {
      label: "Validasi Lulus",
      count: validasiLulusCount,
      percentage: pct(validasiLulusCount),
    },
  ];

  // ===========================================================================
  // BARIS 3 & 4 — DATA GRAFIK RECHARTS
  // ===========================================================================
  const barChartData = [
    { status: "Dalam Proses", jumlah: dalamProsesOnlyCount },
    { status: "Menunggu Mitra", jumlah: menungguMitraCount },
    { status: "Selesai", jumlah: selesaiCount },
    { status: "Dibatalkan", jumlah: dibatalkanCount },
  ];

  const pieChartData = [
    {
      name: "Sesuai SLA",
      value: sesuaiSlaCount,
      pctText: pct(sesuaiSlaCount),
    },
    {
      name: "Terlambat",
      value: terlambatCount,
      pctText: pct(terlambatCount),
    },
    {
      name: "Perlu Perhatian",
      value: perluPerhatianCount,
      pctText: pct(perluPerhatianCount),
    },
    {
      name: "Dalam Proses",
      value: slaDalamProsesCount,
      pctText: pct(slaDalamProsesCount),
    },
  ];

  const nonZeroPieData = pieChartData.filter((d) => d.value > 0);

  const monthlyTrendData = React.useMemo(() => {
    const counts = new Array<number>(12).fill(0);
    const values = new Array<number>(12).fill(0);

    for (const s of filteredSubmissions) {
      const { monthIdx } = getWibYearAndMonth(s.received_date);
      counts[monthIdx] += 1;
      values[monthIdx] += Number(s.amount ?? 0);
    }

    return MONTH_SHORT_LABELS.map((month, idx) => ({
      bulan: month,
      jumlah: counts[idx],
      nilai: values[idx],
    }));
  }, [filteredSubmissions]);

  const showDriveWidget =
    userRole === "admin_accelera" || userRole === "super_admin";

  return (
    <div className="space-y-6">
      {/* PAGE GUIDE & HEADER BANNER */}
      <PageGuide
        variant="banner"
        eyebrow="Dashboard Eksekutif"
        title="Dashboard Monitoring Penagihan"
        purpose={`Pusat pemantauan real-time kinerja verifikasi, validasi, nilai akumulasi tagihan, dan kepatuhan SLA 6 Hari Kerja. Menampilkan ${
          selectedYear === "ALL"
            ? `seluruh periode (${totalCount} tagihan)`
            : `tahun ${selectedYear} (${totalCount} tagihan)`
        }.`}
        tip="Gunakan filter periode di kanan atas, lalu buka Tabel Monitoring untuk rincian 23 kolom & export Excel."
        steps={[
          {
            title: "Pilih Periode Tahun",
            description:
              "Filter seluruh grafik & kartu KPI berdasarkan tahun penerimaan tagihan.",
            badge: "Langkah 1",
            status: "active",
          },
          {
            title: "Pantau 5 KPI Utama",
            description:
              "Lihat total tagihan masuk, SPP terbit, antrean berjalan, dan total nilai Rupiah.",
            badge: "Langkah 2",
          },
          {
            title: "Cek Risiko SLA 6 HK",
            description:
              "Identifikasi tagihan berstatus Perlu Perhatian atau Terlambat dari tabel & grafik SLA.",
            badge: "Langkah 3",
          },
          {
            title: "Tindak Lanjut & Export",
            description:
              "Klik Tabel Monitoring untuk menelusuri No. Agenda spesifik atau mengunduh laporan Excel.",
            badge: "Langkah 4",
          },
        ]}
        actions={
          <>
            <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/12 px-3.5 py-2 text-xs">
              <Calendar className="size-4 text-teal-200" />
              <span className="font-semibold text-teal-100">Periode:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="rounded-md bg-white px-2.5 py-1 text-xs font-bold text-[#0B2E5C] outline-none"
                aria-label="Filter Tahun"
              >
                <option value="ALL">Semua Tahun</option>
                {availableYears.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <Link href="/monitoring">
              <Button
                size="default"
                className="gap-2 bg-[#059C95] font-semibold text-white hover:bg-[#04857f]"
              >
                <TableProperties className="size-4" />
                Tabel Monitoring &amp; Export
              </Button>
            </Link>
          </>
        }
      />

      {/* BARIS 1 — 5 KARTU KPI MODERN */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. TOTAL TAGIHAN */}
        <div className="rounded-2xl border border-border border-t-4 border-t-brand-navy bg-card p-5 shadow-xs transition-shadow hover:shadow-sm dark:border-t-sky-400">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Total Tagihan
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand-navy/10 text-brand-navy dark:bg-sky-400/15 dark:text-sky-300">
              <FileCheck2 className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold tracking-tight text-brand-navy tabular-nums dark:text-sky-300">
              {totalCount}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              Total Invoice Masuk
            </p>
          </div>
        </div>

        {/* 2. SELESAI */}
        <div className="rounded-2xl border border-border border-t-4 border-t-emerald-600 bg-card p-5 shadow-xs transition-shadow hover:shadow-sm dark:border-t-emerald-400">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Selesai
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-600/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
              <CheckCircle2 className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold tracking-tight text-emerald-700 tabular-nums dark:text-emerald-400">
              {selesaiCount}
            </span>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              SPP Terbit ({pct(selesaiCount)})
            </p>
          </div>
        </div>

        {/* 3. DALAM PROSES */}
        <div className="rounded-2xl border border-border border-t-4 border-t-brand-teal bg-card p-5 shadow-xs transition-shadow hover:shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Dalam Proses
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand-teal/12 text-brand-teal">
              <Clock className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold tracking-tight text-brand-teal tabular-nums">
              {combinedDalamProsesCount}
            </span>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {dalamProsesOnlyCount} Internal • {menungguMitraCount} Mitra
            </p>
          </div>
        </div>

        {/* 4. TERLAMBAT / PERHATIAN */}
        <div className="rounded-2xl border border-border border-t-4 border-t-amber-600 bg-card p-5 shadow-xs transition-shadow hover:shadow-sm dark:border-t-amber-400">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Terlambat / Perhatian
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-600/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
              <AlertTriangle className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold tracking-tight text-amber-700 tabular-nums dark:text-amber-400">
              {combinedTerlambatPerhatianCount}
            </span>
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {terlambatCount} Terlambat • {perluPerhatianCount} Perhatian
            </p>
          </div>
        </div>

        {/* 5. NILAI */}
        <div className="rounded-2xl border border-border border-t-4 border-t-indigo-600 bg-card p-5 shadow-xs transition-shadow hover:shadow-sm sm:col-span-2 lg:col-span-1 dark:border-t-indigo-400">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
              Nilai Tagihan
            </span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-600/12 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300">
              <Wallet className="size-4.5" />
            </div>
          </div>
          <div className="mt-3">
            <span
              className="block truncate text-lg font-extrabold tracking-tight text-indigo-700 tabular-nums sm:text-xl dark:text-indigo-300"
              title={formatRupiah(totalBillingAmount)}
            >
              {formatRupiah(totalBillingAmount)}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">
              Akumulasi Nilai Tagihan
            </p>
          </div>
        </div>
      </div>

      {/* BARIS 2 — 3 TABEL RINGKASAN SEJAJAR */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Tabel 1: RINGKASAN STATUS AKHIR */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 border-b border-border/80 px-5 py-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-teal/12 text-brand-teal">
              <Layers className="size-4" />
            </div>
            <h2 className="text-xs font-bold tracking-wide text-foreground uppercase">
              Ringkasan Status Akhir
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <th className="px-5 py-2.5">Status Akhir</th>
                <th className="px-5 py-2.5 text-right">Jumlah</th>
                <th className="px-5 py-2.5 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {summaryFinalStatusRows.map((row) => (
                <tr key={row.label} className="hover:bg-accent/40">
                  <td className="px-5 py-3 font-medium text-foreground">
                    {row.label}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-foreground tabular-nums">
                    {row.count}
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">
                    {row.percentage}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/60 font-bold text-foreground">
                <td className="px-5 py-3">Total</td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {totalCount}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {totalCount > 0 ? "100.0%" : "0.0%"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tabel 2: RINGKASAN STATUS SLA */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 border-b border-border/80 px-5 py-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-teal/12 text-brand-teal">
              <Activity className="size-4" />
            </div>
            <h2 className="text-xs font-bold tracking-wide text-foreground uppercase">
              Ringkasan Status SLA
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <th className="px-5 py-2.5">Status SLA</th>
                <th className="px-5 py-2.5 text-right">Jumlah</th>
                <th className="px-5 py-2.5 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {summarySlaStatusRows.map((row) => (
                <tr key={row.label} className="hover:bg-accent/40">
                  <td className="px-5 py-3 font-medium text-foreground">
                    {row.label}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-foreground tabular-nums">
                    {row.count}
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">
                    {row.percentage}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/60 font-bold text-foreground">
                <td className="px-5 py-3">Total</td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {totalCount}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {totalCount > 0 ? "100.0%" : "0.0%"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tabel 3: RINGKASAN TAHAP PEMERIKSAAN */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 border-b border-border/80 px-5 py-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-teal/12 text-brand-teal">
              <ClipboardList className="size-4" />
            </div>
            <h2 className="text-xs font-bold tracking-wide text-foreground uppercase">
              Ringkasan Tahap Pemeriksaan
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/80 bg-muted/50 text-left text-xs font-semibold text-muted-foreground">
                <th className="px-5 py-2.5">Tahap Pemeriksaan</th>
                <th className="px-5 py-2.5 text-right">Lulus / Pass</th>
                <th className="px-5 py-2.5 text-right">Rasio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {summaryStageCheckRows.map((row) => (
                <tr key={row.label} className="hover:bg-accent/40">
                  <td className="px-5 py-3 font-medium text-foreground">
                    {row.label}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-foreground tabular-nums">
                    {row.count}
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground tabular-nums">
                    {row.percentage}
                  </td>
                </tr>
              ))}
              <tr className="bg-muted/60 font-bold text-foreground">
                <td className="px-5 py-3">Basis Tagihan</td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {totalCount}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">
                  Target 6 HK
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* BARIS 3 & 4 — 3 GRAFIK RECHARTS + PANEL PANDUAN */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* KIRI ATAS: Horizontal Bar Chart */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between gap-2 border-b border-border/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-brand-teal/12 text-brand-teal">
                <BarChart3 className="size-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold tracking-wide text-foreground uppercase">
                  Jumlah Invoice per Status Akhir
                </h2>
                <p className="text-xs text-muted-foreground">
                  Distribusi status penyelesaian dokumen tagihan
                </p>
              </div>
            </div>
          </div>
          <div className="h-76 p-5">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barChartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 16, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="var(--border)"
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="status"
                  width={122}
                  tick={{
                    fontSize: 12,
                    fontWeight: 600,
                    fill: "var(--foreground)",
                  }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--accent)", opacity: 0.45 }}
                  content={<ShadcnChartTooltip unitLabel="Invoice" />}
                />
                <Bar dataKey="jumlah" radius={[0, 8, 8, 0]} barSize={28}>
                  {barChartData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={
                        FINAL_STATUS_BAR_COLORS[entry.status] ?? "#059C95"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KANAN ATAS: Donut Chart Komposisi Status SLA */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between gap-2 border-b border-border/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-brand-teal/12 text-brand-teal">
                <PieChartIcon className="size-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold tracking-wide text-foreground uppercase">
                  Komposisi Status SLA
                </h2>
                <p className="text-xs text-muted-foreground">
                  Proporsi kepatuhan terhadap target 6 Hari Kerja
                </p>
              </div>
            </div>
          </div>
          <div className="flex min-h-76 flex-col items-center justify-between gap-4 p-5 sm:flex-row">
            <div className="h-56 w-full sm:w-1/2">
              {nonZeroPieData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Belum ada data tagihan
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={nonZeroPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={82}
                      paddingAngle={2}
                      label={false}
                      labelLine={false}
                    >
                      {nonZeroPieData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={SLA_CHART_COLORS[entry.name] ?? "#059C95"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={<ShadcnChartTooltip unitLabel="Tagihan" />}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="w-full space-y-2.5 sm:w-1/2">
              {pieChartData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-xl border border-border/80 bg-surface-subtle/70 px-3.5 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          SLA_CHART_COLORS[item.name] ?? "#059C95",
                      }}
                    />
                    <span className="font-medium text-foreground">
                      {item.name}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-foreground tabular-nums">
                    {item.value}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({item.pctText})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* KIRI BAWAH: Line Chart Tren Tagihan Diterima per Bulan */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center justify-between gap-2 border-b border-border/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-brand-teal/12 text-brand-teal">
                <TrendingUp className="size-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold tracking-wide text-foreground uppercase">
                  Tren Tagihan Diterima per Bulan (Jan–Des)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Volume penerimaan dokumen penagihan bulanan
                </p>
              </div>
            </div>
          </div>
          <div className="h-76 p-5">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyTrendData}
                margin={{ top: 10, right: 20, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="bulan"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  content={<ShadcnChartTooltip unitLabel="Tagihan Masuk" />}
                />
                <Legend
                  wrapperStyle={{
                    fontSize: "12px",
                    color: "var(--muted-foreground)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="jumlah"
                  name="Jumlah Tagihan Diterima"
                  stroke="var(--brand-teal)"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: "var(--brand-teal)",
                    strokeWidth: 2,
                    stroke: "var(--card)",
                  }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KANAN BAWAH: Panel CARA MEMBACA DASHBOARD */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
          <div className="flex items-center gap-3 border-b border-border/80 px-5 py-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-teal/12 text-brand-teal">
              <BookOpen className="size-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold tracking-wide text-foreground uppercase">
                Cara Membaca Dashboard
              </h2>
              <p className="text-xs text-muted-foreground">
                Panduan aturan SLA 6 Hari Kerja &amp; interpretasi metrik
              </p>
            </div>
          </div>
          <div className="space-y-3 p-5 text-sm leading-relaxed">
            <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-surface-subtle/70 p-3.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white tabular-nums dark:bg-sky-500">
                1
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                <strong className="text-foreground">
                  Target SLA Internal 6 Hari Kerja:
                </strong>{" "}
                Meliputi Pre-Check Softcopy (1 HK), Cek Fisik Hardcopy (1 HK),
                Approval PIC Usaha (1 HK), Validasi Akuntansi (2 HK), dan
                Penerbitan SPP (1 HK), memotong Sabtu, Minggu, serta Hari Libur
                Nasional.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-surface-subtle/70 p-3.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-brand-teal-foreground tabular-nums">
                2
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                <strong className="text-foreground">
                  Mekanisme Auto-Pause SLA:
                </strong>{" "}
                Argo hari kerja otomatis berhenti sementara (<em>PAUSE</em>)
                ketika status <code>Menunggu Mitra</code> (menunggu pengiriman
                dokumen fisik atau perbaikan revisi oleh vendor).
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-surface-subtle/70 p-3.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white tabular-nums">
                3
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                <strong className="text-foreground">
                  Status Sesuai SLA vs Dalam Proses:
                </strong>{" "}
                Tagihan yang telah terbit SPP dengan durasi &le; 6 HK
                diklasifikasikan{" "}
                <strong className="text-foreground">Sesuai SLA</strong>,
                sedangkan tagihan aktif &lt; 4.5 HK berstatus{" "}
                <strong className="text-foreground">Dalam Proses</strong>.
              </p>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-surface-subtle/70 p-3.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-600 text-xs font-bold text-white tabular-nums">
                4
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                <strong className="text-foreground">
                  Indikator Perlu Perhatian &amp; Terlambat:
                </strong>{" "}
                Tagihan aktif yang memasuki hari kerja ke-5 (&ge; 4.5 HK) atau
                sisa kuota tahap aktif &le; 25% ditandai{" "}
                <strong className="text-foreground">Perlu Perhatian</strong>;
                jika melebihi 6 HK menjadi{" "}
                <strong className="text-foreground">Terlambat</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* WIDGET MONITOR KUOTA GOOGLE DRIVE */}
      {showDriveWidget && (
        <div
          className={cn(
            "overflow-hidden rounded-2xl border bg-card shadow-xs",
            driveQuota?.isWarning ? "border-amber-500/60" : "border-border"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-brand-teal/12 text-brand-teal">
                <HardDrive className="size-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold tracking-wide text-foreground uppercase">
                  Monitoring Kapasitas Penyimpanan Google Drive
                </h2>
                <p className="text-xs text-muted-foreground">
                  Pemantauan ruang arsip dokumen softcopy &amp; PDF SPP
                </p>
              </div>
            </div>
            {driveQuota?.userEmail && (
              <Badge variant="secondary" className="font-mono text-xs">
                Akun Arsip: {driveQuota.userEmail}
              </Badge>
            )}
          </div>

          <div className="p-5">
            {driveQuotaError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2.5">
                  <Info className="size-4 shrink-0" />
                  <span>
                    Status Kuota Google Drive belum dapat dimuat:{" "}
                    {driveQuotaError}
                  </span>
                </div>
                <Badge variant="outline">OAuth Drive</Badge>
              </div>
            ) : driveQuota ? (
              <div className="space-y-4">
                {driveQuota.isWarning && (
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-xl border p-4 text-sm",
                      driveQuota.isCritical
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                    )}
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-bold">
                        {driveQuota.isCritical
                          ? "PERINGATAN KRITIS: Kapasitas Google Drive Hampir Penuh (>= 95%)!"
                          : "PERINGATAN KAPASITAS: Pemakaian Google Drive Telah Mencapai >= 80%!"}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed tabular-nums">
                        Pemakaian saat ini adalah{" "}
                        <strong>{driveQuota.usagePercent}%</strong> (
                        {formatBytes(driveQuota.usageBytes)} dari{" "}
                        {driveQuota.limitBytes
                          ? formatBytes(driveQuota.limitBytes)
                          : "Unlimited"}
                        ). Segera kosongkan Trash atau siapkan rotasi akun arsip
                        Google Drive.
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid gap-3.5 sm:grid-cols-4">
                  <div className="rounded-xl border border-border/80 bg-surface-subtle/70 p-4">
                    <p className="text-xs text-muted-foreground">
                      Total Kapasitas Akun
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-primary tabular-nums">
                      {driveQuota.limitBytes !== null
                        ? formatBytes(driveQuota.limitBytes)
                        : "Tanpa Batas"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-surface-subtle/70 p-4">
                    <p className="text-xs text-muted-foreground">
                      Total Terpakai
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-foreground tabular-nums">
                      {formatBytes(driveQuota.usageBytes)}{" "}
                      <span className="text-xs font-semibold text-muted-foreground">
                        ({driveQuota.usagePercent}%)
                      </span>
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-surface-subtle/70 p-4">
                    <p className="text-xs text-muted-foreground">
                      Sisa Kapasitas Tersedia
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
                      {driveQuota.remainingBytes !== null
                        ? formatBytes(driveQuota.remainingBytes)
                        : "Tersedia"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border/80 bg-surface-subtle/70 p-4">
                    <p className="text-xs text-muted-foreground">
                      File di Drive / Trash
                    </p>
                    <p className="mt-1 text-sm font-bold text-foreground tabular-nums">
                      Drive: {formatBytes(driveQuota.usageInDriveBytes)} •
                      Trash: {formatBytes(driveQuota.usageInTrashBytes)}
                    </p>
                  </div>
                </div>

                {driveQuota.hasLimit && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-semibold text-foreground">
                        {driveQuota.isWarning ? (
                          <AlertTriangle className="size-4 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                        Status Kapasitas:{" "}
                        {driveQuota.isCritical
                          ? "Kritis (>= 95%)"
                          : driveQuota.isWarning
                          ? "Perlu Perhatian (>= 80%)"
                          : "Aman (< 80%)"}
                      </span>
                      <span className="font-bold text-foreground tabular-nums">
                        {formatBytes(driveQuota.usageBytes)} /{" "}
                        {driveQuota.limitBytes !== null
                          ? formatBytes(driveQuota.limitBytes)
                          : "-"}
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          driveQuota.isCritical
                            ? "bg-destructive"
                            : driveQuota.isWarning
                            ? "bg-amber-500"
                            : "bg-brand-teal"
                        )}
                        style={{
                          width: `${Math.min(100, Math.max(1, driveQuota.usagePercent))}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* TAUTAN CEPAT KE TABEL MONITORING */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">
            Ingin memeriksa rincian lengkap atau mengunduh laporan Excel
            (.xlsx)?
          </p>
          <p className="text-sm text-muted-foreground">
            Buka Tabel Monitoring untuk filter rentang tanggal, vendor, status
            akhir, status SLA, dan export Excel 23 kolom.
          </p>
        </div>
        <Link href="/monitoring">
          <Button size="lg" className="gap-2">
            Buka Tabel Monitoring
            <ExternalLink className="size-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  HardDrive,
  Info,
  TableProperties,
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
  "Sesuai SLA": "#548235",
  Terlambat: "#C00000",
  "Perlu Perhatian": "#C55A11",
  "Dalam Proses": "#1F6F78",
};

const FINAL_STATUS_BAR_COLORS: Record<string, string> = {
  "Dalam Proses": "#1F6F78",
  "Menunggu Mitra": "#C55A11",
  Selesai: "#548235",
  Dibatalkan: "#7F7F7F",
};

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

  // Kartu 3: DALAM PROSES (gabungan dalam_proses + menunggu_mitra)
  const combinedDalamProsesCount = dalamProsesOnlyCount + menungguMitraCount;

  // Ringkasan Status SLA
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

  // Kartu 4: TERLAMBAT / PERHATIAN (gabungan SLA Terlambat + Perlu Perhatian)
  const combinedTerlambatPerhatianCount = terlambatCount + perluPerhatianCount;

  // Kartu 5: NILAI (SUM(billing_amount))
  const totalBillingAmount = filteredSubmissions.reduce(
    (acc, s) => acc + Number(s.amount ?? 0),
    0
  );

  // ===========================================================================
  // BARIS 2 — 3 TABEL RINGKASAN SEJAJAR
  // ===========================================================================
  const pct = (count: number) =>
    totalCount > 0 ? `${((count / totalCount) * 100).toFixed(1)}%` : "0.0%";

  // 1. RINGKASAN STATUS AKHIR
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

  // 2. RINGKASAN STATUS SLA
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

  // 3. RINGKASAN TAHAP PEMERIKSAAN
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
  // 1. Horizontal Bar Chart: Jumlah Invoice per Status Akhir
  const barChartData = [
    { status: "Dalam Proses", jumlah: dalamProsesOnlyCount },
    { status: "Menunggu Mitra", jumlah: menungguMitraCount },
    { status: "Selesai", jumlah: selesaiCount },
    { status: "Dibatalkan", jumlah: dibatalkanCount },
  ];

  // 2. Pie/Donut Chart: Komposisi Status SLA
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

  // 3. Line Chart: Tren Tagihan Diterima per Bulan (Jan s.d. Des)
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
    <div className="space-y-5">
      {/* =====================================================================
          HEADER BANNER NAVY BLUE (#1F4E78)
      ====================================================================== */}
      <div className="rounded-xl bg-[#1F4E78] px-5 py-4 text-white shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-extrabold tracking-wide uppercase sm:text-xl">
              DASHBOARD MONITORING PENAGIHAN
            </h1>
            <p className="mt-0.5 text-xs text-slate-200">
              Ringkasan Real-Time Verifikasi, Validasi &amp; Kepatuhan SLA 6
              Hari Kerja •{" "}
              {selectedYear === "ALL"
                ? `Seluruh Periode (${totalCount} Tagihan)`
                : `Tahun ${selectedYear} (${totalCount} Tagihan)`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs">
              <Calendar className="size-3.5 text-sky-200" />
              <span className="font-medium text-sky-100">Filter Tahun:</span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="rounded bg-white px-2 py-0.5 text-xs font-bold text-[#1F4E78] outline-none"
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
                size="sm"
                variant="secondary"
                className="gap-1.5 bg-white text-xs font-bold text-[#1F4E78] hover:bg-slate-100"
              >
                <TableProperties className="size-3.5" />
                Tabel 23 Kolom &amp; Export Excel
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* =====================================================================
          BARIS 1 — 5 KARTU KPI UTAMA (GRID 5 KOLOM SESUAI WARNA EXCEL KLIEN)
      ====================================================================== */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        {/* 1. TOTAL TAGIHAN (Header Navy #1F4E78) */}
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xs">
          <div className="bg-[#1F4E78] px-3.5 py-2 text-center text-xs font-bold tracking-wider text-white uppercase">
            TOTAL TAGIHAN
          </div>
          <div className="flex flex-col items-center justify-center px-3 py-4 text-center">
            <span className="text-3xl font-extrabold text-[#1F4E78]">
              {totalCount}
            </span>
            <span className="mt-1 text-[11px] text-muted-foreground">
              Total Invoice Masuk
            </span>
          </div>
        </div>

        {/* 2. SELESAI (Header Hijau #548235) */}
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xs">
          <div className="bg-[#548235] px-3.5 py-2 text-center text-xs font-bold tracking-wider text-white uppercase">
            SELESAI
          </div>
          <div className="flex flex-col items-center justify-center px-3 py-4 text-center">
            <span className="text-3xl font-extrabold text-[#548235]">
              {selesaiCount}
            </span>
            <span className="mt-1 text-[11px] text-muted-foreground">
              SPP Terbit ({pct(selesaiCount)})
            </span>
          </div>
        </div>

        {/* 3. DALAM PROSES (Header Teal #1F6F78 — gabungan dalam_proses + menunggu_mitra) */}
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xs">
          <div className="bg-[#1F6F78] px-3.5 py-2 text-center text-xs font-bold tracking-wider text-white uppercase">
            DALAM PROSES
          </div>
          <div className="flex flex-col items-center justify-center px-3 py-4 text-center">
            <span className="text-3xl font-extrabold text-[#1F6F78]">
              {combinedDalamProsesCount}
            </span>
            <span className="mt-1 text-[11px] text-muted-foreground">
              {dalamProsesOnlyCount} Internal • {menungguMitraCount} Mitra
            </span>
          </div>
        </div>

        {/* 4. TERLAMBAT / PERHATIAN (Header Oranye #C55A11 — gabungan SLA Terlambat + Perlu Perhatian) */}
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xs">
          <div className="bg-[#C55A11] px-3.5 py-2 text-center text-xs font-bold tracking-wider text-white uppercase">
            TERLAMBAT / PERHATIAN
          </div>
          <div className="flex flex-col items-center justify-center px-3 py-4 text-center">
            <span className="text-3xl font-extrabold text-[#C55A11]">
              {combinedTerlambatPerhatianCount}
            </span>
            <span className="mt-1 text-[11px] text-muted-foreground">
              {terlambatCount} Terlambat • {perluPerhatianCount} Perhatian
            </span>
          </div>
        </div>

        {/* 5. NILAI (Header Ungu #7030A0 — SUM(billing_amount) format Rp xxx.xxx.xxx) */}
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xs sm:col-span-2 lg:col-span-1">
          <div className="bg-[#7030A0] px-3.5 py-2 text-center text-xs font-bold tracking-wider text-white uppercase">
            NILAI
          </div>
          <div className="flex flex-col items-center justify-center px-3 py-4 text-center">
            <span className="truncate font-mono text-base font-extrabold text-[#7030A0] sm:text-lg">
              {formatRupiah(totalBillingAmount)}
            </span>
            <span className="mt-1 text-[11px] text-muted-foreground">
              Akumulasi Nilai Tagihan
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          BARIS 2 — 3 TABEL RINGKASAN SEJAJAR (HEADER NAVY #1F4E78)
      ====================================================================== */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Tabel 1: RINGKASAN STATUS AKHIR */}
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xs">
          <div className="bg-[#1F4E78] px-4 py-2.5 text-xs font-bold tracking-wider text-white uppercase">
            RINGKASAN STATUS AKHIR
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-slate-100 text-left font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <th className="px-3.5 py-2">Status Akhir</th>
                <th className="px-3.5 py-2 text-right">Jumlah</th>
                <th className="px-3.5 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summaryFinalStatusRows.map((row) => (
                <tr key={row.label} className="hover:bg-muted/40">
                  <td className="px-3.5 py-2 font-medium">{row.label}</td>
                  <td className="px-3.5 py-2 text-right font-mono font-bold">
                    {row.count}
                  </td>
                  <td className="px-3.5 py-2 text-right font-mono text-muted-foreground">
                    {row.percentage}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold dark:bg-slate-900">
                <td className="px-3.5 py-2">Total</td>
                <td className="px-3.5 py-2 text-right font-mono">
                  {totalCount}
                </td>
                <td className="px-3.5 py-2 text-right font-mono">
                  {totalCount > 0 ? "100.0%" : "0.0%"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tabel 2: RINGKASAN STATUS SLA */}
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xs">
          <div className="bg-[#1F4E78] px-4 py-2.5 text-xs font-bold tracking-wider text-white uppercase">
            RINGKASAN STATUS SLA
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-slate-100 text-left font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <th className="px-3.5 py-2">Status SLA</th>
                <th className="px-3.5 py-2 text-right">Jumlah</th>
                <th className="px-3.5 py-2 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summarySlaStatusRows.map((row) => (
                <tr key={row.label} className="hover:bg-muted/40">
                  <td className="px-3.5 py-2 font-medium">{row.label}</td>
                  <td className="px-3.5 py-2 text-right font-mono font-bold">
                    {row.count}
                  </td>
                  <td className="px-3.5 py-2 text-right font-mono text-muted-foreground">
                    {row.percentage}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold dark:bg-slate-900">
                <td className="px-3.5 py-2">Total</td>
                <td className="px-3.5 py-2 text-right font-mono">
                  {totalCount}
                </td>
                <td className="px-3.5 py-2 text-right font-mono">
                  {totalCount > 0 ? "100.0%" : "0.0%"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Tabel 3: RINGKASAN TAHAP PEMERIKSAAN */}
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xs">
          <div className="bg-[#1F4E78] px-4 py-2.5 text-xs font-bold tracking-wider text-white uppercase">
            RINGKASAN TAHAP PEMERIKSAAN
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-slate-100 text-left font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <th className="px-3.5 py-2">Tahap Pemeriksaan</th>
                <th className="px-3.5 py-2 text-right">Lulus / Pass</th>
                <th className="px-3.5 py-2 text-right">Rasio</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summaryStageCheckRows.map((row) => (
                <tr key={row.label} className="hover:bg-muted/40">
                  <td className="px-3.5 py-2 font-medium">{row.label}</td>
                  <td className="px-3.5 py-2 text-right font-mono font-bold">
                    {row.count}
                  </td>
                  <td className="px-3.5 py-2 text-right font-mono text-muted-foreground">
                    {row.percentage}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold dark:bg-slate-900">
                <td className="px-3.5 py-2">Basis Tagihan</td>
                <td className="px-3.5 py-2 text-right font-mono">
                  {totalCount}
                </td>
                <td className="px-3.5 py-2 text-right font-mono">Target 6 HK</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          BARIS 3 & 4 — 3 GRAFIK RECHARTS + PANEL PANDUAN (GRID 2 KOLOM)
      ====================================================================== */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* KIRI ATAS: Horizontal Bar Chart (Jumlah Invoice per Status Akhir) */}
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xs">
          <div className="bg-[#1F4E78] px-4 py-2.5 text-xs font-bold tracking-wider text-white uppercase">
            JUMLAH INVOICE PER STATUS AKHIR
          </div>
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barChartData}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 16, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="category"
                  dataKey="status"
                  width={110}
                  tick={{ fontSize: 11, fontWeight: 600 }}
                />
                <Tooltip
                  formatter={(val) => [`${String(val)} Invoice`, "Jumlah"]}
                  contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                />
                <Bar dataKey="jumlah" radius={[0, 6, 6, 0]} barSize={28}>
                  {barChartData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={
                        FINAL_STATUS_BAR_COLORS[entry.status] ?? "#1F4E78"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KANAN ATAS: Pie/Donut Chart (Komposisi Status SLA dengan legend & persentase rapi tanpa label bertumpuk) */}
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xs">
          <div className="bg-[#1F4E78] px-4 py-2.5 text-xs font-bold tracking-wider text-white uppercase">
            KOMPOSISI STATUS SLA
          </div>
          <div className="flex h-72 flex-col items-center justify-between gap-4 p-4 sm:flex-row">
            <div className="h-52 w-full sm:w-1/2">
              {nonZeroPieData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
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
                      innerRadius={45}
                      outerRadius={76}
                      paddingAngle={2}
                      label={false}
                      labelLine={false}
                    >
                      {nonZeroPieData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={SLA_CHART_COLORS[entry.name] ?? "#1F4E78"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [
                        `${String(val)} Tagihan`,
                        String(name),
                      ]}
                      contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Custom Legend Rapi dengan Jumlah & Persentase */}
            <div className="w-full space-y-2 sm:w-1/2">
              {pieChartData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between rounded-lg border bg-muted/25 px-3 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-xs"
                      style={{
                        backgroundColor:
                          SLA_CHART_COLORS[item.name] ?? "#1F4E78",
                      }}
                    />
                    <span className="font-medium">{item.name}</span>
                  </div>
                  <div className="font-mono text-xs font-bold">
                    {item.value}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({item.pctText})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* KIRI BAWAH: Line Chart (Tren Tagihan Diterima per Bulan dari Jan s.d. Des) */}
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xs">
          <div className="bg-[#1F4E78] px-4 py-2.5 text-xs font-bold tracking-wider text-white uppercase">
            TREN TAGIHAN DITERIMA PER BULAN (JAN S.D. DES)
          </div>
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyTrendData}
                margin={{ top: 10, right: 20, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val) => [`${String(val)} Tagihan`, "Tagihan Masuk"]}
                  contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Line
                  type="monotone"
                  dataKey="jumlah"
                  name="Jumlah Tagihan Diterima"
                  stroke="#1F4E78"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "#1F4E78" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* KANAN BAWAH: Panel CARA MEMBACA DASHBOARD (header Navy #1F4E78, 5 poin ringkasan metrik) */}
        <div className="overflow-hidden rounded-xl border bg-background shadow-2xs">
          <div className="bg-[#1F4E78] px-4 py-2.5 text-xs font-bold tracking-wider text-white uppercase">
            CARA MEMBACA DASHBOARD
          </div>
          <div className="space-y-2.5 p-4 text-xs leading-relaxed">
            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/20 p-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1F4E78] text-[11px] font-bold text-white">
                1
              </span>
              <p>
                <strong>Target SLA Internal 6 Hari Kerja:</strong> Meliputi
                Pre-Check Softcopy (1 HK), Cek Fisik Hardcopy (1 HK), Approval
                PIC Usaha (1 HK), Validasi Akuntansi (2 HK), dan Penerbitan SPP
                (1 HK), memotong Sabtu, Minggu, serta Hari Libur Nasional.
              </p>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/20 p-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#1F6F78] text-[11px] font-bold text-white">
                2
              </span>
              <p>
                <strong>Mekanisme Auto-Pause SLA:</strong> Argo hari kerja
                otomatis berhenti sementara (<em>PAUSE</em>) ketika status{" "}
                <code>Menunggu Mitra</code> (menunggu pengiriman dokumen fisik
                atau perbaikan revisi oleh vendor).
              </p>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/20 p-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#548235] text-[11px] font-bold text-white">
                3
              </span>
              <p>
                <strong>Status Sesuai SLA vs Dalam Proses:</strong> Tagihan yang
                telah terbit SPP dengan durasi &le; 6 HK diklasifikasikan{" "}
                <strong>Sesuai SLA</strong>, sedangkan tagihan aktif &lt; 4.5 HK
                berstatus <strong>Dalam Proses</strong>.
              </p>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/20 p-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#C55A11] text-[11px] font-bold text-white">
                4
              </span>
              <p>
                <strong>Indikator Perlu Perhatian &amp; Terlambat:</strong>{" "}
                Tagihan aktif yang memasuki hari kerja ke-5 (&ge; 4.5 HK) atau
                sisa kuota tahap aktif &le; 25% ditandai{" "}
                <strong>Perlu Perhatian</strong>; jika melebihi 6 HK menjadi{" "}
                <strong>Terlambat</strong>.
              </p>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/20 p-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#7030A0] text-[11px] font-bold text-white">
                5
              </span>
              <p>
                <strong>Tahap Pemeriksaan &amp; Nilai Tagihan:</strong> Tabel
                ringkasan menampilkan progres kelulusan tiap gerbang
                verifikasi serta total akumulasi nilai Rupiah seluruh invoice
                pada periode terpilih.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          WIDGET MONITOR KUOTA GOOGLE DRIVE (KHUSUS ADMIN ACCELERA & SUPER ADMIN)
          Membaca batas kapasitas secara dinamis dari `storageQuota.limit`
      ====================================================================== */}
      {showDriveWidget && (
        <div
          className={cn(
            "overflow-hidden rounded-xl border bg-background shadow-2xs",
            driveQuota?.isWarning
              ? "border-amber-500/60"
              : "border-border"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#1F4E78] px-4 py-2.5 text-white">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider uppercase">
              <HardDrive className="size-4 text-sky-200" />
              <span>
                MONITORING KAPASITAS PENYIMPANAN GOOGLE DRIVE ARSIP DOKUMEN
              </span>
            </div>
            {driveQuota?.userEmail && (
              <span className="rounded bg-white/15 px-2.5 py-0.5 font-mono text-[11px] text-sky-100">
                Akun Arsip: {driveQuota.userEmail}
              </span>
            )}
          </div>

          <div className="p-4">
            {driveQuotaError ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <Info className="size-4 shrink-0" />
                  <span>
                    Status Kuota Google Drive belum dapat dimuat:{" "}
                    {driveQuotaError}
                  </span>
                </div>
                <Badge variant="outline">OAuth Drive</Badge>
              </div>
            ) : driveQuota ? (
              <div className="space-y-3">
                {/* Peringatan Visual Otomatis jika pemakaian >= 80% */}
                {driveQuota.isWarning && (
                  <div
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-3 text-xs",
                      driveQuota.isCritical
                        ? "border-destructive/50 bg-destructive/10 text-destructive"
                        : "border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-200"
                    )}
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-bold">
                        {driveQuota.isCritical
                          ? "PERINGATAN KRITIS: Kapasitas Google Drive Hampir Penuh (>= 95%)!"
                          : "PERINGATAN KAPASITAS: Pemakaian Google Drive Telah Mencapai >= 80%!"}
                      </p>
                      <p className="mt-0.5">
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

                <div className="grid gap-4 sm:grid-cols-4">
                  <div className="rounded-lg border bg-muted/25 p-3">
                    <p className="text-[11px] text-muted-foreground">
                      Total Kapasitas Akun (Dinamis)
                    </p>
                    <p className="mt-0.5 font-mono text-base font-extrabold text-[#1F4E78]">
                      {driveQuota.limitBytes !== null
                        ? formatBytes(driveQuota.limitBytes)
                        : "Tanpa Batas"}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/25 p-3">
                    <p className="text-[11px] text-muted-foreground">
                      Total Terpakai
                    </p>
                    <p className="mt-0.5 font-mono text-base font-extrabold">
                      {formatBytes(driveQuota.usageBytes)}{" "}
                      <span className="text-xs font-semibold text-muted-foreground">
                        ({driveQuota.usagePercent}%)
                      </span>
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/25 p-3">
                    <p className="text-[11px] text-muted-foreground">
                      Sisa Kapasitas Tersedia
                    </p>
                    <p className="mt-0.5 font-mono text-base font-extrabold text-[#548235]">
                      {driveQuota.remainingBytes !== null
                        ? formatBytes(driveQuota.remainingBytes)
                        : "Tersedia"}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/25 p-3">
                    <p className="text-[11px] text-muted-foreground">
                      File di Drive / Trash
                    </p>
                    <p className="mt-0.5 font-mono text-xs font-bold">
                      Drive: {formatBytes(driveQuota.usageInDriveBytes)} •
                      Trash: {formatBytes(driveQuota.usageInTrashBytes)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar Visual */}
                {driveQuota.hasLimit && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium">
                        {driveQuota.isWarning ? (
                          <AlertTriangle className="size-3.5 text-amber-600" />
                        ) : (
                          <CheckCircle2 className="size-3.5 text-[#548235]" />
                        )}
                        Status Kapasitas:{" "}
                        {driveQuota.isCritical
                          ? "Kritis (>= 95%)"
                          : driveQuota.isWarning
                          ? "Perlu Perhatian (>= 80%)"
                          : "Aman (< 80%)"}
                      </span>
                      <span className="font-mono font-bold">
                        {formatBytes(driveQuota.usageBytes)} /{" "}
                        {driveQuota.limitBytes !== null
                          ? formatBytes(driveQuota.limitBytes)
                          : "-"}
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          driveQuota.isCritical
                            ? "bg-destructive"
                            : driveQuota.isWarning
                            ? "bg-[#C55A11]"
                            : "bg-[#548235]"
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

      {/* TAUTAN CEPAT KE TABEL MONITORING 23 KOLOM */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4 shadow-2xs">
        <div className="text-xs">
          <p className="font-bold text-foreground">
            Ingin memeriksa rincian 23 kolom lengkap atau mengunduh laporan
            Excel (.xlsx)?
          </p>
          <p className="text-muted-foreground">
            Buka Tabel Monitoring 23 Kolom untuk filter rentang tanggal, vendor,
            status akhir, status SLA, dan export Excel berformat klien.
          </p>
        </div>
        <Link href="/monitoring">
          <Button className="gap-1.5 bg-[#1F4E78] text-white hover:bg-[#163a5a]">
            Buka Tabel Monitoring 23 Kolom
            <ExternalLink className="size-3.5" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

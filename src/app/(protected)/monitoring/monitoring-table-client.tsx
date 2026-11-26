"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Filter,
  LayoutDashboard,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BillingSubmission,
  FinalStatus,
  SlaStatus,
  UserRole,
  Vendor,
} from "@/types";
import {
  formatDateWIB,
  formatRupiah,
  getFinalStatusBadgeClass,
  getSlaStatusBadgeClass,
} from "@/lib/constants";
import { getSubmissionDetailHrefForRole } from "@/lib/notifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface MonitoringSubmissionRow extends BillingSubmission {
  vendor_name: string;
}

interface MonitoringTableClientProps {
  submissions: MonitoringSubmissionRow[];
  vendors: Array<Pick<Vendor, "id" | "name" | "is_active">>;
  userRole: UserRole;
}

/**
 * 23 Kolom Standar Klien:
 * 1. No
 * 2. Tanggal Terima
 * 3. No. Agenda
 * 4. Nama Mitra/Vendor
 * 5. No. Invoice
 * 6. Jenis Pekerjaan/Tagihan
 * 7. Nilai Tagihan (Rp)
 * 8. Tanggal Softcopy
 * 9. Status Pre-check
 * 10. Tanggal Hardcopy
 * 11. Status Kelengkapan Fisik
 * 12. Status Verifikasi
 * 13. Status Validasi
 * 14. Temuan / Kekurangan
 * 15. Tindak Lanjut
 * 16. PIC Tindak Lanjut
 * 17. Target Selesai
 * 18. Tanggal Selesai
 * 19. Status Akhir
 * 20. SLA (Hari Kerja)
 * 21. Durasi Aktual (Hari Kerja)
 * 22. Status SLA
 * 23. Catatan
 */
export const CLIENT_23_COLUMNS = [
  "No",
  "Tanggal Terima",
  "No. Agenda",
  "Nama Mitra/Vendor",
  "No. Invoice",
  "Jenis Pekerjaan/Tagihan",
  "Nilai Tagihan (Rp)",
  "Tanggal Softcopy",
  "Status Pre-check",
  "Tanggal Hardcopy",
  "Status Kelengkapan Fisik",
  "Status Verifikasi",
  "Status Validasi",
  "Temuan / Kekurangan",
  "Tindak Lanjut",
  "PIC Tindak Lanjut",
  "Target Selesai",
  "Tanggal Selesai",
  "Status Akhir",
  "SLA (Hari Kerja)",
  "Durasi Aktual (Hari Kerja)",
  "Status SLA",
  "Catatan",
] as const;

function toWibIsoDate(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

export function MonitoringTableClient({
  submissions,
  vendors,
  userRole,
}: MonitoringTableClientProps) {
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [vendorFilter, setVendorFilter] = React.useState("ALL");
  const [finalStatusFilter, setFinalStatusFilter] = React.useState("ALL");
  const [slaStatusFilter, setSlaStatusFilter] = React.useState("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [exporting, setExporting] = React.useState(false);

  const filteredRows = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return submissions.filter((row) => {
      const receivedWibDate = toWibIsoDate(row.received_date);

      if (dateFrom && receivedWibDate && receivedWibDate < dateFrom) {
        return false;
      }
      if (dateTo && receivedWibDate && receivedWibDate > dateTo) {
        return false;
      }
      if (vendorFilter !== "ALL" && row.vendor_id !== vendorFilter) {
        return false;
      }
      if (
        finalStatusFilter !== "ALL" &&
        row.final_status !== (finalStatusFilter as FinalStatus)
      ) {
        return false;
      }
      if (
        slaStatusFilter !== "ALL" &&
        row.sla_status !== (slaStatusFilter as SlaStatus)
      ) {
        return false;
      }

      if (!q) return true;

      return (
        row.agenda_no.toLowerCase().includes(q) ||
        row.vendor_name.toLowerCase().includes(q) ||
        row.invoice_no.toLowerCase().includes(q) ||
        row.work_type.toLowerCase().includes(q) ||
        (row.findings ?? "").toLowerCase().includes(q) ||
        (row.followup_pic ?? "").toLowerCase().includes(q) ||
        (row.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [
    submissions,
    dateFrom,
    dateTo,
    vendorFilter,
    finalStatusFilter,
    slaStatusFilter,
    searchQuery,
  ]);

  const totalFilteredAmount = React.useMemo(
    () => filteredRows.reduce((acc, r) => acc + Number(r.amount ?? 0), 0),
    [filteredRows]
  );

  function resetFilters() {
    setDateFrom("");
    setDateTo("");
    setVendorFilter("ALL");
    setFinalStatusFilter("ALL");
    setSlaStatusFilter("ALL");
    setSearchQuery("");
  }

  /**
   * Export Excel (.xlsx) menggunakan `exceljs` dengan format rapi:
   * - Header warna Navy (#1F4E78) teks putih tebal
   * - 23 kolom standar klien lengkap
   * - Format angka Rupiah (`"Rp"#,##0`)
   * - Warna badge sel Status SLA & Status Akhir
   */
  async function handleExportExcel() {
    if (filteredRows.length === 0) {
      toast.error("Tidak ada baris data untuk diekspor.");
      return;
    }

    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Accelera HUB";
      workbook.created = new Date();

      const sheet = workbook.addWorksheet("Monitoring Penagihan (23 Kolom)", {
        views: [{ state: "frozen", xSplit: 3, ySplit: 3 }],
      });

      // Baris 1: Judul Utama Banner Navy
      sheet.mergeCells(1, 1, 1, 23);
      const titleCell = sheet.getCell(1, 1);
      titleCell.value =
        "LAPORAN MONITORING VERIFIKASI, VALIDASI & SLA DOKUMEN PENAGIHAN (23 KOLOM STANDAR)";
      titleCell.font = {
        name: "Calibri",
        size: 13,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      titleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1F4E78" },
      };
      titleCell.alignment = { vertical: "middle", horizontal: "left" };
      sheet.getRow(1).height = 28;

      // Baris 2: Subjudul Metadata Filter & Total Nilai
      sheet.mergeCells(2, 1, 2, 23);
      const subTitleCell = sheet.getCell(2, 1);
      const nowWibStr = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date());
      subTitleCell.value = `Diekspor pada: ${nowWibStr} WIB  |  Jumlah Data: ${filteredRows.length} Tagihan  |  Total Nilai: ${formatRupiah(totalFilteredAmount)}`;
      subTitleCell.font = {
        name: "Calibri",
        size: 10,
        italic: true,
        color: { argb: "FF1E293B" },
      };
      subTitleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
      subTitleCell.alignment = { vertical: "middle", horizontal: "left" };
      sheet.getRow(2).height = 20;

      // Baris 3: Header 23 Kolom Standar
      const headerRow = sheet.getRow(3);
      headerRow.values = [...CLIENT_23_COLUMNS];
      headerRow.height = 26;

      headerRow.eachCell((cell) => {
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF1F4E78" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });

      // Isi Data Baris ke-4 dst.
      filteredRows.forEach((item, index) => {
        const rowNumber = index + 4;
        const row = sheet.getRow(rowNumber);

        row.values = [
          index + 1, // 1. No
          formatDateWIB(item.received_date), // 2. Tanggal Terima
          item.agenda_no, // 3. No. Agenda
          item.vendor_name, // 4. Nama Mitra/Vendor
          item.invoice_no, // 5. No. Invoice
          item.work_type, // 6. Jenis Pekerjaan/Tagihan
          Number(item.amount ?? 0), // 7. Nilai Tagihan (Rp)
          formatDateWIB(item.softcopy_date), // 8. Tanggal Softcopy
          item.precheck_status, // 9. Status Pre-check
          formatDateWIB(item.hardcopy_date), // 10. Tanggal Hardcopy
          item.physical_status, // 11. Status Kelengkapan Fisik
          item.verification_status, // 12. Status Verifikasi
          item.validation_status, // 13. Status Validasi
          item.findings || "-", // 14. Temuan / Kekurangan
          item.followup_action, // 15. Tindak Lanjut
          item.followup_pic || "-", // 16. PIC Tindak Lanjut
          item.target_finish_date ? formatDateWIB(item.target_finish_date) : "-", // 17. Target Selesai
          formatDateWIB(item.completed_date), // 18. Tanggal Selesai
          item.final_status, // 19. Status Akhir
          Number(item.sla_target_days ?? 6), // 20. SLA (Hari Kerja)
          Number(item.actual_working_days ?? 0), // 21. Durasi Aktual (Hari Kerja)
          item.sla_status, // 22. Status SLA
          item.notes || "-", // 23. Catatan
        ];

        row.height = 22;

        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: "Calibri", size: 10 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          if (colNumber === 1 || colNumber === 20 || colNumber === 21) {
            cell.alignment = { vertical: "middle", horizontal: "center" };
          } else if (colNumber === 7) {
            cell.numFmt = '"Rp"#,##0';
            cell.alignment = { vertical: "middle", horizontal: "right" };
            cell.font = { name: "Calibri", size: 10, bold: true };
          } else {
            cell.alignment = {
              vertical: "middle",
              horizontal: "left",
              wrapText: colNumber === 6 || colNumber === 14 || colNumber === 23,
            };
          }
        });

        // Warna badge pada Kolom 19 (Status Akhir)
        const finalStatusCell = row.getCell(19);
        finalStatusCell.alignment = { vertical: "middle", horizontal: "center" };
        finalStatusCell.font = { name: "Calibri", size: 10, bold: true };
        if (item.final_status === "Selesai") {
          finalStatusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE2EFDA" },
          };
          finalStatusCell.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: "FF375623" },
          };
        } else if (item.final_status === "Menunggu Mitra") {
          finalStatusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFF2CC" },
          };
          finalStatusCell.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: "FF833C0C" },
          };
        } else if (item.final_status === "Dibatalkan") {
          finalStatusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFCE4D6" },
          };
          finalStatusCell.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: "FFC00000" },
          };
        } else {
          finalStatusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDDEBF7" },
          };
          finalStatusCell.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: "FF1F4E78" },
          };
        }

        // Warna badge pada Kolom 22 (Status SLA)
        const slaCell = row.getCell(22);
        slaCell.alignment = { vertical: "middle", horizontal: "center" };
        if (item.sla_status === "Sesuai SLA") {
          slaCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE2EFDA" },
          };
          slaCell.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: "FF375623" },
          };
        } else if (item.sla_status === "Terlambat") {
          slaCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8CBAD" },
          };
          slaCell.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: "FFC00000" },
          };
        } else if (item.sla_status === "Perlu Perhatian") {
          slaCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFE699" },
          };
          slaCell.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: "FF833C0C" },
          };
        } else {
          slaCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDDEBF7" },
          };
          slaCell.font = {
            name: "Calibri",
            size: 10,
            bold: true,
            color: { argb: "FF1F4E78" },
          };
        }
      });

      // Atur lebar 23 kolom agar langsung rapi saat dibuka di Excel
      const columnWidths = [
        6, // 1. No
        15, // 2. Tanggal Terima
        24, // 3. No. Agenda
        26, // 4. Nama Mitra/Vendor
        20, // 5. No. Invoice
        30, // 6. Jenis Pekerjaan/Tagihan
        20, // 7. Nilai Tagihan (Rp)
        15, // 8. Tanggal Softcopy
        16, // 9. Status Pre-check
        15, // 10. Tanggal Hardcopy
        22, // 11. Status Kelengkapan Fisik
        16, // 12. Status Verifikasi
        16, // 13. Status Validasi
        34, // 14. Temuan / Kekurangan
        18, // 15. Tindak Lanjut
        18, // 16. PIC Tindak Lanjut
        15, // 17. Target Selesai
        15, // 18. Tanggal Selesai
        16, // 19. Status Akhir
        15, // 20. SLA (Hari Kerja)
        20, // 21. Durasi Aktual (Hari Kerja)
        17, // 22. Status SLA
        28, // 23. Catatan
      ];

      columnWidths.forEach((w, idx) => {
        sheet.getColumn(idx + 1).width = w;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const dateStamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `Accelera_HUB_Monitoring_23_Kolom_${dateStamp}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast.success(
        `File Excel (.xlsx) 23 kolom (${filteredRows.length} baris) berhasil diunduh.`
      );
    } catch (err) {
      toast.error(
        err instanceof Error
          ? `Gagal mengekspor Excel: ${err.message}`
          : "Gagal mengekspor Excel."
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* HEADER BANNER NAVY (#1F4E78) */}
      <div className="rounded-xl bg-[#1F4E78] px-5 py-4 text-white shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-extrabold tracking-wide uppercase sm:text-xl">
              TABEL MONITORING PENAGIHAN (23 KOLOM STANDAR KLIEN)
            </h1>
            <p className="mt-0.5 text-xs text-slate-200">
              Menampilkan {filteredRows.length} dari {submissions.length}{" "}
              pengajuan tagihan • Total Nilai Terfilter:{" "}
              <strong className="font-mono text-white">
                {formatRupiah(totalFilteredAmount)}
              </strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-white/30 bg-white/10 text-xs text-white hover:bg-white/20"
              >
                <LayoutDashboard className="size-3.5" />
                Dashboard Eksekutif
              </Button>
            </Link>

            <Button
              type="button"
              size="sm"
              disabled={exporting || filteredRows.length === 0}
              onClick={handleExportExcel}
              className="gap-1.5 bg-[#548235] text-xs font-bold text-white hover:bg-[#446a2a]"
            >
              {exporting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-3.5" />
              )}
              Export Excel (.xlsx)
            </Button>
          </div>
        </div>
      </div>

      {/* PANEL FILTER MULTI-DIMENSI */}
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F4E78]">
              <Filter className="size-3.5" />
              <span>Filter &amp; Pencarian Data Monitoring</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-7 gap-1 px-2 text-xs"
            >
              <RotateCcw className="size-3" />
              Reset Filter
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-1">
              <Label htmlFor="filter-date-from" className="text-[11px]">
                Dari Tanggal Terima
              </Label>
              <Input
                id="filter-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="filter-date-to" className="text-[11px]">
                Sampai Tanggal Terima
              </Label>
              <Input
                id="filter-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="filter-vendor" className="text-[11px]">
                Mitra / Vendor
              </Label>
              <select
                id="filter-vendor"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none"
              >
                <option value="ALL">Semua Mitra / Vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="filter-final-status" className="text-[11px]">
                Status Akhir
              </Label>
              <select
                id="filter-final-status"
                value={finalStatusFilter}
                onChange={(e) => setFinalStatusFilter(e.target.value)}
                className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none"
              >
                <option value="ALL">Semua Status Akhir</option>
                <option value="Dalam Proses">Dalam Proses</option>
                <option value="Menunggu Mitra">Menunggu Mitra</option>
                <option value="Selesai">Selesai</option>
                <option value="Dibatalkan">Dibatalkan</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="filter-sla-status" className="text-[11px]">
                Status SLA
              </Label>
              <select
                id="filter-sla-status"
                value={slaStatusFilter}
                onChange={(e) => setSlaStatusFilter(e.target.value)}
                className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-xs outline-none"
              >
                <option value="ALL">Semua Status SLA</option>
                <option value="Sesuai SLA">Sesuai SLA</option>
                <option value="Dalam Proses">Dalam Proses</option>
                <option value="Perlu Perhatian">Perlu Perhatian</option>
                <option value="Terlambat">Terlambat</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="filter-free-search" className="text-[11px]">
                Pencarian Bebas
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted-foreground" />
                <Input
                  id="filter-free-search"
                  type="search"
                  placeholder="Agenda, invoice, pekerjaan, temuan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABEL 23 KOLOM RESPONSIF (HORIZONTAL SCROLL + STICKY HEADER) */}
      <div className="overflow-hidden rounded-xl border bg-background shadow-2xs">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-max min-w-full border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-[#1F4E78] text-white shadow-xs">
              <tr>
                {CLIENT_23_COLUMNS.map((colName, idx) => (
                  <th
                    key={colName}
                    className={cn(
                      "border-r border-white/15 px-3 py-2.5 text-left font-bold whitespace-nowrap",
                      idx === 0 && "w-12 text-center",
                      (idx === 6 || idx === 19 || idx === 20) && "text-right"
                    )}
                  >
                    {colName}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={23}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    Tidak ada data pengajuan tagihan yang cocok dengan filter
                    pencarian.
                  </td>
                </tr>
              ) : (
                filteredRows.map((item, idx) => {
                  const detailHref = getSubmissionDetailHrefForRole(
                    userRole,
                    item.id
                  );

                  return (
                    <tr
                      key={item.id}
                      className="transition-colors hover:bg-muted/40"
                    >
                      {/* 1. No */}
                      <td className="border-r px-3 py-2 text-center font-mono">
                        {idx + 1}
                      </td>
                      {/* 2. Tanggal Terima */}
                      <td className="border-r px-3 py-2 whitespace-nowrap">
                        {formatDateWIB(item.received_date)}
                      </td>
                      {/* 3. No. Agenda */}
                      <td className="border-r px-3 py-2 font-mono font-bold whitespace-nowrap">
                        <Link
                          href={detailHref}
                          className="text-[#1F4E78] hover:underline dark:text-sky-300"
                        >
                          {item.agenda_no}
                        </Link>
                      </td>
                      {/* 4. Nama Mitra/Vendor */}
                      <td className="border-r px-3 py-2 font-semibold whitespace-nowrap">
                        {item.vendor_name}
                      </td>
                      {/* 5. No. Invoice */}
                      <td className="border-r px-3 py-2 font-mono whitespace-nowrap">
                        {item.invoice_no}
                      </td>
                      {/* 6. Jenis Pekerjaan/Tagihan */}
                      <td className="max-w-xs border-r px-3 py-2">
                        <span className="line-clamp-2">{item.work_type}</span>
                      </td>
                      {/* 7. Nilai Tagihan (Rp) */}
                      <td className="border-r px-3 py-2 text-right font-mono font-bold whitespace-nowrap">
                        {formatRupiah(Number(item.amount))}
                      </td>
                      {/* 8. Tanggal Softcopy */}
                      <td className="border-r px-3 py-2 whitespace-nowrap">
                        {formatDateWIB(item.softcopy_date)}
                      </td>
                      {/* 9. Status Pre-check */}
                      <td className="border-r px-3 py-2 whitespace-nowrap">
                        <Badge variant="outline" className="text-[11px]">
                          {item.precheck_status}
                        </Badge>
                      </td>
                      {/* 10. Tanggal Hardcopy */}
                      <td className="border-r px-3 py-2 whitespace-nowrap">
                        {formatDateWIB(item.hardcopy_date)}
                      </td>
                      {/* 11. Status Kelengkapan Fisik */}
                      <td className="border-r px-3 py-2 whitespace-nowrap">
                        <Badge variant="outline" className="text-[11px]">
                          {item.physical_status}
                        </Badge>
                      </td>
                      {/* 12. Status Verifikasi */}
                      <td className="border-r px-3 py-2 whitespace-nowrap">
                        <Badge variant="outline" className="text-[11px]">
                          {item.verification_status}
                        </Badge>
                      </td>
                      {/* 13. Status Validasi */}
                      <td className="border-r px-3 py-2 whitespace-nowrap">
                        <Badge variant="outline" className="text-[11px]">
                          {item.validation_status}
                        </Badge>
                      </td>
                      {/* 14. Temuan / Kekurangan */}
                      <td className="max-w-xs border-r px-3 py-2">
                        <span className="line-clamp-2 text-muted-foreground">
                          {item.findings || "-"}
                        </span>
                      </td>
                      {/* 15. Tindak Lanjut */}
                      <td className="border-r px-3 py-2 whitespace-nowrap">
                        <Badge variant="secondary" className="text-[11px]">
                          {item.followup_action}
                        </Badge>
                      </td>
                      {/* 16. PIC Tindak Lanjut */}
                      <td className="border-r px-3 py-2 whitespace-nowrap">
                        {item.followup_pic || "-"}
                      </td>
                      {/* 17. Target Selesai */}
                      <td className="border-r px-3 py-2 whitespace-nowrap">
                        {item.target_finish_date
                          ? formatDateWIB(item.target_finish_date)
                          : "-"}
                      </td>
                      {/* 18. Tanggal Selesai */}
                      <td className="border-r px-3 py-2 whitespace-nowrap">
                        {formatDateWIB(item.completed_date)}
                      </td>
                      {/* 19. Status Akhir */}
                      <td className="border-r px-3 py-2 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={getFinalStatusBadgeClass(item.final_status)}
                        >
                          {item.final_status}
                        </Badge>
                      </td>
                      {/* 20. SLA (Hari Kerja) */}
                      <td className="border-r px-3 py-2 text-right font-mono font-semibold whitespace-nowrap">
                        {item.sla_target_days} HK
                      </td>
                      {/* 21. Durasi Aktual (Hari Kerja) */}
                      <td className="border-r px-3 py-2 text-right font-mono font-bold whitespace-nowrap">
                        {item.actual_working_days} HK
                      </td>
                      {/* 22. Status SLA */}
                      <td className="border-r px-3 py-2 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={getSlaStatusBadgeClass(item.sla_status)}
                        >
                          {item.sla_status}
                        </Badge>
                      </td>
                      {/* 23. Catatan */}
                      <td className="max-w-xs px-3 py-2">
                        <span className="line-clamp-2 text-muted-foreground">
                          {item.notes || "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

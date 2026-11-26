"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  FileSpreadsheet,
  Filter,
  LayoutDashboard,
  Loader2,
  RotateCcw,
  Search,
  TableProperties,
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
  getCheckStatusBadgeClass,
  getFinalStatusBadgeClass,
  getSlaStatusBadgeClass,
} from "@/lib/constants";
import { MONITORING_GUIDE_ITEMS } from "@/lib/monitoring-guide";
import { getSubmissionDetailHrefForRole } from "@/lib/notifications";
import { PageGuide } from "@/components/layout/page-guide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
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
  const [guideOpen, setGuideOpen] = React.useState(false);

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

      const sheet = workbook.addWorksheet("Monitoring Penagihan", {
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
        fgColor: { argb: "FF0B2E5C" },
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
        fgColor: { argb: "FFE6F4F3" },
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
          fgColor: { argb: "FF0B2E5C" },
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

      // Sheet 2: Panduan Penggunaan Form Monitoring (Versi Accelera HUB)
      const guideSheet = workbook.addWorksheet("Panduan", {
        views: [{ state: "frozen", ySplit: 2 }],
      });

      guideSheet.mergeCells(1, 1, 1, 4);
      const guideTitleCell = guideSheet.getCell(1, 1);
      guideTitleCell.value = "PANDUAN PENGGUNAAN FORM MONITORING — ACCELERA HUB";
      guideTitleCell.font = {
        name: "Calibri",
        size: 13,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      guideTitleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0B2E5C" },
      };
      guideTitleCell.alignment = { vertical: "middle", horizontal: "center" };
      guideSheet.getRow(1).height = 28;

      const guideHeader = guideSheet.getRow(2);
      guideHeader.values = [
        "No",
        "Bagian",
        "Cara Mengisi / Membaca",
        "Catatan Sistem Accelera HUB",
      ];
      guideHeader.height = 24;
      guideHeader.eachCell((cell) => {
        cell.font = {
          name: "Calibri",
          size: 10,
          bold: true,
          color: { argb: "FFFFFFFF" },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0B2E5C" },
        };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
      });

      MONITORING_GUIDE_ITEMS.forEach((item, index) => {
        const gRow = guideSheet.getRow(index + 3);
        gRow.values = [item.no, item.section, item.howToUse, item.notes];
        gRow.height = 34;
        gRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = {
            name: "Calibri",
            size: 10,
            bold: colNumber === 1 || colNumber === 2,
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: colNumber === 1 ? "center" : "left",
            wrapText: true,
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      });

      guideSheet.getColumn(1).width = 6;
      guideSheet.getColumn(2).width = 26;
      guideSheet.getColumn(3).width = 56;
      guideSheet.getColumn(4).width = 50;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const dateStamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `Accelera_HUB_Monitoring_${dateStamp}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast.success(
        `File Excel (.xlsx) (${filteredRows.length} baris + sheet Panduan) berhasil diunduh.`
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
    <div className="space-y-6">
      {/* PAGE GUIDE & HEADER BANNER */}
      <PageGuide
        variant="banner"
        eyebrow="Register & Laporan 23 Kolom"
        title="Tabel Monitoring Penagihan"
        purpose={`Register data lengkap seluruh pengajuan dokumen penagihan beserta durasi SLA real-time. Menampilkan ${filteredRows.length} dari ${submissions.length} tagihan dengan total nilai terfilter ${formatRupiah(totalFilteredAmount)}.`}
        tip="Geser tabel secara horizontal; kolom No. Agenda & Nama Mitra tetap menempel di kiri agar mudah dibaca."
        steps={[
          {
            title: "Filter Data",
            description:
              "Saring berdasarkan rentang tanggal terima, Mitra, Status Akhir, Status SLA, atau kata kunci bebas.",
            badge: "Langkah 1",
            status: "active",
          },
          {
            title: "Telusuri 23 Kolom",
            description:
              "Periksa status Pre-Check, Fisik, Verifikasi PIC, Validasi Akuntansi, hingga temuan & durasi SLA.",
            badge: "Langkah 2",
          },
          {
            title: "Buka Detail Agenda",
            description:
              "Klik No. Agenda berwarna biru/teal untuk langsung membuka halaman pemeriksaan & dokumen terkait.",
            badge: "Langkah 3",
          },
          {
            title: "Export Excel (.xlsx)",
            description:
              "Unduh laporan terformat resmi lengkap dengan sheet Data Monitoring 23 kolom dan sheet Panduan.",
            badge: "Langkah 4",
          },
        ]}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => setGuideOpen(true)}
              className="gap-1.5 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            >
              <BookOpen className="size-4" />
              Panduan Kolom
            </Button>

            <Link href="/dashboard">
              <Button
                type="button"
                variant="outline"
                size="default"
                className="gap-1.5 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <LayoutDashboard className="size-4" />
                Dashboard
              </Button>
            </Link>

            <Button
              type="button"
              size="default"
              disabled={exporting || filteredRows.length === 0}
              onClick={handleExportExcel}
              className="gap-1.5 bg-[#059C95] font-semibold text-white hover:bg-[#04857f]"
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              Export Excel (.xlsx)
            </Button>
          </>
        }
      />

      {/* PANEL FILTER MULTI-DIMENSI */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <Filter className="size-4 text-brand-teal" />
              <span>Filter &amp; Pencarian Data Monitoring</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="size-3.5" />
              Reset Filter
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-1.5">
              <Label htmlFor="filter-date-from" className="text-xs">
                Dari Tanggal Terima
              </Label>
              <Input
                id="filter-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-date-to" className="text-xs">
                Sampai Tanggal Terima
              </Label>
              <Input
                id="filter-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-vendor" className="text-xs">
                Mitra / Vendor
              </Label>
              <select
                id="filter-vendor"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 dark:bg-card/70"
              >
                <option value="ALL">Semua Mitra / Vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-final-status" className="text-xs">
                Status Akhir
              </Label>
              <select
                id="filter-final-status"
                value={finalStatusFilter}
                onChange={(e) => setFinalStatusFilter(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 dark:bg-card/70"
              >
                <option value="ALL">Semua Status Akhir</option>
                <option value="Dalam Proses">Dalam Proses</option>
                <option value="Menunggu Mitra">Menunggu Mitra</option>
                <option value="Selesai">Selesai</option>
                <option value="Dibatalkan">Dibatalkan</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-sla-status" className="text-xs">
                Status SLA
              </Label>
              <select
                id="filter-sla-status"
                value={slaStatusFilter}
                onChange={(e) => setSlaStatusFilter(e.target.value)}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 dark:bg-card/70"
              >
                <option value="ALL">Semua Status SLA</option>
                <option value="Sesuai SLA">Sesuai SLA</option>
                <option value="Dalam Proses">Dalam Proses</option>
                <option value="Perlu Perhatian">Perlu Perhatian</option>
                <option value="Terlambat">Terlambat</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filter-free-search" className="text-xs">
                Pencarian Bebas
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="filter-free-search"
                  type="search"
                  placeholder="Agenda, invoice, pekerjaan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABEL 23 KOLOM RESPONSIF (STICKY HEADER + STICKY LEFT NO. AGENDA & NAMA MITRA) */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-[#0B2E5C] text-white shadow-xs dark:bg-[#0B2549]">
              <tr>
                {CLIENT_23_COLUMNS.map((colName, idx) => (
                  <th
                    key={colName}
                    className={cn(
                      "border-r border-white/15 px-4 py-3 text-left text-xs font-bold tracking-wide whitespace-nowrap uppercase",
                      idx === 0 && "w-14 text-center",
                      idx === 2 &&
                        "sticky left-0 z-30 w-[200px] min-w-[200px] bg-[#0B2E5C] dark:bg-[#0B2549]",
                      idx === 3 &&
                        "sticky left-[200px] z-30 w-[220px] min-w-[220px] bg-[#0B2E5C] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.4)] dark:bg-[#0B2549]",
                      (idx === 6 || idx === 19 || idx === 20) && "text-right"
                    )}
                  >
                    {colName}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-border/70">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={23} className="p-6">
                    <EmptyState
                      icon={TableProperties}
                      title="Tidak ada data tagihan yang cocok"
                      description="Coba ubah rentang tanggal, filter status, atau kata kunci pencarian Anda."
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={resetFilters}
                          className="gap-1.5"
                        >
                          <RotateCcw className="size-3.5" />
                          Reset Semua Filter
                        </Button>
                      }
                    />
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
                      className="group transition-colors hover:bg-accent/50"
                    >
                      {/* 1. No */}
                      <td className="border-r border-border/60 px-4 py-3 text-center text-xs font-semibold text-muted-foreground tabular-nums">
                        {idx + 1}
                      </td>
                      {/* 2. Tanggal Terima */}
                      <td className="border-r border-border/60 px-4 py-3 text-xs whitespace-nowrap text-foreground">
                        {formatDateWIB(item.received_date)}
                      </td>
                      {/* 3. No. Agenda (Sticky Left #1) */}
                      <td className="sticky left-0 z-10 w-[200px] min-w-[200px] border-r border-border/60 bg-card px-4 py-3 font-mono text-xs font-bold whitespace-nowrap tabular-nums transition-colors group-hover:bg-accent">
                        <Link
                          href={detailHref}
                          className="text-primary hover:underline"
                        >
                          {item.agenda_no}
                        </Link>
                      </td>
                      {/* 4. Nama Mitra/Vendor (Sticky Left #2) */}
                      <td className="sticky left-[200px] z-10 w-[220px] min-w-[220px] border-r border-border/60 bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-[4px_0_8px_-4px_rgba(15,23,42,0.18)] transition-colors group-hover:bg-accent">
                        <span className="line-clamp-1">{item.vendor_name}</span>
                      </td>
                      {/* 5. No. Invoice */}
                      <td className="border-r border-border/60 px-4 py-3 font-mono text-xs whitespace-nowrap text-foreground">
                        {item.invoice_no}
                      </td>
                      {/* 6. Jenis Pekerjaan/Tagihan */}
                      <td className="max-w-xs border-r border-border/60 px-4 py-3 text-xs leading-relaxed text-foreground">
                        <span className="line-clamp-2">{item.work_type}</span>
                      </td>
                      {/* 7. Nilai Tagihan (Rp) */}
                      <td className="border-r border-border/60 px-4 py-3 text-right font-bold whitespace-nowrap text-foreground tabular-nums">
                        {formatRupiah(Number(item.amount))}
                      </td>
                      {/* 8. Tanggal Softcopy */}
                      <td className="border-r border-border/60 px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                        {formatDateWIB(item.softcopy_date)}
                      </td>
                      {/* 9. Status Pre-check */}
                      <td className="border-r border-border/60 px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={getCheckStatusBadgeClass(
                            item.precheck_status
                          )}
                        >
                          {item.precheck_status}
                        </Badge>
                      </td>
                      {/* 10. Tanggal Hardcopy */}
                      <td className="border-r border-border/60 px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                        {formatDateWIB(item.hardcopy_date)}
                      </td>
                      {/* 11. Status Kelengkapan Fisik */}
                      <td className="border-r border-border/60 px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={getCheckStatusBadgeClass(
                            item.physical_status
                          )}
                        >
                          {item.physical_status}
                        </Badge>
                      </td>
                      {/* 12. Status Verifikasi */}
                      <td className="border-r border-border/60 px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={getCheckStatusBadgeClass(
                            item.verification_status
                          )}
                        >
                          {item.verification_status}
                        </Badge>
                      </td>
                      {/* 13. Status Validasi */}
                      <td className="border-r border-border/60 px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={getCheckStatusBadgeClass(
                            item.validation_status
                          )}
                        >
                          {item.validation_status}
                        </Badge>
                      </td>
                      {/* 14. Temuan / Kekurangan */}
                      <td className="max-w-xs border-r border-border/60 px-4 py-3 text-xs">
                        <span className="line-clamp-2 text-muted-foreground">
                          {item.findings || "-"}
                        </span>
                      </td>
                      {/* 15. Tindak Lanjut */}
                      <td className="border-r border-border/60 px-4 py-3 whitespace-nowrap">
                        <Badge variant="secondary">{item.followup_action}</Badge>
                      </td>
                      {/* 16. PIC Tindak Lanjut */}
                      <td className="border-r border-border/60 px-4 py-3 text-xs whitespace-nowrap text-foreground">
                        {item.followup_pic || "-"}
                      </td>
                      {/* 17. Target Selesai */}
                      <td className="border-r border-border/60 px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                        {item.target_finish_date
                          ? formatDateWIB(item.target_finish_date)
                          : "-"}
                      </td>
                      {/* 18. Tanggal Selesai */}
                      <td className="border-r border-border/60 px-4 py-3 text-xs whitespace-nowrap text-muted-foreground">
                        {formatDateWIB(item.completed_date)}
                      </td>
                      {/* 19. Status Akhir */}
                      <td className="border-r border-border/60 px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={getFinalStatusBadgeClass(item.final_status)}
                        >
                          {item.final_status}
                        </Badge>
                      </td>
                      {/* 20. SLA (Hari Kerja) */}
                      <td className="border-r border-border/60 px-4 py-3 text-right text-xs font-semibold whitespace-nowrap text-muted-foreground tabular-nums">
                        {item.sla_target_days} HK
                      </td>
                      {/* 21. Durasi Aktual (Hari Kerja) */}
                      <td className="border-r border-border/60 px-4 py-3 text-right text-xs font-bold whitespace-nowrap text-foreground tabular-nums">
                        {item.actual_working_days} HK
                      </td>
                      {/* 22. Status SLA */}
                      <td className="border-r border-border/60 px-4 py-3 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={getSlaStatusBadgeClass(item.sla_status)}
                        >
                          {item.sla_status}
                        </Badge>
                      </td>
                      {/* 23. Catatan */}
                      <td className="max-w-xs px-4 py-3 text-xs">
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

      {/* DIALOG PANDUAN PENGGUNAAN FORM MONITORING */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <BookOpen className="size-4 text-brand-teal" />
              Panduan Penggunaan Form Monitoring
            </DialogTitle>
            <DialogDescription>
              Acuan resmi pembacaan kolom, alur verifikasi/validasi, dan
              perhitungan otomatis SLA 6 Hari Kerja di Accelera HUB.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[62vh] overflow-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="sticky top-0 bg-[#0B2E5C] text-white dark:bg-[#0B2549]">
                <tr>
                  <th className="w-12 border-r border-white/15 px-4 py-2.5 text-center font-bold">
                    No
                  </th>
                  <th className="w-48 border-r border-white/15 px-4 py-2.5 text-left font-bold">
                    Bagian
                  </th>
                  <th className="border-r border-white/15 px-4 py-2.5 text-left font-bold">
                    Cara Mengisi / Membaca
                  </th>
                  <th className="px-4 py-2.5 text-left font-bold">
                    Catatan Sistem
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 bg-card">
                {MONITORING_GUIDE_ITEMS.map((item) => (
                  <tr key={item.no} className="hover:bg-accent/40">
                    <td className="border-r border-border/60 px-4 py-3 text-center font-semibold text-muted-foreground tabular-nums">
                      {item.no}
                    </td>
                    <td className="border-r border-border/60 px-4 py-3 font-semibold text-foreground">
                      {item.section}
                    </td>
                    <td className="border-r border-border/60 px-4 py-3 leading-relaxed text-foreground">
                      {item.howToUse}
                    </td>
                    <td className="px-4 py-3 leading-relaxed text-muted-foreground">
                      {item.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

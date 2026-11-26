"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  FileSearch,
  FileText,
  Inbox,
  PackageCheck,
  PauseCircle,
  RefreshCcw,
  Search,
  Users,
} from "lucide-react";
import type { BillingSubmission, SubmissionStage } from "@/types";
import {
  formatDateTimeWIB,
  formatRupiah,
  getFinalStatusBadgeClass,
  getSlaStatusBadgeClass,
  STAGE_LABELS,
} from "@/lib/constants";
import { isStagePaused } from "@/lib/sla";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageGuide } from "@/components/layout/page-guide";
import { cn } from "@/lib/utils";

export type AdminQueueTabKey =
  | "precheck_softcopy"
  | "menunggu_hardcopy"
  | "cek_fisik_hardcopy"
  | "koordinasi_temuan"
  | "menunggu_revisi_mitra";

export interface SubmissionWithVendor extends BillingSubmission {
  vendors?:
    | { name?: string; npwp?: string | null }
    | Array<{ name?: string; npwp?: string | null }>
    | null;
}

interface QueueTabDefinition {
  key: AdminQueueTabKey;
  label: string;
  compactLabel: string;
  shortDesc: string;
  stages: SubmissionStage[];
  slaNote: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_QUEUE_TABS: QueueTabDefinition[] = [
  {
    key: "precheck_softcopy",
    label: "Perlu Pre-Check",
    compactLabel: "Pre-Check",
    shortDesc:
      "Pemeriksaan awal kelengkapan berkas softcopy yang baru diajukan Mitra",
    stages: ["SUBMITTED", "PRE_CHECK"],
    slaNote: "SLA Aktif (Target: 1 HK)",
    icon: ClipboardCheck,
  },
  {
    key: "menunggu_hardcopy",
    label: "Menunggu Hardcopy",
    compactLabel: "Tunggu Fisik",
    shortDesc:
      "Softcopy telah Pass; menunggu dokumen fisik asli tiba di loket Accelera",
    stages: ["WAITING_HARDCOPY"],
    slaNote: "Timer SLA Di-Pause",
    icon: Inbox,
  },
  {
    key: "cek_fisik_hardcopy",
    label: "Perlu Cek Fisik & Verifikasi",
    compactLabel: "Cek Fisik",
    shortDesc:
      "Berkas fisik sudah diterima; perlu cek fisik & verifikasi sebelum ke PIC Usaha",
    stages: ["PHYSICAL_CHECK"],
    slaNote: "SLA Aktif (Target: 1 HK)",
    icon: PackageCheck,
  },
  {
    key: "koordinasi_temuan",
    label: "Koordinasi Temuan Internal",
    compactLabel: "Koordinasi",
    shortDesc:
      "Temuan dari PIC Usaha atau Akuntansi yang perlu diteruskan ke Mitra atau dikembalikan",
    stages: ["REVISION_PIC", "REVISION_ACCOUNTING"],
    slaNote: "Koordinasi PIC / Akuntansi",
    icon: AlertTriangle,
  },
  {
    key: "menunggu_revisi_mitra",
    label: "Menunggu Revisi Mitra",
    compactLabel: "Revisi Mitra",
    shortDesc:
      "Tagihan yang dikembalikan ke Mitra untuk perbaikan softcopy atau berkas fisik",
    stages: ["REVISION_SOFTCOPY", "REVISION_HARDCOPY"],
    slaNote: "Timer SLA Di-Pause",
    icon: RefreshCcw,
  },
];

function extractVendorName(row: SubmissionWithVendor): string {
  const rel = row.vendors;
  if (!rel) return "-";
  if (Array.isArray(rel)) {
    return rel[0]?.name ?? "-";
  }
  return rel.name ?? "-";
}

interface AdminQueueClientProps {
  submissions: SubmissionWithVendor[];
  initialTab?: AdminQueueTabKey;
  showMasterLinks?: boolean;
  activeVendorsCount?: number;
  userCount?: number;
}

export function AdminQueueClient({
  submissions,
  initialTab = "precheck_softcopy",
  showMasterLinks = true,
  activeVendorsCount,
  userCount,
}: AdminQueueClientProps) {
  const [activeTab, setActiveTab] =
    React.useState<AdminQueueTabKey>(initialTab);
  const [searchQuery, setSearchQuery] = React.useState("");

  // Hitung badge jumlah item untuk masing-masing dari 5 tab antrean
  const tabCounts = React.useMemo(() => {
    const counts: Record<AdminQueueTabKey, number> = {
      precheck_softcopy: 0,
      menunggu_hardcopy: 0,
      cek_fisik_hardcopy: 0,
      koordinasi_temuan: 0,
      menunggu_revisi_mitra: 0,
    };

    for (const row of submissions) {
      for (const tab of ADMIN_QUEUE_TABS) {
        if (tab.stages.includes(row.current_stage)) {
          counts[tab.key] += 1;
        }
      }
    }

    return counts;
  }, [submissions]);

  const activeTabMeta =
    ADMIN_QUEUE_TABS.find((t) => t.key === activeTab) ?? ADMIN_QUEUE_TABS[0];

  const filteredRows = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return submissions.filter((row) => {
      if (!activeTabMeta.stages.includes(row.current_stage)) {
        return false;
      }
      if (!q) return true;
      const vendorName = extractVendorName(row).toLowerCase();
      return (
        row.agenda_no.toLowerCase().includes(q) ||
        row.invoice_no.toLowerCase().includes(q) ||
        row.work_type.toLowerCase().includes(q) ||
        (row.contract_po_no ?? "").toLowerCase().includes(q) ||
        vendorName.includes(q)
      );
    });
  }, [submissions, activeTabMeta, searchQuery]);

  return (
    <div className="space-y-6">
      {/* PAGE GUIDE & HEADER */}
      <PageGuide
        eyebrow="Meja Kerja Admin Accelera (Verifikator)"
        title="Antrean Pemeriksaan Tagihan"
        purpose="Halaman kerja utama Admin Accelera untuk memeriksa kelengkapan softcopy, mencatat kedatangan berkas fisik (hardcopy), melakukan cek fisik & verifikasi administrasi, serta mengoordinasikan revisi dengan Mitra."
        tip="Pilih salah satu dari 5 tab antrean di bawah lalu klik Periksa pada baris pengajuan untuk membuka layar split-screen."
        steps={[
          {
            title: "Pre-Check Softcopy",
            description:
              "Periksa dokumen digital baru. Bila lengkap klik Pass agar Mitra mengirim berkas fisik.",
            badge: "SLA 1 HK",
            status: activeTab === "precheck_softcopy" ? "active" : undefined,
          },
          {
            title: "Terima Hardcopy",
            description:
              "Timer SLA di-Pause saat menunggu kiriman fisik. Catat waktu terima saat berkas tiba di loket.",
            badge: "Auto-Pause",
            status: activeTab === "menunggu_hardcopy" ? "active" : undefined,
          },
          {
            title: "Cek Fisik & Verifikasi",
            description:
              "Cocokkan berkas fisik asli dengan softcopy, lalu teruskan ke PIC Usaha bila Lengkap & Lulus.",
            badge: "SLA 1 HK",
            status: activeTab === "cek_fisik_hardcopy" ? "active" : undefined,
          },
          {
            title: "Koordinasi Temuan",
            description:
              "Tindak lanjuti catatan revisi dari PIC Usaha / Akuntansi — teruskan ke Mitra atau kembalikan ke tim internal.",
            badge: "Koordinasi",
            status: activeTab === "koordinasi_temuan" ? "active" : undefined,
          },
          {
            title: "Pantau Revisi Mitra",
            description:
              "Daftar berkas yang sedang diperbaiki Mitra (SLA di-Pause) sebelum kembali ke antrean.",
            badge: "Auto-Pause",
            status:
              activeTab === "menunggu_revisi_mitra" ? "active" : undefined,
          },
        ]}
        actions={
          showMasterLinks ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/admin/vendors">
                <Button variant="outline" size="default" className="gap-2">
                  <Building2 className="size-4 text-brand-teal" />
                  Master Vendor
                  {typeof activeVendorsCount === "number" && (
                    <Badge variant="secondary" className="ml-0.5 text-xs">
                      {activeVendorsCount}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link href="/admin/users">
                <Button variant="outline" size="default" className="gap-2">
                  <Users className="size-4 text-brand-teal" />
                  Manajemen User
                  {typeof userCount === "number" && (
                    <Badge variant="secondary" className="ml-0.5 text-xs">
                      {userCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            </div>
          ) : undefined
        }
      />

      {/* TABEL ANTREAN AKTIF DENGAN FILTER TAHAP & SEARCH BAR DI BAGIAN ATAS */}
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                <FileSearch className="size-4 shrink-0 text-brand-teal" />
                <span>{activeTabMeta.label}</span>
                <Badge variant="secondary" className="font-mono">
                  {filteredRows.length} item
                </Badge>
                <Badge variant="outline" className="text-xs font-normal">
                  {activeTabMeta.slaNote}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {activeTabMeta.shortDesc}
              </CardDescription>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:w-68">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari No. Agenda, Mitra, Invoice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Segmented Control Bar 1 Baris Rapi */}
            <div className="flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border/80 bg-surface-subtle/80 p-1 xl:w-auto">
              {ADMIN_QUEUE_TABS.map((tab) => {
                const isSelected = activeTab === tab.key;
                const count = tabCounts[tab.key];

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    title={tab.label}
                    className={cn(
                      "inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all xl:flex-initial",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
                    )}
                  >
                    <span>{tab.compactLabel}</span>
                    <span
                      className={cn(
                        "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.2 font-mono text-[11px] font-bold tabular-nums",
                        isSelected
                          ? "bg-white/20 text-primary-foreground dark:bg-black/20"
                          : count > 0
                          ? "bg-brand-teal/15 text-brand-teal"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredRows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={`Antrean "${activeTabMeta.label}" Kosong`}
              description="Pilih tab antrean lain di atas atau ubah kata kunci pencarian Anda."
              action={
                searchQuery.trim() ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                  >
                    Bersihkan Pencarian
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Agenda</TableHead>
                    <TableHead>Mitra / Vendor</TableHead>
                    <TableHead>No. Invoice &amp; Pekerjaan</TableHead>
                    <TableHead>Nilai (Rp)</TableHead>
                    <TableHead>Tahap &amp; Status</TableHead>
                    <TableHead>Pre-Check / Fisik</TableHead>
                    <TableHead>Timer SLA</TableHead>
                    <TableHead>Diterima</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => {
                    const vendorName = extractVendorName(row);
                    const paused =
                      isStagePaused(row.current_stage) ||
                      row.final_status === "Menunggu Mitra";

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs font-semibold tabular-nums">
                          <Link
                            href={`/admin/submissions/${row.id}`}
                            className="text-primary hover:underline"
                          >
                            {row.agenda_no}
                          </Link>
                        </TableCell>

                        <TableCell className="font-medium">
                          {vendorName}
                        </TableCell>

                        <TableCell>
                          <div className="max-w-[230px]">
                            <p className="truncate text-xs font-semibold">
                              {row.invoice_no}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {row.work_type}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="text-xs font-semibold whitespace-nowrap tabular-nums">
                          {formatRupiah(Number(row.amount))}
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge variant="outline" className="text-[10px]">
                              {STAGE_LABELS[row.current_stage]}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                getFinalStatusBadgeClass(row.final_status)
                              )}
                            >
                              {row.final_status}
                            </Badge>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="space-y-1 text-[11px]">
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">
                                Softcopy:
                              </span>
                              <span className="font-semibold">
                                {row.precheck_status}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground">
                                Fisik:
                              </span>
                              <span className="font-semibold">
                                {row.physical_status}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                getSlaStatusBadgeClass(row.sla_status)
                              )}
                            >
                              {row.actual_working_days}/{row.sla_target_days} HK
                              • {row.sla_status}
                            </Badge>
                            {paused ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                <PauseCircle className="size-3" />
                                SLA Di-Pause
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                                <Clock className="size-3" />
                                SLA Berjalan
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          <div>{formatDateTimeWIB(row.received_date)}</div>
                          {row.hardcopy_date && (
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="size-3" />
                              Fisik: {formatDateTimeWIB(row.hardcopy_date)}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <Link href={`/admin/submissions/${row.id}`}>
                            <Button size="xs" className="gap-1">
                              <Eye className="size-3.5" />
                              Periksa
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

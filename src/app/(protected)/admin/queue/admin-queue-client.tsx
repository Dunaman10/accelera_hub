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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  shortDesc: string;
  stages: SubmissionStage[];
  slaNote: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_QUEUE_TABS: QueueTabDefinition[] = [
  {
    key: "precheck_softcopy",
    label: "Perlu Pre-Check",
    shortDesc:
      "Pemeriksaan awal kelengkapan berkas softcopy yang baru diajukan Mitra",
    stages: ["SUBMITTED", "PRE_CHECK"],
    slaNote: "SLA Aktif (Target: 1 HK)",
    icon: ClipboardCheck,
  },
  {
    key: "menunggu_hardcopy",
    label: "Menunggu Hardcopy",
    shortDesc:
      "Softcopy telah Pass; menunggu dokumen fisik asli tiba di loket Accelera",
    stages: ["WAITING_HARDCOPY"],
    slaNote: "Timer SLA Di-Pause",
    icon: Inbox,
  },
  {
    key: "cek_fisik_hardcopy",
    label: "Perlu Cek Fisik & Verifikasi",
    shortDesc:
      "Berkas fisik sudah diterima; perlu cek fisik & verifikasi sebelum ke PIC Usaha",
    stages: ["PHYSICAL_CHECK"],
    slaNote: "SLA Aktif (Target: 1 HK)",
    icon: PackageCheck,
  },
  {
    key: "koordinasi_temuan",
    label: "Koordinasi Temuan Internal",
    shortDesc:
      "Temuan dari PIC Usaha atau Akuntansi yang perlu diteruskan ke Mitra atau dikembalikan",
    stages: ["REVISION_PIC", "REVISION_ACCOUNTING"],
    slaNote: "Koordinasi PIC / Akuntansi",
    icon: AlertTriangle,
  },
  {
    key: "menunggu_revisi_mitra",
    label: "Menunggu Revisi Mitra",
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
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Antrean Kerja Admin Accelera (Verifikator)
          </h1>
          <p className="text-sm text-muted-foreground">
            Meja Pemeriksaan Pre-Check Softcopy, Penerimaan Hardcopy, Cek Fisik
            &amp; Verifikasi, serta Koordinasi Siklus Revisi Mitra.
          </p>
        </div>

        {showMasterLinks && (
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/admin/vendors">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Building2 className="size-4" />
                Master Vendor
                {typeof activeVendorsCount === "number" && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {activeVendorsCount}
                  </Badge>
                )}
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Users className="size-4" />
                Manajemen User
                {typeof userCount === "number" && (
                  <Badge variant="secondary" className="ml-1 text-[10px]">
                    {userCount}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* 5 TAB ANTREAN DENGAN BADGE JUMLAH ITEM */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ADMIN_QUEUE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.key;
          const count = tabCounts[tab.key];

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all",
                isSelected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                  : "border-border bg-background hover:border-primary/40 hover:bg-muted/40"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <Badge
                  variant={isSelected ? "default" : "secondary"}
                  className="font-mono text-xs font-bold"
                >
                  {count}
                </Badge>
              </div>

              <div className="mt-3 space-y-1">
                <p className="text-xs font-bold leading-snug">{tab.label}</p>
                <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                  {tab.shortDesc}
                </p>
              </div>

              <div className="mt-2.5 border-t pt-2 text-[10px] font-medium text-muted-foreground">
                {tab.slaNote}
              </div>
            </button>
          );
        })}
      </div>

      {/* TABEL ANTREAN AKTIF */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSearch className="size-4 text-primary" />
                <span>{activeTabMeta.label}</span>
                <Badge variant="secondary" className="font-mono">
                  {filteredRows.length} item
                </Badge>
              </CardTitle>
              <CardDescription className="mt-0.5">
                {activeTabMeta.shortDesc}
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Cari No. Agenda, Mitra, Invoice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
              <FileText className="size-9 stroke-1 opacity-60" />
              <p className="font-medium">
                Tidak ada dokumen pada antrean &ldquo;{activeTabMeta.label}
                &rdquo;.
              </p>
              <p className="text-xs">
                Pilih tab antrean lain di atas atau ubah kata kunci pencarian.
              </p>
            </div>
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
                        <TableCell className="font-mono text-xs font-semibold">
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

                        <TableCell className="font-mono text-xs font-semibold">
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

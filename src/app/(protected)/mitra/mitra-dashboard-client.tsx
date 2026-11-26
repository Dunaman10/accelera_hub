"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  FilePlus2,
  FileText,
  FolderKanban,
  Search,
} from "lucide-react";
import type { BillingSubmission, FinalStatus, Vendor } from "@/types";
import {
  formatDateTimeWIB,
  formatRupiah,
  getFinalStatusBadgeClass,
  getSlaStatusBadgeClass,
  STAGE_LABELS,
} from "@/lib/constants";
import { PageGuide } from "@/components/layout/page-guide";
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

interface MitraDashboardClientProps {
  submissions: BillingSubmission[];
  vendor: Vendor | null;
}

const STATUS_TABS: Array<{ label: string; value: FinalStatus | "ALL" }> = [
  { label: "Semua Status", value: "ALL" },
  { label: "Dalam Proses", value: "Dalam Proses" },
  { label: "Menunggu Mitra", value: "Menunggu Mitra" },
  { label: "Selesai", value: "Selesai" },
  { label: "Dibatalkan", value: "Dibatalkan" },
];

export function MitraDashboardClient({
  submissions,
  vendor,
}: MitraDashboardClientProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<FinalStatus | "ALL">(
    "ALL"
  );

  const filteredSubmissions = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return submissions.filter((sub) => {
      if (statusFilter !== "ALL" && sub.final_status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        sub.agenda_no.toLowerCase().includes(q) ||
        sub.invoice_no.toLowerCase().includes(q) ||
        sub.work_type.toLowerCase().includes(q) ||
        (sub.contract_po_no ?? "").toLowerCase().includes(q)
      );
    });
  }, [submissions, searchQuery, statusFilter]);

  const waitingMitraCount = React.useMemo(
    () =>
      submissions.filter(
        (s) =>
          s.final_status === "Menunggu Mitra" ||
          s.current_stage === "WAITING_HARDCOPY" ||
          s.current_stage.startsWith("REVISION_")
      ).length,
    [submissions]
  );

  const inProgressCount = React.useMemo(
    () => submissions.filter((s) => s.final_status === "Dalam Proses").length,
    [submissions]
  );

  const completedCount = React.useMemo(
    () => submissions.filter((s) => s.final_status === "Selesai").length,
    [submissions]
  );

  return (
    <div className="space-y-6">
      <PageGuide
        eyebrow={vendor ? `Portal Mitra • ${vendor.name}` : "Portal Mitra / Vendor"}
        title="Tracking & Riwayat Tagihan Mitra"
        purpose="Halaman ini digunakan untuk memantau progres seluruh pengajuan dokumen penagihan perusahaan Anda secara real-time — mulai dari unggah softcopy, instruksi kirim berkas fisik, permintaan revisi, hingga terbitnya SPP."
        tip={
          waitingMitraCount > 0
            ? `Ada ${waitingMitraCount} pengajuan yang memerlukan tindak lanjut Anda (kirim hardcopy atau revisi).`
            : "Klik tombol Ajukan Tagihan Baru untuk memulai pengajuan, atau klik No. Agenda untuk melihat detail timeline."
        }
        steps={[
          {
            title: "Ajukan Softcopy",
            description:
              "Isi rincian invoice & unggah dokumen wajib (Invoice + BAST) untuk mendapat No. Agenda.",
            badge: "Langkah 1",
            status: "active",
          },
          {
            title: "Pre-Check Admin",
            description:
              "Admin memeriksa kelengkapan softcopy (1 HK). Jika Pass, muncul instruksi kirim berkas fisik.",
            badge: "SLA 1 HK",
          },
          {
            title: "Kirim Hardcopy / Revisi",
            description:
              "Saat status Menunggu Mitra, timer SLA di-Pause. Buka Detail untuk kirim berkas atau unggah revisi.",
            badge: "Auto-Pause",
          },
          {
            title: "Approval & SPP Terbit",
            description:
              "Setelah lulus PIC Usaha (1 HK) & Akuntansi (2 HK), SPP resmi terbit (1 HK) siap pencairan.",
            badge: "Total 6 HK",
          },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {vendor && (
              <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-xs">
                <Building2 className="size-3.5 text-brand-teal" />
                {vendor.name}
              </Badge>
            )}
            <Link href="/mitra/submissions/new">
              <Button size="lg" className="gap-2">
                <FilePlus2 className="size-4" />
                Ajukan Tagihan Baru
              </Button>
            </Link>
          </div>
        }
      />

      {/* KARTU RINGKASAN */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-t-4 border-t-brand-teal">
          <CardHeader className="pb-1">
            <CardDescription className="flex items-center justify-between text-xs font-semibold tracking-wide uppercase">
              <span>Sedang Diproses Internal</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-brand-teal/12 text-brand-teal">
                <Clock className="size-4" />
              </div>
            </CardDescription>
            <CardTitle className="text-3xl font-extrabold text-brand-teal tabular-nums">
              {inProgressCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Target SLA Internal: Maksimal 6 Hari Kerja
          </CardContent>
        </Card>

        <Card
          className={
            waitingMitraCount > 0
              ? "border-amber-500/50 border-t-4 border-t-amber-500 bg-amber-500/8"
              : "border-t-4 border-t-amber-500/60"
          }
        >
          <CardHeader className="pb-1">
            <CardDescription className="flex items-center justify-between text-xs font-semibold tracking-wide uppercase">
              <span>Perlu Tindak Lanjut Mitra</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-4" />
              </div>
            </CardDescription>
            <CardTitle className="text-3xl font-extrabold text-amber-700 tabular-nums dark:text-amber-300">
              {waitingMitraCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Kirim dokumen fisik (hardcopy) atau perbaikan revisi
          </CardContent>
        </Card>

        <Card className="border-t-4 border-t-emerald-600 dark:border-t-emerald-400">
          <CardHeader className="pb-1">
            <CardDescription className="flex items-center justify-between text-xs font-semibold tracking-wide uppercase">
              <span>SPP Selesai Terbit</span>
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300">
                <CheckCircle2 className="size-4" />
              </div>
            </CardDescription>
            <CardTitle className="text-3xl font-extrabold text-emerald-700 tabular-nums dark:text-emerald-400">
              {completedCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Siap diproses pencairan pembayaran
          </CardContent>
        </Card>
      </div>

      {/* FILTER STATUS & PENCARIAN */}
      <Card>
        <CardContent className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari No. Agenda, No. Invoice, No. PO/Kontrak, atau Jenis Pekerjaan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {STATUS_TABS.map((tab) => (
              <Button
                key={tab.value}
                type="button"
                size="sm"
                variant={statusFilter === tab.value ? "default" : "outline"}
                onClick={() => setStatusFilter(tab.value)}
                className="text-xs"
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* DAFTAR PENGAJUAN TAGIHAN */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="size-4 text-primary" />
            Daftar Pengajuan Tagihan ({filteredSubmissions.length})
          </CardTitle>
          <CardDescription>
            Klik pada Nomor Agenda atau tombol Detail untuk melihat Timeline
            Stepper 6 Tahap &amp; instruksi dokumen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredSubmissions.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Belum ada pengajuan tagihan yang ditemukan"
              description="Mulai ajukan dokumen penagihan baru untuk mendapatkan Nomor Agenda otomatis atau ubah filter pencarian Anda."
              action={
                <Link href="/mitra/submissions/new">
                  <Button size="sm" className="gap-1.5">
                    <FilePlus2 className="size-3.5" />
                    Buat Pengajuan Tagihan
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Agenda</TableHead>
                    <TableHead>No. Invoice &amp; Pekerjaan</TableHead>
                    <TableHead>Nilai Tagihan</TableHead>
                    <TableHead>Tahap Saat Ini</TableHead>
                    <TableHead>Status Akhir</TableHead>
                    <TableHead>SLA Internal</TableHead>
                    <TableHead>Tanggal Masuk</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubmissions.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs font-semibold tabular-nums">
                        <Link
                          href={`/mitra/submissions/${item.id}`}
                          className="text-primary hover:underline"
                        >
                          {item.agenda_no}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-normal">
                        <div className="font-medium">{item.invoice_no}</div>
                        <div className="line-clamp-1 text-xs text-muted-foreground">
                          {item.work_type}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold whitespace-nowrap tabular-nums">
                        {formatRupiah(Number(item.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {STAGE_LABELS[item.current_stage]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getFinalStatusBadgeClass(item.final_status)}
                        >
                          {item.final_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            "tabular-nums " +
                            getSlaStatusBadgeClass(item.sla_status)
                          }
                        >
                          {item.actual_working_days}/{item.sla_target_days} HK •{" "}
                          {item.sla_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {formatDateTimeWIB(item.received_date)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/mitra/submissions/${item.id}`}>
                          <Button variant="outline" size="sm" className="gap-1">
                            Detail
                            <ArrowRight className="size-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

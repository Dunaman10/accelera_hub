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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Portal Tracking &amp; Riwayat Tagihan Mitra
            </h1>
            {vendor && (
              <Badge variant="secondary" className="gap-1">
                <Building2 className="size-3.5" />
                {vendor.name}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pantau status verifikasi dokumen penagihan Anda secara real-time
            dengan jaminan SLA 6 Hari Kerja.
          </p>
        </div>

        <Link href="/mitra/submissions/new">
          <Button size="lg" className="gap-2">
            <FilePlus2 className="size-4" />
            Ajukan Tagihan Baru
          </Button>
        </Link>
      </div>

      {/* KARTU RINGKASAN */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Sedang Diproses Internal</span>
              <Clock className="size-4 text-sky-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold">
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
              ? "border-amber-500/40 bg-amber-500/5"
              : undefined
          }
        >
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>Perlu Tindak Lanjut Mitra</span>
              <AlertTriangle className="size-4 text-amber-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-700 dark:text-amber-300">
              {waitingMitraCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Kirim dokumen fisik (hardcopy) atau perbaikan revisi
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center justify-between">
              <span>SPP Selesai Terbit</span>
              <CheckCircle2 className="size-4 text-emerald-600" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
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
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari No. Agenda, No. Invoice, No. PO/Kontrak, atau Jenis Pekerjaan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
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
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <FileText className="size-10 stroke-1 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  Belum ada pengajuan tagihan yang ditemukan
                </p>
                <p className="text-xs text-muted-foreground">
                  Mulai ajukan dokumen penagihan baru untuk mendapatkan Nomor
                  Agenda otomatis.
                </p>
              </div>
              <Link href="/mitra/submissions/new">
                <Button size="sm" className="gap-1.5">
                  <FilePlus2 className="size-3.5" />
                  Buat Pengajuan Pertama
                </Button>
              </Link>
            </div>
          ) : (
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
                    <TableCell className="font-mono text-xs font-semibold">
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
                    <TableCell className="font-mono font-medium">
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
                        className={getSlaStatusBadgeClass(item.sla_status)}
                      >
                        {item.actual_working_days}/{item.sla_target_days} HK •{" "}
                        {item.sla_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

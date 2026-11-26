import { Suspense } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  QrCode,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatDateTimeWIB,
  formatRupiah,
  getFinalStatusBadgeClass,
  getSlaStatusBadgeClass,
  STAGE_LABELS,
} from "@/lib/constants";
import { computeStageSlaIndicator } from "@/lib/sla";
import type { BillingSubmission, StageLog } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface SubmissionWithVendor extends BillingSubmission {
  vendors?:
    | { name?: string; npwp?: string | null }
    | Array<{ name?: string; npwp?: string | null }>
    | null;
}

function extractVendorInfo(row: SubmissionWithVendor): {
  name: string;
  npwp: string;
} {
  const rel = row.vendors;
  if (!rel) return { name: "-", npwp: "-" };
  if (Array.isArray(rel)) {
    return {
      name: rel[0]?.name ?? "-",
      npwp: rel[0]?.npwp ?? "-",
    };
  }
  return {
    name: rel.name ?? "-",
    npwp: rel.npwp ?? "-",
  };
}

async function AkuntansiContent() {
  await requireRole(["akuntansi", "super_admin"]);
  const supabase = await createClient();

  const [{ data: submissions }, { data: holidays }, { data: openStageLogs }] =
    await Promise.all([
      supabase
        .from("billing_submissions")
        .select("*, vendors(name, npwp)")
        .order("received_date", { ascending: false }),
      supabase.from("national_holidays").select("holiday_date"),
      supabase
        .from("stage_logs")
        .select("submission_id, to_stage, entered_at, exited_at")
        .is("exited_at", null),
    ]);

  const allRows = (submissions ?? []) as SubmissionWithVendor[];
  const activeQueue = allRows.filter(
    (r) => r.current_stage === "ACCOUNTING_APPROVAL"
  );
  const historyRows = allRows.filter(
    (r) =>
      r.current_stage === "REVISION_ACCOUNTING" ||
      r.current_stage === "SPP_PROCESSING" ||
      r.current_stage === "COMPLETED"
  );

  const holidayDates = (holidays ?? []).map((h) => h.holiday_date);
  const openLogMap = new Map<string, Pick<StageLog, "entered_at">>();
  for (const log of openStageLogs ?? []) {
    openLogMap.set(log.submission_id, log);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Meja Validasi Akuntansi &amp; Perpajakan
          </h1>
          <p className="text-sm text-muted-foreground">
            Pemeriksaan kesesuaian nominal, DPP/PPN/PPh, nomor &amp; tanggal
            Faktur Pajak, serta kesesuaian PO/Kontrak (Batas SLA Tahap
            Akuntansi: Maks. 2 Hari Kerja).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="gap-1.5 px-3 py-1 text-xs">
            <Clock className="size-3.5" />
            Target SLA Akuntansi: 2 Hari Kerja
          </Badge>
          <Link href="/spp">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <QrCode className="size-3.5" />
              Ke Meja Penerbitan SPP
            </Button>
          </Link>
        </div>
      </div>

      {/* RINGKASAN METRIK AKUNTANSI */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Antrean Menunggu Validasi Akuntansi
            </CardDescription>
            <CardTitle className="font-mono text-2xl font-bold text-primary">
              {activeQueue.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground">
            Tahap <code>ACCOUNTING_APPROVAL</code> (SLA Aktif: Maks. 2 HK)
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Temuan Pajak / Akuntansi (Menunggu Revisi)
            </CardDescription>
            <CardTitle className="font-mono text-2xl font-bold text-amber-600 dark:text-amber-400">
              {
                allRows.filter((r) => r.current_stage === "REVISION_ACCOUNTING")
                  .length
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground">
            Tahap <code>REVISION_ACCOUNTING</code> (Timer SLA Di-PAUSE)
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Validasi Lulus (Penyusunan SPP / Selesai)
            </CardDescription>
            <CardTitle className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {
                allRows.filter(
                  (r) =>
                    r.current_stage === "SPP_PROCESSING" ||
                    r.current_stage === "COMPLETED"
                ).length
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground">
            Siap diterbitkan SPP atau sudah selesai
          </CardContent>
        </Card>
      </div>

      {/* TABEL UTAMA ANTREAN VALIDASI AKUNTANSI */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheet className="size-4 text-primary" />
            <span>Antrean Aktif Validasi Akuntansi &amp; Pajak</span>
            <Badge variant="secondary" className="font-mono">
              {activeQueue.length} pengajuan
            </Badge>
          </CardTitle>
          <CardDescription>
            Daftar pengajuan yang telah disetujui PIC Usaha dan siap divalidasi
            aspek pajak &amp; keuangannya
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
              <FileText className="size-9 stroke-1 opacity-60" />
              <p className="font-medium">
                Tidak ada pengajuan pada antrean Validasi Akuntansi saat ini.
              </p>
              <p className="text-xs">
                Pengajuan akan otomatis masuk setelah disetujui oleh PIC Usaha.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Agenda</TableHead>
                    <TableHead>Mitra &amp; NPWP</TableHead>
                    <TableHead>No. Invoice &amp; Pekerjaan</TableHead>
                    <TableHead>Nilai Tagihan</TableHead>
                    <TableHead>Status Verifikasi</TableHead>
                    <TableHead>
                      Indikator Sisa SLA Akuntansi (Maks. 2 HK)
                    </TableHead>
                    <TableHead>Total SLA Internal</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeQueue.map((row) => {
                    const vendorInfo = extractVendorInfo(row);
                    const openLog = openLogMap.get(row.id);
                    const stageSla = computeStageSlaIndicator(
                      "ACCOUNTING_APPROVAL",
                      openLog?.entered_at ?? row.updated_at,
                      holidayDates
                    );

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          <Link
                            href={`/akuntansi/submissions/${row.id}`}
                            className="text-primary hover:underline"
                          >
                            {row.agenda_no}
                          </Link>
                        </TableCell>

                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="truncate text-xs font-semibold">
                              {vendorInfo.name}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground">
                              NPWP: {vendorInfo.npwp}
                            </p>
                          </div>
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
                          <div className="space-y-0.5 text-[11px]">
                            <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="size-3" />
                              <span>
                                PIC: <strong>{row.verification_status}</strong>
                              </span>
                            </div>
                            <div className="text-muted-foreground">
                              Validasi:{" "}
                              <strong>{row.validation_status}</strong>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col items-start gap-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                "gap-1 text-[10px] font-semibold",
                                stageSla.isOverdue
                                  ? "border-destructive/40 bg-destructive/15 text-destructive"
                                  : stageSla.isWarning
                                  ? "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300"
                                  : "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                              )}
                            >
                              {stageSla.isOverdue ? (
                                <AlertTriangle className="size-3" />
                              ) : (
                                <Clock className="size-3" />
                              )}
                              {stageSla.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              Masuk tahap:{" "}
                              {formatDateTimeWIB(
                                openLog?.entered_at ?? row.updated_at
                              )}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              getSlaStatusBadgeClass(row.sla_status)
                            )}
                          >
                            {row.actual_working_days}/{row.sla_target_days} HK •{" "}
                            {row.sla_status}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <Link href={`/akuntansi/submissions/${row.id}`}>
                            <Button size="xs" className="gap-1">
                              <Eye className="size-3.5" />
                              Validasi
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

      {/* RIWAYAT VALIDASI AKUNTANSI */}
      {historyRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Riwayat Validasi Akuntansi ({historyRows.length})
            </CardTitle>
            <CardDescription>
              Pengajuan yang sedang direvisi pajak/akuntansinya atau telah lulus
              ke tahap Penyusunan SPP
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Agenda</TableHead>
                    <TableHead>Mitra</TableHead>
                    <TableHead>No. Invoice</TableHead>
                    <TableHead>Nilai</TableHead>
                    <TableHead>Status Validasi</TableHead>
                    <TableHead>Tahap</TableHead>
                    <TableHead>Status Akhir</TableHead>
                    <TableHead className="text-right">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyRows.slice(0, 15).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        <Link
                          href={`/akuntansi/submissions/${row.id}`}
                          className="text-primary hover:underline"
                        >
                          {row.agenda_no}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {extractVendorInfo(row).name}
                      </TableCell>
                      <TableCell className="text-xs">{row.invoice_no}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatRupiah(Number(row.amount))}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {row.validation_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {STAGE_LABELS[row.current_stage]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            getFinalStatusBadgeClass(row.final_status)
                          )}
                        >
                          {row.final_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/akuntansi/submissions/${row.id}`}>
                          <Button variant="outline" size="xs">
                            Lihat
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AkuntansiPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Antrean Validasi Akuntansi...
        </div>
      }
    >
      <AkuntansiContent />
    </Suspense>
  );
}

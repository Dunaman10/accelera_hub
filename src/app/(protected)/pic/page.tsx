import { Suspense } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  ShieldCheck,
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

function extractVendorName(row: SubmissionWithVendor): string {
  const rel = row.vendors;
  if (!rel) return "-";
  if (Array.isArray(rel)) return rel[0]?.name ?? "-";
  return rel.name ?? "-";
}

async function PicUsahaContent() {
  await requireRole(["pic_usaha", "super_admin"]);
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
    (r) => r.current_stage === "PIC_APPROVAL"
  );
  const historyRows = allRows.filter(
    (r) =>
      r.current_stage !== "PIC_APPROVAL" &&
      (r.current_stage === "REVISION_PIC" ||
        r.current_stage === "ACCOUNTING_APPROVAL" ||
        r.current_stage === "REVISION_ACCOUNTING" ||
        r.current_stage === "SPP_PROCESSING" ||
        r.current_stage === "COMPLETED")
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
            Meja Approval PIC Usaha
          </h1>
          <p className="text-sm text-muted-foreground">
            Verifikasi substansi pekerjaan, kesesuaian BAST, dan nilai tagihan
            berdasarkan Lembar Hasil Cek Digital Admin Accelera (Batas SLA Tahap
            PIC: Maks. 1 Hari Kerja).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="default" className="gap-1.5 px-3 py-1 text-xs">
            <Clock className="size-3.5" />
            Target SLA Tahap PIC: 1 Hari Kerja
          </Badge>
        </div>
      </div>

      {/* RINGKASAN METRIK ANTREAN PIC USAHA */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Antrean Menunggu Approval PIC Usaha
            </CardDescription>
            <CardTitle className="font-mono text-2xl font-bold text-primary">
              {activeQueue.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground">
            Tahap <code>PIC_APPROVAL</code> (SLA Aktif: Maks. 1 HK)
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Dikembalikan untuk Revisi Substansi PIC
            </CardDescription>
            <CardTitle className="font-mono text-2xl font-bold text-amber-600 dark:text-amber-400">
              {allRows.filter((r) => r.current_stage === "REVISION_PIC").length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground">
            Tahap <code>REVISION_PIC</code> (Timer SLA Di-PAUSE)
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Telah Disetujui &amp; Lanjut ke Akuntansi / SPP
            </CardDescription>
            <CardTitle className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {
                allRows.filter(
                  (r) =>
                    r.current_stage === "ACCOUNTING_APPROVAL" ||
                    r.current_stage === "SPP_PROCESSING" ||
                    r.current_stage === "COMPLETED"
                ).length
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground">
            Telah melewati gerbang Approval PIC Usaha
          </CardContent>
        </Card>
      </div>

      {/* TABEL UTAMA: ANTREAN APPROVAL PIC USAHA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" />
            <span>Antrean Aktif Approval PIC Usaha</span>
            <Badge variant="secondary" className="font-mono">
              {activeQueue.length} pengajuan
            </Badge>
          </CardTitle>
          <CardDescription>
            Daftar pengajuan yang telah lulus Pre-Check Softcopy &amp; Cek Fisik
            Hardcopy oleh Admin Accelera
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
              <FileText className="size-9 stroke-1 opacity-60" />
              <p className="font-medium">
                Tidak ada pengajuan yang menunggu Approval PIC Usaha saat ini.
              </p>
              <p className="text-xs">
                Pengajuan baru akan muncul setelah Admin Accelera menyatakan Cek
                Fisik Hardcopy Lengkap &amp; Lulus.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Agenda</TableHead>
                    <TableHead>Nama Mitra</TableHead>
                    <TableHead>No. Invoice &amp; Pekerjaan</TableHead>
                    <TableHead>Nilai Tagihan</TableHead>
                    <TableHead>Hasil Cek Admin</TableHead>
                    <TableHead>Indikator Sisa SLA PIC (Maks. 1 HK)</TableHead>
                    <TableHead>Total SLA Internal</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeQueue.map((row) => {
                    const vendorName = extractVendorName(row);
                    const openLog = openLogMap.get(row.id);
                    const stageSla = computeStageSlaIndicator(
                      "PIC_APPROVAL",
                      openLog?.entered_at ?? row.updated_at,
                      holidayDates
                    );

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          <Link
                            href={`/pic/submissions/${row.id}`}
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
                          <div className="space-y-0.5 text-[11px]">
                            <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="size-3" />
                              <span>
                                Pre-Check: <strong>{row.precheck_status}</strong>
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="size-3" />
                              <span>
                                Fisik: <strong>{row.physical_status}</strong>
                              </span>
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
                          <Link href={`/pic/submissions/${row.id}`}>
                            <Button size="xs" className="gap-1">
                              <Eye className="size-3.5" />
                              Periksa &amp; Putuskan
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

      {/* TABEL RIWAYAT PENGAJUAN YANG TELAH MELEWATI / DIREVISI PIC USAHA */}
      {historyRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Riwayat Pemeriksaan PIC Usaha ({historyRows.length})
            </CardTitle>
            <CardDescription>
              Pengajuan yang sedang dalam revisi PIC atau telah diteruskan ke
              tahap Akuntansi / SPP
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
                    <TableHead>Tahap Saat Ini</TableHead>
                    <TableHead>Status Akhir</TableHead>
                    <TableHead className="text-right">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyRows.slice(0, 15).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        <Link
                          href={`/pic/submissions/${row.id}`}
                          className="text-primary hover:underline"
                        >
                          {row.agenda_no}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {extractVendorName(row)}
                      </TableCell>
                      <TableCell className="text-xs">{row.invoice_no}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {formatRupiah(Number(row.amount))}
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
                        <Link href={`/pic/submissions/${row.id}`}>
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

export default function PicUsahaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Antrean Approval PIC Usaha...
        </div>
      }
    >
      <PicUsahaContent />
    </Suspense>
  );
}

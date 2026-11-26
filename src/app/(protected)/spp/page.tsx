import { Suspense } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Loader2,
  QrCode,
  Send,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  formatDateTimeWIB,
  formatRupiah,
  getSlaStatusBadgeClass,
} from "@/lib/constants";
import { formatTerbilangRupiah } from "@/lib/format-terbilang";
import { computeStageSlaIndicator } from "@/lib/sla";
import type { BillingSubmission, SppDocument, StageLog } from "@/types";
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

async function SppMonitoringContent() {
  await requireRole(["divisi_usaha", "akuntansi", "super_admin"]);
  const supabase = await createClient();

  const [
    { data: submissions },
    { data: sppList },
    { data: holidays },
    { data: openStageLogs },
  ] = await Promise.all([
    supabase
      .from("billing_submissions")
      .select("*, vendors(name, npwp)")
      .order("received_date", { ascending: false }),
    supabase
      .from("spp_documents")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("national_holidays").select("holiday_date"),
    supabase
      .from("stage_logs")
      .select("submission_id, to_stage, entered_at, exited_at")
      .is("exited_at", null),
  ]);

  const allSubmissions = (submissions ?? []) as SubmissionWithVendor[];
  const sppRows = (sppList ?? []) as SppDocument[];
  const sppBySubmissionMap = new Map<string, SppDocument>();
  for (const s of sppRows) {
    sppBySubmissionMap.set(s.submission_id, s);
  }

  const submissionMap = new Map<string, SubmissionWithVendor>();
  for (const sub of allSubmissions) {
    submissionMap.set(sub.id, sub);
  }

  // Antrean aktif tahap penyusunan_spp (SPP_PROCESSING) yang belum punya spp_documents
  const activeSppQueue = allSubmissions.filter(
    (r) =>
      r.current_stage === "SPP_PROCESSING" && !sppBySubmissionMap.has(r.id)
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
            Divisi Usaha &amp; Penerbitan PDF SPP Digital
          </h1>
          <p className="text-sm text-muted-foreground">
            Penyusunan Surat Pengajuan Pembayaran (SPP) ber-QR Code, pengarsipan
            otomatis ke Google Drive, dan pengiriman ke Keuangan pada hari yang
            sama (Target SLA: 1 Hari Kerja).
          </p>
        </div>

        <Badge variant="default" className="gap-1.5 px-3 py-1 text-xs">
          <Clock className="size-3.5" />
          Target SLA SPP: 1 Hari Kerja (Kirim ke Keuangan Hari yang Sama)
        </Badge>
      </div>

      {/* METRIK RINGKASAN SPP */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Antrean Siap Terbit SPP (Tahap Penyusunan SPP)
            </CardDescription>
            <CardTitle className="font-mono text-2xl font-bold text-primary">
              {activeSppQueue.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground">
            Telah lulus Validasi Akuntansi • Menunggu Finalisasi SPP
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Total Dokumen SPP Resmi Diterbitkan
            </CardDescription>
            <CardTitle className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {sppRows.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground">
            Terkunci 1:1 (Read-Only) &amp; Dikirim ke Keuangan
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-medium">
              Total Nilai SPP Terbit
            </CardDescription>
            <CardTitle className="font-mono text-xl font-bold">
              {formatRupiah(
                sppRows.reduce((sum, s) => {
                  const sub = submissionMap.get(s.submission_id);
                  return sum + Number(sub?.amount ?? 0);
                }, 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[11px] text-muted-foreground">
            Akumulasi tagihan yang telah diterbitkan SPP
          </CardContent>
        </Card>
      </div>

      {/* 1. TABEL ANTREAN PENYUSUNAN SPP (SPP_PROCESSING) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="size-4 text-primary" />
            <span>Antrean Penyusunan &amp; Penerbitan SPP</span>
            <Badge variant="secondary" className="font-mono">
              {activeSppQueue.length} pengajuan
            </Badge>
          </CardTitle>
          <CardDescription>
            Pengajuan pada tahap <code>SPP_PROCESSING</code> yang telah
            dinyatakan Lulus Validasi Akuntansi dan siap diterbitkan PDF SPP
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeSppQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
              <FileText className="size-9 stroke-1 opacity-60" />
              <p className="font-medium">
                Tidak ada pengajuan yang menunggu penerbitan SPP saat ini.
              </p>
              <p className="text-xs">
                Pengajuan akan masuk ke antrean ini segera setelah Tim Akuntansi
                menyatakan Validasi Lulus.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. Agenda</TableHead>
                    <TableHead>Nama Mitra</TableHead>
                    <TableHead>No. Invoice &amp; Uraian</TableHead>
                    <TableHead>Nilai &amp; Terbilang</TableHead>
                    <TableHead>Sisa SLA SPP (Maks. 1 HK)</TableHead>
                    <TableHead>Total SLA</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeSppQueue.map((row) => {
                    const vendorName = extractVendorName(row);
                    const openLog = openLogMap.get(row.id);
                    const stageSla = computeStageSlaIndicator(
                      "SPP_PROCESSING",
                      openLog?.entered_at ?? row.updated_at,
                      holidayDates
                    );

                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          <Link
                            href={`/spp/submissions/${row.id}`}
                            className="text-primary hover:underline"
                          >
                            {row.agenda_no}
                          </Link>
                        </TableCell>

                        <TableCell className="font-medium">
                          {vendorName}
                        </TableCell>

                        <TableCell>
                          <div className="max-w-[220px]">
                            <p className="truncate text-xs font-semibold">
                              {row.invoice_no}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {row.work_type}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="max-w-[240px]">
                            <p className="font-mono text-xs font-bold text-primary">
                              {formatRupiah(Number(row.amount))}
                            </p>
                            <p className="line-clamp-1 text-[10px] italic text-muted-foreground">
                              {formatTerbilangRupiah(Number(row.amount))}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "gap-1 text-[10px] font-semibold",
                              stageSla.isOverdue
                                ? "border-destructive/40 bg-destructive/15 text-destructive"
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
                          <Link href={`/spp/submissions/${row.id}`}>
                            <Button size="xs" className="gap-1">
                              <FileCheck2 className="size-3.5" />
                              Susun &amp; Terbitkan SPP
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

      {/* 2. TABEL ARSIP DOKUMEN SPP YANG TELAH DITERBITKAN */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <QrCode className="size-4 text-primary" />
            <span>Arsip Dokumen SPP Terbit &amp; Terkirim ke Keuangan</span>
            <Badge variant="secondary" className="font-mono">
              {sppRows.length} SPP
            </Badge>
          </CardTitle>
          <CardDescription>
            Setiap SPP dilengkapi QR Code verifikasi publik terbatas dan
            otomatis tersimpan di folder Google Drive pengajuan
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sppRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada dokumen SPP yang diterbitkan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No. SPP</TableHead>
                    <TableHead>No. Agenda &amp; Mitra</TableHead>
                    <TableHead>Nilai Tagihan</TableHead>
                    <TableHead>Token Verifikasi QR</TableHead>
                    <TableHead>Tgl Terbit &amp; Kirim Keuangan</TableHead>
                    <TableHead className="text-right">Unduh &amp; Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sppRows.map((spp) => {
                    const sub = submissionMap.get(spp.submission_id);
                    const vendorName = sub ? extractVendorName(sub) : "-";

                    return (
                      <TableRow key={spp.id}>
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          <Link
                            href={`/spp/submissions/${spp.submission_id}`}
                            className="hover:underline"
                          >
                            {spp.spp_no}
                          </Link>
                        </TableCell>

                        <TableCell>
                          <div>
                            <p className="font-mono text-xs font-semibold">
                              {sub?.agenda_no ?? "-"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {vendorName}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="font-mono text-xs font-semibold">
                          {sub ? formatRupiah(Number(sub.amount)) : "-"}
                        </TableCell>

                        <TableCell>
                          <Link
                            href={`/verify/${encodeURIComponent(
                              spp.qr_verification_hash
                            )}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 hover:underline dark:text-emerald-300"
                          >
                            <CheckCircle2 className="size-3" />
                            {spp.qr_verification_hash}
                            <ExternalLink className="size-2.5" />
                          </Link>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          <div>{formatDateTimeWIB(spp.created_at)}</div>
                          {spp.sent_to_finance_at && (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                              Dikirim Keuangan:{" "}
                              {formatDateTimeWIB(spp.sent_to_finance_at)}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <a
                              href={`/api/submissions/${spp.submission_id}/pdf?type=spp&download=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                variant="outline"
                                size="xs"
                                className="gap-1"
                              >
                                <Download className="size-3" />
                                PDF SPP
                              </Button>
                            </a>
                            <a
                              href={`/api/submissions/${spp.submission_id}/pdf?type=checksheet&download=1`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button
                                variant="outline"
                                size="xs"
                                className="gap-1"
                              >
                                <Download className="size-3" />
                                Lembar Cek
                              </Button>
                            </a>
                            <Link
                              href={`/spp/submissions/${spp.submission_id}`}
                            >
                              <Button size="xs" className="gap-1">
                                <Eye className="size-3" />
                                Detail
                              </Button>
                            </Link>
                          </div>
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

export default function SppMonitoringPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Meja Divisi Usaha &amp; Penerbitan SPP...
        </div>
      }
    >
      <SppMonitoringContent />
    </Suspense>
  );
}

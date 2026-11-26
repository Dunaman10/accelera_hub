"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  History,
  Loader2,
  Lock,
  QrCode,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BillingSubmission,
  SppDocument,
  StageLog,
  SubmissionDocument,
  Vendor,
} from "@/types";
import type { StageSlaIndicator } from "@/lib/sla";
import {
  formatDateTimeWIB,
  formatRupiah,
  getFinalStatusBadgeClass,
  getSlaStatusBadgeClass,
  STAGE_LABELS,
} from "@/lib/constants";
import { formatTerbilangRupiah } from "@/lib/format-terbilang";
import { DocumentViewer } from "@/components/documents/document-viewer";
import { SetBreadcrumbLabel } from "@/components/layout/breadcrumb-context";
import { PageGuide } from "@/components/layout/page-guide";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SppSubmissionInspectClientProps {
  submission: BillingSubmission;
  vendor: Vendor | null;
  documents: SubmissionDocument[];
  stageLogs: StageLog[];
  sppDocument: SppDocument | null;
  stageSla: StageSlaIndicator;
}

export function SppSubmissionInspectClient({
  submission,
  vendor,
  documents,
  stageLogs,
  sppDocument,
  stageSla,
}: SppSubmissionInspectClientProps) {
  const router = useRouter();
  const [issuing, setIssuing] = React.useState(false);
  const [confirmIssueOpen, setConfirmIssueOpen] = React.useState(false);
  const [sppNotes, setSppNotes] = React.useState<string>(
    sppDocument?.notes ?? ""
  );

  const stage = submission.current_stage;
  const isReadOnlyLocked =
    Boolean(sppDocument) ||
    stage === "COMPLETED" ||
    submission.final_status === "Selesai";

  // Penguncian Ketat 1:1: Hanya boleh terbitkan SPP jika validation_status === 'Lulus' dan belum ada spp_documents
  const canIssueSpp =
    !isReadOnlyLocked &&
    submission.validation_status === "Lulus" &&
    stage === "SPP_PROCESSING";

  async function handleFinalizeSpp() {
    if (!canIssueSpp) {
      toast.error(
        "Tidak dapat menerbitkan SPP: Pastikan Validasi Akuntansi berstatus Lulus dan SPP belum pernah diterbitkan."
      );
      return;
    }

    setIssuing(true);
    try {
      const response = await fetch(`/api/submissions/${submission.id}/spp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: sppNotes.trim() || null,
        }),
      });

      const json = (await response.json()) as {
        ok: boolean;
        error?: string;
        spp?: SppDocument;
        drive_upload_warning?: string | null;
      };

      if (!response.ok || !json.ok) {
        toast.error(json.error ?? "Gagal menerbitkan dokumen SPP.");
        return;
      }

      toast.success(
        `SPP ${json.spp?.spp_no ?? ""} berhasil diterbitkan, diunggah ke Google Drive, dan ditandai dikirim ke Keuangan!`
      );

      if (json.drive_upload_warning) {
        toast.warning(
          `Catatan Google Drive: ${json.drive_upload_warning}. PDF tetap dapat diunduh langsung.`
        );
      }

      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat menerbitkan SPP."
      );
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="space-y-5">
      <SetBreadcrumbLabel label={submission.agenda_no} />

      <PageGuide
        eyebrow={`Finalisasi SPP Digital • ${STAGE_LABELS[stage]}`}
        title={`Penerbitan SPP ${submission.agenda_no}`}
        purpose="Layar split-screen finalisasi Surat Pengajuan Pembayaran (SPP) untuk memastikan seluruh berkas & nominal terbilang sesuai sebelum menerbitkan PDF resmi ber-QR Code dan mengunci pengajuan secara Read-Only."
        defaultCollapsed={true}
        tip={
          sppDocument
            ? `SPP ${sppDocument.spp_no} telah terbit dan terkunci permanen. Anda dapat mengunduh PDF SPP maupun Lembar Hasil Cek.`
            : "Gunakan tombol Pratinjau PDF Draft SPP terlebih dahulu bila ingin memeriksa tampilan sebelum menerbitkan SPP final."
        }
        topSlot={
          <Link
            href="/spp"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Kembali ke Antrean &amp; Arsip SPP
          </Link>
        }
        steps={[
          {
            title: "Periksa Berkas & Nominal",
            description:
              "Tinjau kelengkapan dokumen di layar kiri serta nominal Rupiah & terbilang di panel kanan.",
            badge: "Langkah 1",
            status: sppDocument ? "completed" : "active",
          },
          {
            title: "Terbitkan PDF SPP Ber-QR",
            description:
              "Klik Terbitkan SPP untuk membuat nomor SPP, menyematkan QR verifikasi, dan mengunggah otomatis ke Google Drive.",
            badge: "SLA 1 HK",
            status: sppDocument ? "completed" : undefined,
          },
          {
            title: "Kunci 1:1 & Kirim Keuangan",
            description:
              "Status berubah menjadi Selesai (Read-Only), argo SLA berhenti, dan PDF siap diteruskan ke Keuangan.",
            badge: "Final",
            status: sppDocument ? "active" : undefined,
          },
        ]}
        actions={
          <div className="flex flex-col gap-2.5 lg:items-end">
            {/* Baris 1: Status & SLA Badges */}
            <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
              <Badge
                variant="outline"
                className={getFinalStatusBadgeClass(submission.final_status)}
              >
                {submission.final_status}
              </Badge>
              <Badge
                variant="outline"
                className={getSlaStatusBadgeClass(submission.sla_status)}
              >
                Total SLA: {submission.actual_working_days}/
                {submission.sla_target_days} HK ({submission.sla_status})
              </Badge>
              {isReadOnlyLocked ? (
                <Badge
                  variant="outline"
                  className="gap-1 border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                >
                  <Lock className="size-3.5" />
                  Terkunci Read-Only (SPP Terbit)
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="gap-1 border-brand-teal/40 bg-brand-teal/15 text-accent-foreground"
                >
                  <Clock className="size-3.5" />
                  SLA SPP: {stageSla.label}
                </Badge>
              )}
            </div>

            {/* Baris 2: Tombol Unduh */}
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <a
                href={`/api/submissions/${submission.id}/pdf?type=checksheet&download=1`}
                download
              >
                <Button variant="outline" size="default" className="gap-1.5 text-xs">
                  <Download className="size-4 text-brand-teal" />
                  Unduh Lembar Cek
                </Button>
              </a>
              <a
                href={`/api/submissions/${submission.id}/pdf?type=spp&download=1`}
                download
              >
                <Button
                  variant={sppDocument ? "default" : "outline"}
                  size="default"
                  className="gap-1.5 text-xs"
                >
                  <Download className="size-4" />
                  {sppDocument
                    ? `Unduh PDF SPP (${sppDocument.spp_no})`
                    : "Pratinjau Draft SPP"}
                </Button>
              </a>
            </div>
          </div>
        }
      />

      {/* SPLIT-SCREEN DESKTOP */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* KIRI (55%): PREVIEW DOKUMEN */}
        <div className="w-full lg:sticky lg:top-6 lg:w-[55%]">
          <DocumentViewer documents={documents} />
        </div>

        {/* KANAN (45%): PANEL FINALISASI SPP & RINGKASAN */}
        <div className="w-full space-y-5 lg:w-[45%]">
          {/* 1. PANEL PENERBITAN / STATUS SPP */}
          <Card className="border-brand-teal/35 shadow-xs">
            <CardHeader className="border-b border-border bg-brand-teal/8">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="size-4 text-brand-teal" />
                  {sppDocument
                    ? "Dokumen SPP Resmi Telah Diterbitkan"
                    : "Finalisasi & Penerbitan SPP (1:1 Lock)"}
                </CardTitle>
                <Badge variant="default" className="text-xs">
                  {sppDocument ? sppDocument.spp_no : "Target SLA: 1 HK"}
                </Badge>
              </div>
              <CardDescription>
                {sppDocument
                  ? "Pengajuan ini telah dikunci (Read-Only). PDF SPP telah diarsipkan ke Google Drive dan ditandai dikirim ke Keuangan."
                  : "Terbitkan PDF SPP resmi ber-QR Code, unggah otomatis ke folder Google Drive pengajuan, dan kunci status menjadi Selesai."}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 text-sm">
              {/* RINGKASAN NOMINAL & TERBILANG */}
              <div className="rounded-xl border bg-primary/5 p-3.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Nama Mitra / Penerima
                  </span>
                  <span className="font-bold">{vendor?.name ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">NPWP Mitra</span>
                  <span className="font-mono">{vendor?.npwp || "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    No. Invoice / PO
                  </span>
                  <span className="font-semibold">
                    {submission.invoice_no} / {submission.contract_po_no || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-semibold">Nilai Pembayaran (Angka)</span>
                  <span className="font-mono text-base font-bold text-primary">
                    {formatRupiah(Number(submission.amount))}
                  </span>
                </div>
                <div className="rounded-lg border bg-background p-2.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Terbilang Rupiah:
                  </span>
                  <p className="mt-0.5 font-semibold italic text-foreground">
                    # {formatTerbilangRupiah(Number(submission.amount))} #
                  </p>
                </div>
              </div>

              {sppDocument ? (
                <div className="space-y-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-emerald-900 dark:text-emerald-200">
                      <ShieldCheck className="size-4" />
                      <span>Nomor SPP: {sppDocument.spp_no}</span>
                    </div>
                    <Badge className="bg-emerald-600 text-white">
                      SAH &amp; TERKIRIM KE KEUANGAN
                    </Badge>
                  </div>

                  <div className="space-y-1 text-[11px]">
                    <p>
                      <strong>Token QR Verifikasi:</strong>{" "}
                      <span className="font-mono">
                        {sppDocument.qr_verification_hash}
                      </span>
                    </p>
                    <p>
                      <strong>Diterbitkan &amp; Dikirim ke Keuangan:</strong>{" "}
                      {formatDateTimeWIB(
                        sppDocument.sent_to_finance_at ?? sppDocument.created_at
                      )}
                    </p>
                    {sppDocument.drive_file_id && (
                      <p>
                        <strong>Google Drive File ID:</strong>{" "}
                        <span className="font-mono">
                          {sppDocument.drive_file_id}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Link
                      href={`/verify/${encodeURIComponent(
                        sppDocument.qr_verification_hash
                      )}`}
                      target="_blank"
                    >
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                      >
                        <QrCode className="size-3.5" />
                        Buka Halaman Verifikasi QR Publik
                        <ExternalLink className="size-3" />
                      </Button>
                    </Link>

                    {sppDocument.drive_file_id && (
                      <a
                        href={`/api/documents/${encodeURIComponent(
                          sppDocument.id
                        )}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                        >
                          <FileText className="size-3.5" />
                          Stream PDF SPP dari Drive
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Checklist Prasyarat Penguncian 1:1 */}
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Status Gerbang Persetujuan Sebelumnya:
                    </p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>
                          Pre-Check: <strong>{submission.precheck_status}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>
                          Cek Fisik: <strong>{submission.physical_status}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>
                          PIC Usaha:{" "}
                          <strong>{submission.verification_status}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                        <span>
                          Validasi Akuntansi:{" "}
                          <strong>{submission.validation_status}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="spp-notes-input">
                      Catatan Pengantar SPP ke Bagian Keuangan (Opsional)
                    </Label>
                    <Textarea
                      id="spp-notes-input"
                      rows={2}
                      disabled={issuing || !canIssueSpp}
                      placeholder="Contoh: Seluruh dokumen asli & faktur pajak telah tervalidasi lengkap. Mohon diproses pencairan ke rekening Mitra..."
                      value={sppNotes}
                      onChange={(e) => setSppNotes(e.target.value)}
                    />
                  </div>

                  <Button
                    type="button"
                    size="lg"
                    disabled={issuing || !canIssueSpp}
                    onClick={() => setConfirmIssueOpen(true)}
                    className="w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {issuing ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Menerbitkan PDF SPP &amp; Mengunggah ke Google Drive...
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        Terbitkan SPP &amp; Tandai Dikirim ke Keuangan
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. RIWAYAT STAGE LOGS */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4 text-primary" />
                Riwayat Persetujuan Lintas Divisi ({stageLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                {stageLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border bg-muted/20 p-3 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {STAGE_LABELS[log.to_stage]}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDateTimeWIB(log.entered_at)}
                      </span>
                    </div>
                    {log.decision && (
                      <p className="mt-1 font-semibold">{log.decision}</p>
                    )}
                    {log.notes && (
                      <p className="mt-1 text-muted-foreground">{log.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={confirmIssueOpen} onOpenChange={setConfirmIssueOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Terbitkan SPP Final &amp; Kunci Read-Only?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Setelah diterbitkan, PDF SPP resmi ber-QR Code untuk{" "}
              <strong>{submission.agenda_no}</strong> senilai{" "}
              <strong className="tabular-nums">
                {formatRupiah(Number(submission.amount))}
              </strong>{" "}
              akan diarsipkan ke Google Drive dan pengajuan dikunci permanen
              dengan status <strong>Selesai</strong>. Tindakan ini tidak dapat
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={issuing}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={issuing}
              onClick={() => {
                setConfirmIssueOpen(false);
                void handleFinalizeSpp();
              }}
            >
              {issuing ? <Loader2 className="size-4 animate-spin" /> : null}
              Ya, Terbitkan SPP Final
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

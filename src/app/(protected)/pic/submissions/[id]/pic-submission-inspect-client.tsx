"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Download,
  History,
  Info,
  Loader2,
  PauseCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BillingSubmission,
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
import { isStagePaused } from "@/lib/sla";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface PicSubmissionInspectClientProps {
  submission: BillingSubmission;
  vendor: Vendor | null;
  documents: SubmissionDocument[];
  stageLogs: StageLog[];
  stageSla: StageSlaIndicator;
}

export function PicSubmissionInspectClient({
  submission,
  vendor,
  documents,
  stageLogs,
  stageSla,
}: PicSubmissionInspectClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState<
    "pic_approve" | "pic_reject" | null
  >(null);
  const [confirmDecision, setConfirmDecision] = React.useState<
    "pic_approve" | "pic_reject" | null
  >(null);
  const [notes, setNotes] = React.useState<string>(submission.findings ?? "");
  const [followupPic, setFollowupPic] = React.useState<string>(
    submission.followup_pic ?? "Mitra / Vendor"
  );
  const [targetFinishDate, setTargetFinishDate] = React.useState<string>(
    submission.target_finish_date ?? ""
  );

  const [prevFindings, setPrevFindings] = React.useState<string | null>(
    submission.findings
  );
  if (submission.findings !== prevFindings) {
    setPrevFindings(submission.findings);
    setNotes(submission.findings ?? "");
  }

  const stage = submission.current_stage;
  const isActionable = stage === "PIC_APPROVAL";
  const paused =
    isStagePaused(stage) || submission.final_status === "Menunggu Mitra";

  // Fokus ke dokumen versi terbaru (is_latest = true), tetap izinkan melihat riwayat versi
  const latestDocuments = React.useMemo(
    () => documents.filter((d) => d.is_latest),
    [documents]
  );

  function requestPicDecision(action: "pic_approve" | "pic_reject") {
    if (action === "pic_reject" && !notes.trim()) {
      toast.error(
        "Catatan temuan (notes) wajib diisi saat mengembalikan pengajuan untuk revisi."
      );
      return;
    }
    setConfirmDecision(action);
  }

  async function handlePicDecision(action: "pic_approve" | "pic_reject") {
    if (action === "pic_reject" && !notes.trim()) {
      toast.error(
        "Catatan temuan (notes) wajib diisi saat mengembalikan pengajuan untuk revisi."
      );
      return;
    }

    setSubmitting(action);
    try {
      const response = await fetch(
        `/api/submissions/${submission.id}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            notes: notes.trim() || null,
            findings: notes.trim() || null,
            latest_notes: notes.trim() || null,
            followup_pic:
              action === "pic_reject" ? followupPic.trim() || null : null,
            target_finish_date:
              action === "pic_reject" ? targetFinishDate.trim() || null : null,
          }),
        }
      );

      const json = (await response.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!response.ok || !json.ok) {
        toast.error(json.error ?? "Gagal memproses keputusan PIC Usaha.");
        return;
      }

      if (action === "pic_approve") {
        toast.success(
          "Pengajuan disetujui PIC Usaha dan diteruskan ke Tim Akuntansi (SLA: 2 Hari Kerja)."
        );
      } else {
        toast.success(
          "Pengajuan dikembalikan untuk revisi temuan PIC Usaha. Timer SLA di-PAUSE."
        );
      }

      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan koneksi saat menyimpan keputusan."
      );
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-5">
      <SetBreadcrumbLabel label={submission.agenda_no} />

      <PageGuide
        eyebrow={`Approval PIC Usaha • ${STAGE_LABELS[stage]}`}
        title={`Verifikasi Substansi ${submission.agenda_no}`}
        purpose="Meja kerja split-screen PIC Usaha untuk memeriksa kecocokan dokumen pekerjaan & BAST (kiri) terhadap Lembar Hasil Cek Digital Admin Accelera (kanan), lalu memutuskan persetujuan dalam batas SLA 1 Hari Kerja."
        defaultCollapsed={true}
        tip="Unduh PDF Lembar Hasil Cek bila diperlukan untuk arsip rapat atau koordinasi internal."
        topSlot={
          <Link
            href="/pic"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Kembali ke Antrean Approval PIC Usaha
          </Link>
        }
        steps={[
          {
            title: "Tinjau BAST & Invoice",
            description:
              "Periksa dokumen terbaru di layar kiri menggunakan kontrol zoom dan rotasi.",
            badge: "Langkah 1",
            status: "active",
          },
          {
            title: "Cek Ringkasan Admin",
            description:
              "Verifikasi kesesuaian nilai, uraian pekerjaan, dan hasil Pre-Check/Fisik di panel kanan.",
            badge: "Langkah 2",
          },
          {
            title: "Setujui atau Revisi",
            description:
              "Setujui untuk meneruskan ke Akuntansi (2 HK), atau kembalikan dengan catatan temuan spesifik (SLA di-Pause).",
            badge: "SLA 1 HK",
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
              {isActionable && (
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1",
                    stageSla.isOverdue
                      ? "border-destructive/40 bg-destructive/15 text-destructive"
                      : "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                  )}
                >
                  <Clock className="size-3.5" />
                  SLA PIC: {stageSla.label}
                </Badge>
              )}
              {paused && (
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300"
                >
                  <PauseCircle className="size-3.5" />
                  SLA Di-PAUSE
                </Badge>
              )}
            </div>

            {/* Baris 2: Info Vendor & Unduh PDF */}
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {vendor && (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-subtle/80 px-3 py-1.5 text-xs">
                  <Building2 className="size-4 shrink-0 text-brand-teal" />
                  <div>
                    <p className="font-semibold text-foreground">{vendor.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      NPWP: {vendor.npwp || "-"}
                    </p>
                  </div>
                </div>
              )}
              <a
                href={`/api/submissions/${submission.id}/pdf?type=checksheet&download=1`}
                download
              >
                <Button variant="outline" size="default" className="gap-1.5 text-xs">
                  <Download className="size-4 text-brand-teal" />
                  Unduh PDF Lembar Hasil Cek
                </Button>
              </a>
            </div>
          </div>
        }
      />

      {/* SPLIT-SCREEN LAYOUT */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* KIRI (55%): PREVIEW DOKUMEN VERSI TERBARU (is_latest = true) */}
        <div className="w-full lg:sticky lg:top-6 lg:w-[55%]">
          <DocumentViewer
            documents={documents.length > 0 ? documents : latestDocuments}
          />
        </div>

        {/* KANAN (45%): LEMBAR HASIL CEK DIGITAL & PANEL KEPUTUSAN PIC USAHA */}
        <div className="w-full space-y-5 lg:w-[45%]">
          {/* 1. RINGKASAN LEMBAR HASIL CEK DIGITAL */}
          <Card className="border-brand-teal/35 shadow-xs">
            <CardHeader className="border-b border-border bg-brand-teal/8">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="size-4 text-brand-teal" />
                  Lembar Hasil Cek Digital
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  Terverifikasi Admin Accelera
                </Badge>
              </div>
              <CardDescription>
                Ringkasan pemeriksaan administrasi awal &amp; cek fisik hardcopy
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3.5 text-sm">
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    Nomor Agenda
                  </p>
                  <p className="mt-0.5 font-mono font-bold">
                    {submission.agenda_no}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    Nama Mitra / Vendor
                  </p>
                  <p className="mt-0.5 font-semibold">{vendor?.name ?? "-"}</p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    Nomor Invoice
                  </p>
                  <p className="mt-0.5 font-semibold">
                    {submission.invoice_no}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <p className="text-[11px] text-muted-foreground">
                    No. PO / Kontrak
                  </p>
                  <p className="mt-0.5 font-medium">
                    {submission.contract_po_no || "-"}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border bg-primary/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nilai Tagihan</span>
                  <span className="font-mono text-base font-bold text-primary">
                    {formatRupiah(Number(submission.amount))}
                  </span>
                </div>
                <p className="mt-1 text-[11px] italic text-muted-foreground">
                  Terbilang: #{formatTerbilangRupiah(Number(submission.amount))}#
                </p>
                <p className="mt-1.5 border-t pt-1.5 text-xs font-medium">
                  Uraian Pekerjaan: {submission.work_type}
                </p>
              </div>

              {/* STATUS GERBANG SEBELUMNYA */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Hasil Pemeriksaan Gerbang Admin Accelera
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded border bg-background px-2.5 py-1.5">
                    <span className="text-muted-foreground">
                      Hasil Pre-Check
                    </span>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    >
                      {submission.precheck_status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded border bg-background px-2.5 py-1.5">
                    <span className="text-muted-foreground">
                      Tgl Terima Hardcopy
                    </span>
                    <span className="font-medium">
                      {formatDateTimeWIB(submission.hardcopy_date)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded border bg-background px-2.5 py-1.5">
                    <span className="text-muted-foreground">
                      Status Cek Fisik
                    </span>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    >
                      {submission.physical_status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded border bg-background px-2.5 py-1.5">
                    <span className="text-muted-foreground">
                      Verifikasi Admin
                    </span>
                    <Badge
                      variant="outline"
                      className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    >
                      {submission.verification_status}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. PANEL KEPUTUSAN APPROVAL PIC USAHA */}
          <Card className="border-brand-teal/35 shadow-xs">
            <CardHeader className="border-b border-border bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="size-4 text-brand-teal" />
                  Keputusan Approval PIC Usaha
                </CardTitle>
                <Badge variant="default" className="text-xs">
                  Batas SLA: 1 Hari Kerja
                </Badge>
              </div>
              <CardDescription>
                Setujui untuk meneruskan ke Validasi Akuntansi, atau kembalikan
                untuk revisi substansi (SLA di-PAUSE).
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {isActionable ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="pic-decision-notes">
                      Catatan Pemeriksaan / Temuan Substansi PIC Usaha{" "}
                      <span className="text-[11px] font-normal text-destructive">
                        (Wajib diisi jika Kembalikan untuk Revisi)
                      </span>
                    </Label>
                    <Textarea
                      id="pic-decision-notes"
                      rows={3}
                      disabled={submitting !== null}
                      placeholder="Tuliskan catatan persetujuan atau rincian temuan ketidakcocokan BAST / substansi pekerjaan..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="pic-followup-pic" className="text-xs">
                        PIC Tindak Lanjut (Jika Revisi)
                      </Label>
                      <Input
                        id="pic-followup-pic"
                        disabled={submitting !== null}
                        placeholder="Mitra / Vendor"
                        value={followupPic}
                        onChange={(e) => setFollowupPic(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pic-target-finish" className="text-xs">
                        Target Selesai Tindak Lanjut
                      </Label>
                      <Input
                        id="pic-target-finish"
                        type="date"
                        disabled={submitting !== null}
                        value={targetFinishDate}
                        onChange={(e) => setTargetFinishDate(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      disabled={submitting !== null}
                      onClick={() => requestPicDecision("pic_approve")}
                      className="w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {submitting === "pic_approve" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      Setujui (Lanjut Akuntansi)
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      disabled={submitting !== null}
                      onClick={() => requestPicDecision("pic_reject")}
                      className="w-full gap-1.5"
                    >
                      {submitting === "pic_reject" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <XCircle className="size-4" />
                      )}
                      Kembalikan untuk Revisi
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-xs">
                  <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Pengajuan berada pada tahap: {STAGE_LABELS[stage]}
                    </p>
                    <p className="text-muted-foreground">
                      Tindakan keputusan PIC Usaha hanya aktif saat pengajuan
                      berada di tahap <strong>Approval PIC Usaha</strong>.
                    </p>
                    {submission.findings && (
                      <div className="mt-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                        <strong>Catatan Temuan Terakhir:</strong>{" "}
                        {submission.findings}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. JEJAK AUDIT STAGE LOGS */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4 text-primary" />
                Riwayat Persetujuan &amp; SLA ({stageLogs.length})
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
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {STAGE_LABELS[log.to_stage]}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px]",
                            log.is_paused
                              ? "bg-amber-500/15 text-amber-800 dark:text-amber-300"
                              : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                          )}
                        >
                          {log.is_paused ? "SLA Pause" : "SLA Internal"}
                        </Badge>
                      </div>
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

      <AlertDialog
        open={confirmDecision !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDecision(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDecision === "pic_approve"
                ? "Setujui Approval PIC Usaha?"
                : "Kembalikan Pengajuan untuk Revisi?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDecision === "pic_approve"
                ? `Pengajuan ${submission.agenda_no} akan dinyatakan lulus verifikasi PIC Usaha dan diteruskan ke Tim Akuntansi (Target SLA: 2 Hari Kerja).`
                : `Pengajuan ${submission.agenda_no} akan dikembalikan untuk koordinasi revisi temuan substansi dan timer SLA akan di-PAUSE.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting !== null}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant={
                confirmDecision === "pic_approve" ? "default" : "destructive"
              }
              disabled={submitting !== null}
              onClick={() => {
                if (!confirmDecision) return;
                const actionToRun = confirmDecision;
                setConfirmDecision(null);
                void handlePicDecision(actionToRun);
              }}
            >
              {confirmDecision === "pic_approve"
                ? "Ya, Setujui & Lanjutkan"
                : "Ya, Kembalikan untuk Revisi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

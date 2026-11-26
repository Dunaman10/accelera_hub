"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  History,
  Info,
  Loader2,
  Lock,
  PackageCheck,
  PauseCircle,
  RefreshCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BillingSubmission,
  CheckStatus,
  FollowupStatus,
  PhysicalStatus,
  StageLog,
  SubmissionDocument,
  Vendor,
} from "@/types";
import type { TransitionActionType } from "@/app/api/submissions/[id]/transition/route";
import {
  formatDateTimeWIB,
  formatRupiah,
  getFinalStatusBadgeClass,
  getSlaStatusBadgeClass,
  STAGE_LABELS,
} from "@/lib/constants";
import { isStagePaused } from "@/lib/sla";
import { DocumentViewer } from "@/components/documents/document-viewer";
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

interface AdminSubmissionInspectClientProps {
  submission: BillingSubmission;
  vendor: Vendor | null;
  documents: SubmissionDocument[];
  stageLogs: StageLog[];
}

function getDefaultLocalDateTimeInput(isoStr?: string | null): string {
  const d = isoStr ? new Date(isoStr) : new Date();
  if (Number.isNaN(d.getTime())) return "";
  const tzOffsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export function AdminSubmissionInspectClient({
  submission,
  vendor,
  documents,
  stageLogs,
}: AdminSubmissionInspectClientProps) {
  const router = useRouter();
  const [submittingAction, setSubmittingAction] =
    React.useState<TransitionActionType | null>(null);

  // State Form Keputusan
  const [findingNotes, setFindingNotes] = React.useState<string>(
    submission.findings ?? ""
  );
  const [followupAction, setFollowupAction] = React.useState<FollowupStatus>(
    submission.followup_action === "Tidak Ada"
      ? "Minta Revisi"
      : submission.followup_action
  );
  const [followupPic, setFollowupPic] = React.useState<string>(
    submission.followup_pic ?? "Mitra / Vendor"
  );
  const [hardcopyReceivedAt, setHardcopyReceivedAt] = React.useState<string>(
    () => getDefaultLocalDateTimeInput(submission.hardcopy_date)
  );
  const [physicalStatus, setPhysicalStatus] = React.useState<PhysicalStatus>(
    submission.physical_status === "Belum Diperiksa"
      ? "Lengkap"
      : submission.physical_status
  );
  const [verificationStatus, setVerificationStatus] =
    React.useState<CheckStatus>(
      submission.verification_status === "Belum Diperiksa"
        ? "Lulus"
        : submission.verification_status
    );

  // Sinkronisasi state saat props submission berubah setelah router.refresh()
  React.useEffect(() => {
    setFindingNotes(submission.findings ?? "");
    if (submission.hardcopy_date) {
      setHardcopyReceivedAt(
        getDefaultLocalDateTimeInput(submission.hardcopy_date)
      );
    }
    if (submission.physical_status !== "Belum Diperiksa") {
      setPhysicalStatus(submission.physical_status);
    }
    if (submission.verification_status !== "Belum Diperiksa") {
      setVerificationStatus(submission.verification_status);
    }
  }, [submission]);

  const stage = submission.current_stage;
  const paused =
    isStagePaused(stage) || submission.final_status === "Menunggu Mitra";

  // ATURAN BLOKIR KETAT:
  // Tombol "Teruskan ke PIC Usaha" hanya aktif jika:
  // precheck_status === 'Pass' AND physicalStatus === 'Lengkap' AND verificationStatus === 'Lulus' AND hardcopy_date IS NOT NULL
  const hasHardcopyDate = Boolean(
    submission.hardcopy_date || hardcopyReceivedAt.trim()
  );
  const canForwardToPicUsaha =
    submission.precheck_status === "Pass" &&
    physicalStatus === "Lengkap" &&
    verificationStatus === "Lulus" &&
    hasHardcopyDate;

  const canRequestPhysicalRevision =
    physicalStatus === "Tidak Lengkap" || verificationStatus === "Tidak Lulus";

  async function executeTransition(
    action: TransitionActionType,
    extraPayload: Record<string, unknown> = {}
  ) {
    // Validasi di sisi klien sebelum kirim ke API
    if (action === "precheck_revision" && !findingNotes.trim()) {
      toast.error(
        "Catatan Temuan / Kekurangan wajib diisi sebelum meminta Revisi Softcopy."
      );
      return;
    }

    if (action === "receive_hardcopy" && !hardcopyReceivedAt.trim()) {
      toast.error("Tanggal & waktu penerimaan berkas fisik wajib diisi.");
      return;
    }

    if (action === "physical_forward_pic" && !canForwardToPicUsaha) {
      toast.error(
        "Blokir State Machine: Pastikan Pre-Check Softcopy = Pass, Tanggal Hardcopy terisi, Cek Fisik = Lengkap, dan Verifikasi = Lulus."
      );
      return;
    }

    if (action === "physical_revision") {
      if (!canRequestPhysicalRevision) {
        toast.error(
          "Ubah status Cek Fisik menjadi 'Tidak Lengkap' atau Verifikasi menjadi 'Tidak Lulus' untuk meminta revisi."
        );
        return;
      }
      if (!findingNotes.trim()) {
        toast.error(
          "Catatan Temuan & Tindak Lanjut wajib diisi untuk Revisi Hardcopy."
        );
        return;
      }
    }

    if (action === "coord_forward_mitra" && !findingNotes.trim()) {
      toast.error(
        "Catatan temuan wajib diisi sebelum diteruskan kepada Mitra."
      );
      return;
    }

    setSubmittingAction(action);
    try {
      const response = await fetch(
        `/api/submissions/${submission.id}/transition`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            findings: findingNotes.trim() || null,
            finding_notes: findingNotes.trim() || null,
            latest_notes: findingNotes.trim() || null,
            followup_action: followupAction,
            follow_up_action: followupAction,
            followup_pic: followupPic.trim() || null,
            hardcopy_date: hardcopyReceivedAt
              ? new Date(hardcopyReceivedAt).toISOString()
              : submission.hardcopy_date,
            hardcopy_received_at: hardcopyReceivedAt
              ? new Date(hardcopyReceivedAt).toISOString()
              : submission.hardcopy_date,
            physical_status: physicalStatus,
            hardcopy_status: physicalStatus,
            verification_status: verificationStatus,
            ...extraPayload,
          }),
        }
      );

      const json = (await response.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!response.ok || !json.ok) {
        toast.error(json.error ?? "Gagal memproses keputusan pemeriksaan.");
        return;
      }

      toast.success("Keputusan pemeriksaan & status SLA berhasil diperbarui.");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan koneksi saat memproses transisi."
      );
    } finally {
      setSubmittingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* TOP BAR: INFO AGENDA, MITRA, STATUS & TIMER SLA */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4 shadow-2xs">
        <div className="space-y-1">
          <Link
            href="/admin/queue"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Kembali ke Antrean Kerja Admin
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-bold tracking-tight">
              {submission.agenda_no}
            </h1>
            <Badge variant="outline" className="font-semibold">
              {STAGE_LABELS[stage]}
            </Badge>
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
              SLA: {submission.actual_working_days}/{submission.sla_target_days}{" "}
              HK ({submission.sla_status})
            </Badge>
            {paused ? (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300"
              >
                <PauseCircle className="size-3" />
                Timer SLA Di-PAUSE
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
              >
                <Clock className="size-3" />
                Timer SLA Internal Aktif
              </Badge>
            )}
          </div>
        </div>

        {vendor && (
          <div className="flex items-center gap-2.5 rounded-xl border bg-muted/30 px-3.5 py-2 text-xs">
            <Building2 className="size-4 text-primary" />
            <div>
              <p className="font-semibold">{vendor.name}</p>
              <p className="text-[11px] text-muted-foreground">
                NPWP: {vendor.npwp || "-"} • PIC: {vendor.pic_name || "-"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          LAYAR PEMERIKSAAN SPLIT-SCREEN DESKTOP 2 KOLOM:
          - Kiri 55%: <DocumentViewer /> dengan tab daftar file & riwayat versi
          - Kanan 45%: Detail tagihan + Panel Aksi Keputusan State Machine
          - Mobile: Otomatis menumpuk vertikal
      ====================================================================== */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* KOLOM KIRI (55%): PRIVATE DOCUMENT VIEWER */}
        <div className="w-full lg:w-[55%] lg:sticky lg:top-18">
          <DocumentViewer documents={documents} />
        </div>

        {/* KOLOM KANAN (45%): DETAIL TAGIHAN & PANEL KEPUTUSAN */}
        <div className="w-full space-y-5 lg:w-[45%]">
          {/* 1. PANEL AKSI KEPUTUSAN SESUAI TAHAP AKTIF */}
          <Card className="border-primary/30 shadow-xs">
            <CardHeader className="border-b bg-primary/5 pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="size-4 text-primary" />
                  Panel Keputusan Pemeriksaan
                </CardTitle>
                <Badge variant="default" className="text-[10px]">
                  {STAGE_LABELS[stage]}
                </Badge>
              </div>
              <CardDescription>
                State machine terkunci sesuai urutan tahapan verifikasi tanpa
                lompatan status.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
              {/* -------------------------------------------------------------
                  KONDISI A: TAHAP PRE-CHECK SOFTCOPY (SUBMITTED / PRE_CHECK)
              -------------------------------------------------------------- */}
              {(stage === "PRE_CHECK" || stage === "SUBMITTED") && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-950 dark:text-sky-200">
                    <p className="font-semibold">
                      Tahap 1: Pemeriksaan Pre-Check Softcopy (Target SLA: 1
                      Hari Kerja)
                    </p>
                    <p className="mt-1 leading-relaxed opacity-90">
                      Periksa kelengkapan dokumen softcopy di sebelah kiri
                      (Invoice, BAST, Faktur Pajak, Kontrak). Jika lengkap,
                      pilih <strong>Pass Softcopy</strong> untuk menginstruksikan
                      Mitra mengirim berkas fisik (SLA otomatis di-PAUSE). Jika
                      ada kekurangan, isi catatan temuan dan pilih{" "}
                      <strong>Minta Revisi Softcopy</strong>.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="precheck-findings">
                      Catatan Pemeriksaan / Temuan Kekurangan{" "}
                      <span className="text-[11px] font-normal text-destructive">
                        (Wajib diisi jika Minta Revisi)
                      </span>
                    </Label>
                    <Textarea
                      id="precheck-findings"
                      rows={3}
                      disabled={submittingAction !== null}
                      placeholder="Tuliskan rincian kekurangan dokumen softcopy (contoh: BAST belum ditandatangani kedua belah pihak / nomor faktur pajak belum sesuai)..."
                      value={findingNotes}
                      onChange={(e) => setFindingNotes(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      variant="default"
                      disabled={submittingAction !== null}
                      onClick={() => executeTransition("precheck_pass")}
                      className="w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {submittingAction === "precheck_pass" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      Pass Softcopy (Tunggu Fisik)
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      disabled={submittingAction !== null}
                      onClick={() => executeTransition("precheck_revision")}
                      className="w-full gap-1.5"
                    >
                      {submittingAction === "precheck_revision" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <XCircle className="size-4" />
                      )}
                      Minta Revisi Softcopy
                    </Button>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  KONDISI B: TAHAP PENERIMAAN HARDCOPY (WAITING_HARDCOPY)
              -------------------------------------------------------------- */}
              {stage === "WAITING_HARDCOPY" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-200">
                    <p className="font-semibold">
                      Menunggu Pengiriman Berkas Fisik (Timer SLA Di-PAUSE)
                    </p>
                    <p className="mt-1 leading-relaxed opacity-90">
                      Pre-Check Softcopy telah dinyatakan <strong>Pass</strong>.
                      Saat amplop dokumen asli diterima di loket Accelera, catat
                      tanggal &amp; waktu penerimaannya di bawah ini untuk
                      melanjutkan ke tahap <strong>Cek Fisik Hardcopy</strong>{" "}
                      dan mengaktifkan kembali timer SLA.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hardcopy-received-input">
                      Tanggal &amp; Waktu Hardcopy Diterima{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="hardcopy-received-input"
                      type="datetime-local"
                      required
                      disabled={submittingAction !== null}
                      value={hardcopyReceivedAt}
                      onChange={(e) => setHardcopyReceivedAt(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hardcopy-receive-notes">
                      Catatan Penerimaan Loket (Opsional)
                    </Label>
                    <Input
                      id="hardcopy-receive-notes"
                      disabled={submittingAction !== null}
                      placeholder="Contoh: Diterima di loket lantai 2 oleh kurir Mitra"
                      value={findingNotes}
                      onChange={(e) => setFindingNotes(e.target.value)}
                    />
                  </div>

                  <Button
                    type="button"
                    disabled={
                      submittingAction !== null || !hardcopyReceivedAt.trim()
                    }
                    onClick={() => executeTransition("receive_hardcopy")}
                    className="w-full gap-2"
                  >
                    {submittingAction === "receive_hardcopy" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <CalendarClock className="size-4" />
                    )}
                    Catat Hardcopy Diterima &amp; Mulai Cek Fisik
                  </Button>
                </div>
              )}

              {/* -------------------------------------------------------------
                  KONDISI C: TAHAP CEK FISIK & VERIFIKASI (PHYSICAL_CHECK)
              -------------------------------------------------------------- */}
              {stage === "PHYSICAL_CHECK" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-950 dark:text-sky-200">
                    <p className="font-semibold">
                      Tahap 2: Cek Fisik Hardcopy &amp; Verifikasi (Target SLA: 1
                      Hari Kerja)
                    </p>
                    <p className="mt-1 leading-relaxed opacity-90">
                      Cocokkan dokumen fisik asli dengan dokumen softcopy di
                      layar kiri. Tombol{" "}
                      <strong>&ldquo;Teruskan ke PIC Usaha&rdquo;</strong> hanya
                      terbuka apabila <code>Pre-Check = Pass</code>,{" "}
                      <code>Hardcopy = Lengkap</code>,{" "}
                      <code>Verifikasi = Lulus</code>, dan{" "}
                      <code>Tanggal Hardcopy</code> tercatat.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="select-physical-status">
                        Kelengkapan Fisik (hardcopy_status){" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <select
                        id="select-physical-status"
                        disabled={submittingAction !== null}
                        value={physicalStatus}
                        onChange={(e) =>
                          setPhysicalStatus(e.target.value as PhysicalStatus)
                        }
                        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-xs font-semibold outline-none focus-visible:border-ring"
                      >
                        <option value="Lengkap">Lengkap (lengkap)</option>
                        <option value="Tidak Lengkap">
                          Tidak Lengkap (tidak_lengkap)
                        </option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="select-verification-status">
                        Status Verifikasi (verification_status){" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <select
                        id="select-verification-status"
                        disabled={submittingAction !== null}
                        value={verificationStatus}
                        onChange={(e) =>
                          setVerificationStatus(e.target.value as CheckStatus)
                        }
                        className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-xs font-semibold outline-none focus-visible:border-ring"
                      >
                        <option value="Lulus">Lulus (lulus)</option>
                        <option value="Tidak Lulus">
                          Tidak Lulus (tidak_lulus)
                        </option>
                      </select>
                    </div>
                  </div>

                  {/* Indikator Checklist Prasyarat Blokir Ketat */}
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1.5">
                    <p className="font-semibold text-[11px] uppercase tracking-wider text-muted-foreground">
                      Prasyarat Penguncian State Machine ke PIC Usaha:
                    </p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      <div className="flex items-center gap-1.5">
                        {submission.precheck_status === "Pass" ? (
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="size-3.5 text-destructive" />
                        )}
                        <span>
                          Softcopy: <strong>{submission.precheck_status}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {hasHardcopyDate ? (
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="size-3.5 text-destructive" />
                        )}
                        <span>
                          Tgl Hardcopy:{" "}
                          <strong>
                            {submission.hardcopy_date
                              ? formatDateTimeWIB(submission.hardcopy_date)
                              : "Tercatat"}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {physicalStatus === "Lengkap" ? (
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="size-3.5 text-destructive" />
                        )}
                        <span>
                          Cek Fisik: <strong>{physicalStatus}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {verificationStatus === "Lulus" ? (
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="size-3.5 text-destructive" />
                        )}
                        <span>
                          Verifikasi: <strong>{verificationStatus}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="physical-findings">
                      Catatan Pemeriksaan / Temuan &amp; Tindak Lanjut{" "}
                      {canRequestPhysicalRevision && (
                        <span className="text-destructive">*</span>
                      )}
                    </Label>
                    <Textarea
                      id="physical-findings"
                      rows={3}
                      disabled={submittingAction !== null}
                      placeholder={
                        canRequestPhysicalRevision
                          ? "Wajib diisi: Jelaskan dokumen fisik yang tidak lengkap atau tidak sesuai (contoh: Meterai belum ditempel pada Invoice asli)..."
                          : "Catatan tambahan untuk PIC Usaha (opsional)..."
                      }
                      value={findingNotes}
                      onChange={(e) => setFindingNotes(e.target.value)}
                    />
                  </div>

                  {canRequestPhysicalRevision && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="followup-select">
                          Tindak Lanjut (followup_action)
                        </Label>
                        <select
                          id="followup-select"
                          disabled={submittingAction !== null}
                          value={followupAction}
                          onChange={(e) =>
                            setFollowupAction(e.target.value as FollowupStatus)
                          }
                          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-xs outline-none"
                        >
                          <option value="Minta Revisi">Minta Revisi</option>
                          <option value="Menunggu Dokumen">
                            Menunggu Dokumen
                          </option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="followup-pic-input">
                          PIC Tindak Lanjut
                        </Label>
                        <Input
                          id="followup-pic-input"
                          disabled={submittingAction !== null}
                          value={followupPic}
                          onChange={(e) => setFollowupPic(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <Button
                      type="button"
                      disabled={
                        submittingAction !== null || !canForwardToPicUsaha
                      }
                      onClick={() => executeTransition("physical_forward_pic")}
                      className="flex-1 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {submittingAction === "physical_forward_pic" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : !canForwardToPicUsaha ? (
                        <Lock className="size-4" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      Teruskan ke PIC Usaha
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      disabled={
                        submittingAction !== null || !canRequestPhysicalRevision
                      }
                      onClick={() => executeTransition("physical_revision")}
                      className="flex-1 gap-1.5"
                    >
                      {submittingAction === "physical_revision" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ShieldAlert className="size-4" />
                      )}
                      Kembalikan Revisi Hardcopy
                    </Button>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  KONDISI D: KOORDINASI TEMUAN INTERNAL (REVISION_PIC / REVISION_ACCOUNTING)
              -------------------------------------------------------------- */}
              {(stage === "REVISION_PIC" ||
                stage === "REVISION_ACCOUNTING") && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    <p className="font-semibold">
                      Koordinasi Temuan dari{" "}
                      {stage === "REVISION_PIC"
                        ? "PIC Usaha"
                        : "Tim Akuntansi / Pajak"}
                    </p>
                    <p className="mt-1 leading-relaxed">
                      Admin Accelera dapat meneruskan catatan temuan ini ke Mitra
                      (menghentikan/pause SLA) atau mengembalikan berkas ke{" "}
                      {stage === "REVISION_PIC"
                        ? "Approval PIC Usaha"
                        : "Approval Akuntansi"}{" "}
                      setelah klarifikasi/perbaikan selesai.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="coord-findings">
                      Catatan Temuan / Instruksi Perbaikan{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      id="coord-findings"
                      rows={3}
                      disabled={submittingAction !== null}
                      placeholder="Tuliskan catatan temuan atau hasil klarifikasi..."
                      value={findingNotes}
                      onChange={(e) => setFindingNotes(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submittingAction !== null}
                      onClick={() => executeTransition("coord_forward_mitra")}
                      className="flex-1 gap-1.5 border-amber-500/50 text-amber-800 hover:bg-amber-500/10 dark:text-amber-300"
                    >
                      {submittingAction === "coord_forward_mitra" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <PauseCircle className="size-4" />
                      )}
                      Teruskan ke Mitra (Pause SLA)
                    </Button>

                    <Button
                      type="button"
                      disabled={submittingAction !== null}
                      onClick={() => executeTransition("coord_return_internal")}
                      className="flex-1 gap-1.5"
                    >
                      {submittingAction === "coord_return_internal" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ArrowRight className="size-4" />
                      )}
                      Kembalikan ke{" "}
                      {stage === "REVISION_PIC" ? "PIC Usaha" : "Akuntansi"}
                    </Button>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  KONDISI E: MENUNGGU REVISI MITRA (REVISION_SOFTCOPY / REVISION_HARDCOPY)
              -------------------------------------------------------------- */}
              {(stage === "REVISION_SOFTCOPY" ||
                stage === "REVISION_HARDCOPY") && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-200">
                    <RefreshCcw className="mt-0.5 size-4 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-semibold">
                        Menunggu Perbaikan &amp; Kirim Ulang dari Mitra (Timer
                        SLA Di-PAUSE)
                      </p>
                      <p className="leading-relaxed opacity-90">
                        Pengajuan ini sedang berada di tangan Mitra untuk
                        mengunggah dokumen revisi pada tahap{" "}
                        <strong>{STAGE_LABELS[stage]}</strong>.
                      </p>
                      {submission.findings && (
                        <p className="mt-1.5 rounded border border-amber-500/30 bg-background/70 p-2">
                          <strong>Catatan Temuan Aktif:</strong>{" "}
                          {submission.findings}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  KONDISI F: TAHAP LANJUTAN (PIC_APPROVAL / ACCOUNTING_APPROVAL / SPP / COMPLETED)
              -------------------------------------------------------------- */}
              {stage !== "PRE_CHECK" &&
                stage !== "SUBMITTED" &&
                stage !== "WAITING_HARDCOPY" &&
                stage !== "PHYSICAL_CHECK" &&
                stage !== "REVISION_PIC" &&
                stage !== "REVISION_ACCOUNTING" &&
                stage !== "REVISION_SOFTCOPY" &&
                stage !== "REVISION_HARDCOPY" && (
                  <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-xs">
                    <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-semibold">
                        Tahap Aktif: {STAGE_LABELS[stage]}
                      </p>
                      <p className="mt-0.5 text-muted-foreground">
                        Pemeriksaan di meja Admin Accelera telah selesai. Berkas
                        saat ini berada pada kewenangan{" "}
                        <strong>{STAGE_LABELS[stage]}</strong>.
                      </p>
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* 2. RINCIAN METADATA TAGIHAN & STATUS PEMERIKSAAN */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-primary" />
                Detail Tagihan &amp; Status Verifikasi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">Nomor Agenda</span>
                <span className="font-mono font-semibold">
                  {submission.agenda_no}
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">Mitra / Vendor</span>
                <span className="font-semibold">{vendor?.name ?? "-"}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">Nomor Invoice</span>
                <span className="font-semibold">{submission.invoice_no}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">No. PO / Kontrak</span>
                <span>{submission.contract_po_no || "-"}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">Jenis Pekerjaan</span>
                <span className="max-w-[230px] text-right font-medium">
                  {submission.work_type}
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">Nilai Tagihan</span>
                <span className="font-mono text-sm font-bold text-primary">
                  {formatRupiah(Number(submission.amount))}
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">
                  Tgl Terima Softcopy
                </span>
                <span>{formatDateTimeWIB(submission.softcopy_date)}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">
                  Tgl Terima Hardcopy
                </span>
                <span className="font-medium">
                  {formatDateTimeWIB(submission.hardcopy_date)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">Status Pre-Check</span>
                <Badge variant="outline">{submission.precheck_status}</Badge>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">Status Cek Fisik</span>
                <Badge variant="outline">{submission.physical_status}</Badge>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">
                  Status Verifikasi
                </span>
                <Badge variant="outline">
                  {submission.verification_status}
                </Badge>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">
                  Tindak Lanjut Aktif
                </span>
                <Badge variant="secondary">{submission.followup_action}</Badge>
              </div>

              {submission.findings && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
                  <div className="flex items-center gap-1.5 font-semibold text-destructive">
                    <AlertTriangle className="size-3.5" />
                    <span>Catatan Temuan Terakhir:</span>
                  </div>
                  <p className="mt-1 leading-relaxed text-foreground">
                    {submission.findings}
                  </p>
                </div>
              )}

              {submission.notes && (
                <div className="rounded-lg border bg-muted/30 p-2.5">
                  <span className="font-semibold text-muted-foreground">
                    Catatan Mitra:
                  </span>
                  <p className="mt-1 leading-relaxed">{submission.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 3. RIWAYAT LOG TAHAPAN & JEJAK AUDIT SLA */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4 text-primary" />
                Jejak Audit Transisi &amp; SLA ({stageLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stageLogs.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Belum ada log riwayat tahapan.
                </p>
              ) : (
                <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                  {stageLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border bg-muted/20 p-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
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
                          {Number(log.working_days_spent) > 0 && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              ({log.working_days_spent} HK)
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateTimeWIB(log.entered_at)}
                        </span>
                      </div>
                      {log.decision && (
                        <p className="mt-1 font-semibold">{log.decision}</p>
                      )}
                      {log.notes && (
                        <p className="mt-1 text-muted-foreground leading-relaxed">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

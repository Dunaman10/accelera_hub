import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  Info,
  Loader2,
  PackageCheck,
  PauseCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BillingSubmission, SubmissionStage } from "@/types";
import {
  DOC_CATEGORY_LABELS,
  formatBytes,
  formatDateTimeWIB,
  formatDateWIB,
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

interface StepConfig {
  stepNumber: number;
  title: string;
  subtitle: string;
  slaLabel: string;
}

const SIX_TIMELINE_STEPS: StepConfig[] = [
  {
    stepNumber: 1,
    title: "Input Softcopy",
    subtitle: "Pengajuan mandiri & unggah dokumen softcopy oleh Mitra",
    slaLabel: "Hari ke-0",
  },
  {
    stepNumber: 2,
    title: "Pre-Check",
    subtitle: "Pemeriksaan kelengkapan administrasi awal oleh Admin Accelera",
    slaLabel: "SLA: 1 Hari Kerja",
  },
  {
    stepNumber: 3,
    title: "Kirim & Cek Fisik",
    subtitle: "Pengiriman berkas hardcopy asli & verifikasi fisik di loket",
    slaLabel: "SLA: 1 Hari Kerja",
  },
  {
    stepNumber: 4,
    title: "Approval PIC Usaha",
    subtitle: "Verifikasi substansi pekerjaan, BAST, dan nilai kontrak",
    slaLabel: "SLA: 1 Hari Kerja",
  },
  {
    stepNumber: 5,
    title: "Approval Akuntansi",
    subtitle: "Validasi faktur pajak, PPN/PPh, dan kesesuaian keuangan",
    slaLabel: "SLA: 2 Hari Kerja",
  },
  {
    stepNumber: 6,
    title: "SPP Selesai",
    subtitle: "Penerbitan Surat Permintaan Pembayaran (SPP) ber-QR Code",
    slaLabel: "SLA: 1 Hari Kerja",
  },
];

type VisualStepState = "completed" | "active" | "revision" | "waiting" | "upcoming" | "cancelled";

function resolveStepStates(submission: BillingSubmission): {
  activeStepIndex: number; // 1..6
  states: Record<number, { state: VisualStepState; badgeText: string }>;
} {
  const stage: SubmissionStage = submission.current_stage;

  // Mapping stage ke nomor langkah 1..6
  let activeIndex = 2;
  let activeMode: VisualStepState = "active";
  let activeBadge = "Sedang Diperiksa";

  switch (stage) {
    case "SUBMITTED":
    case "PRE_CHECK":
      activeIndex = 2;
      activeMode = "active";
      activeBadge =
        submission.precheck_status === "Pass"
          ? "Lulus Pre-Check"
          : "Pre-Check Softcopy";
      break;
    case "REVISION_SOFTCOPY":
      activeIndex = 2;
      activeMode = "revision";
      activeBadge = "Perlu Revisi Softcopy";
      break;
    case "WAITING_HARDCOPY":
      activeIndex = 3;
      activeMode = "waiting";
      activeBadge = "Menunggu Kirim Hardcopy";
      break;
    case "PHYSICAL_CHECK":
      activeIndex = 3;
      activeMode = "active";
      activeBadge = "Pemeriksaan Berkas Fisik";
      break;
    case "REVISION_HARDCOPY":
      activeIndex = 3;
      activeMode = "revision";
      activeBadge = "Revisi Berkas Fisik";
      break;
    case "PIC_APPROVAL":
      activeIndex = 4;
      activeMode = "active";
      activeBadge = "Verifikasi PIC Usaha";
      break;
    case "REVISION_PIC":
      activeIndex = 4;
      activeMode = "revision";
      activeBadge = "Revisi Substansi PIC";
      break;
    case "ACCOUNTING_APPROVAL":
      activeIndex = 5;
      activeMode = "active";
      activeBadge = "Validasi Pajak & Akuntansi";
      break;
    case "REVISION_ACCOUNTING":
      activeIndex = 5;
      activeMode = "revision";
      activeBadge = "Revisi Pajak / Akuntansi";
      break;
    case "SPP_PROCESSING":
      activeIndex = 6;
      activeMode = "active";
      activeBadge = "Proses Penerbitan SPP";
      break;
    case "COMPLETED":
      activeIndex = 6;
      activeMode = "completed";
      activeBadge = "SPP Terbit & Selesai";
      break;
    case "CANCELLED":
      activeIndex = 2;
      activeMode = "cancelled";
      activeBadge = "Pengajuan Dibatalkan";
      break;
  }

  const states: Record<number, { state: VisualStepState; badgeText: string }> =
    {};

  for (let i = 1; i <= 6; i++) {
    if (stage === "CANCELLED") {
      states[i] =
        i === 1
          ? { state: "completed", badgeText: "Terinput" }
          : { state: "cancelled", badgeText: "Dibatalkan" };
      continue;
    }

    if (stage === "COMPLETED") {
      states[i] = { state: "completed", badgeText: "Selesai" };
      continue;
    }

    if (i < activeIndex) {
      states[i] = { state: "completed", badgeText: "Selesai" };
    } else if (i === activeIndex) {
      states[i] = { state: activeMode, badgeText: activeBadge };
    } else {
      states[i] = { state: "upcoming", badgeText: "Menunggu Tahap Sebelumnya" };
    }
  }

  return { activeStepIndex: activeIndex, states };
}

function getInstructionBanner(submission: BillingSubmission): {
  tone: "info" | "warning" | "success" | "danger";
  title: string;
  description: string;
} {
  const stage = submission.current_stage;

  if (stage === "WAITING_HARDCOPY" || submission.precheck_status === "Pass" && stage === "PRE_CHECK") {
    return {
      tone: "warning",
      title:
        "Instruksi Kirim Berkas Fisik (Hardcopy) — Timer SLA Internal Di-Pause",
      description: `Pre-Check softcopy Anda telah dinyatakan PASS. Silakan kirimkan berkas fisik asli (Invoice asli bermeterai, Faktur Pajak, dan BAST asli) ke Loket Penerimaan Dokumen Accelera dengan mencantumkan Nomor Agenda: ${submission.agenda_no} pada amplop dokumen.`,
    };
  }

  if (
    stage === "REVISION_SOFTCOPY" ||
    stage === "REVISION_HARDCOPY" ||
    stage === "REVISION_PIC" ||
    stage === "REVISION_ACCOUNTING" ||
    submission.final_status === "Menunggu Mitra"
  ) {
    return {
      tone: "danger",
      title: `Temuan Pemeriksaan / Permintaan Revisi (${STAGE_LABELS[stage]})`,
      description:
        submission.findings?.trim() ||
        "Terdapat catatan ketidaklengkapan atau ketidaksesuaian pada dokumen tagihan Anda. Mohon segera perbaiki dokumen sesuai catatan pemeriksa agar proses SLA dapat dilanjutkan.",
    };
  }

  if (stage === "COMPLETED" || submission.final_status === "Selesai") {
    return {
      tone: "success",
      title: "Verifikasi Selesai & Surat Permintaan Pembayaran (SPP) Terbit",
      description:
        "Seluruh tahapan verifikasi dan validasi telah selesai. Dokumen SPP telah diterbitkan dan diteruskan ke bagian Keuangan untuk proses pencairan pembayaran.",
    };
  }

  if (stage === "CANCELLED" || submission.final_status === "Dibatalkan") {
    return {
      tone: "danger",
      title: "Pengajuan Tagihan Dibatalkan",
      description:
        submission.findings?.trim() ||
        "Pengajuan tagihan ini telah dibatalkan. Silakan buat pengajuan baru apabila diperlukan.",
    };
  }

  return {
    tone: "info",
    title: `Sedang Diproses pada Tahap: ${STAGE_LABELS[stage]}`,
    description:
      "Dokumen penagihan Anda telah diterima dan sedang berada dalam antrean pemeriksaan tim internal Accelera (Target Total SLA Internal: 6 Hari Kerja).",
  };
}

async function MitraSubmissionDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireRole([
    "mitra",
    "admin_accelera",
    "pic_usaha",
    "akuntansi",
    "divisi_usaha",
    "super_admin",
  ]);

  const supabase = await createClient();

  // Query dengan RLS: Mitra A otomatis gagal (null) bila mencoba membuka ID pengajuan milik Mitra B
  const { data: submission, error: subError } = await supabase
    .from("billing_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (subError || !submission) {
    notFound();
  }

  const [
    { data: vendor },
    { data: documents },
    { data: stageLogs },
    { data: sppDoc },
  ] = await Promise.all([
    supabase
      .from("vendors")
      .select("*")
      .eq("id", submission.vendor_id)
      .maybeSingle(),
    supabase
      .from("submission_documents")
      .select("*")
      .eq("submission_id", submission.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("stage_logs")
      .select("*")
      .eq("submission_id", submission.id)
      .order("entered_at", { ascending: false }),
    supabase
      .from("spp_documents")
      .select("*")
      .eq("submission_id", submission.id)
      .maybeSingle(),
  ]);

  const { states: stepStates } = resolveStepStates(submission);
  const banner = getInstructionBanner(submission);
  const paused =
    isStagePaused(submission.current_stage) ||
    submission.final_status === "Menunggu Mitra";

  const bannerClasses = {
    info: "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-200",
    warning:
      "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
    danger:
      "border-destructive/40 bg-destructive/10 text-destructive",
    success:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
  }[banner.tone];

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/mitra"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Kembali ke Daftar Tagihan
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-2xl font-bold tracking-tight">
              {submission.agenda_no}
            </h1>
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
            {paused && (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300"
              >
                <PauseCircle className="size-3" />
                Timer SLA Di-Pause (Menunggu Mitra)
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            No. Invoice: <strong>{submission.invoice_no}</strong> •{" "}
            {submission.work_type}
          </p>
        </div>

        {vendor && (
          <div className="flex items-center gap-2 rounded-xl border bg-background px-3.5 py-2 text-xs">
            <Building2 className="size-4 text-primary" />
            <div>
              <p className="font-semibold">{vendor.name}</p>
              <p className="text-[11px] text-muted-foreground">
                NPWP: {vendor.npwp || "-"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* BANNER INSTRUKSI / TEMUAN REVISI */}
      <div
        className={`flex items-start gap-3 rounded-xl border p-4 ${bannerClasses}`}
      >
        {banner.tone === "warning" || banner.tone === "danger" ? (
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
        ) : banner.tone === "success" ? (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
        ) : (
          <Info className="mt-0.5 size-5 shrink-0" />
        )}
        <div className="space-y-1 text-sm">
          <p className="font-semibold">{banner.title}</p>
          <p className="text-xs leading-relaxed opacity-90">
            {banner.description}
          </p>
          {submission.findings && (
            <div className="mt-2 rounded-lg border border-current/20 bg-background/60 p-2.5 text-xs">
              <strong>Catatan Pemeriksa:</strong> {submission.findings}
            </div>
          )}
        </div>
      </div>

      {/* VISUAL TIMELINE STEPPER 6 TAHAP */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            Visual Timeline Progres Verifikasi (6 Tahap)
          </CardTitle>
          <CardDescription>
            Alur berurutan tanpa lompatan tahap dari Input Softcopy hingga
            Penerbitan SPP Digital
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-6">
            {SIX_TIMELINE_STEPS.map((step) => {
              const info = stepStates[step.stepNumber];
              const isCompleted = info.state === "completed";
              const isActive = info.state === "active";
              const isRevision = info.state === "revision";
              const isWaiting = info.state === "waiting";
              const isCancelled = info.state === "cancelled";

              return (
                <div
                  key={step.stepNumber}
                  className={`relative flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                    isCompleted
                      ? "border-emerald-500/40 bg-emerald-500/5"
                      : isActive
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : isRevision
                      ? "border-destructive/50 bg-destructive/5 ring-2 ring-destructive/20"
                      : isWaiting
                      ? "border-amber-500/50 bg-amber-500/10 ring-2 ring-amber-500/20"
                      : isCancelled
                      ? "border-destructive/30 bg-muted/40 opacity-75"
                      : "border-border bg-muted/20 opacity-70"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                          isCompleted
                            ? "bg-emerald-600 text-white"
                            : isActive
                            ? "bg-primary text-primary-foreground"
                            : isRevision || isCancelled
                            ? "bg-destructive text-white"
                            : isWaiting
                            ? "bg-amber-500 text-white"
                            : "bg-muted-foreground/20 text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : isRevision || isCancelled ? (
                          <XCircle className="size-3.5" />
                        ) : (
                          step.stepNumber
                        )}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        {step.slaLabel}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-bold leading-snug">
                        {step.title}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {step.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-border/60">
                    <Badge
                      variant="outline"
                      className={`w-full justify-center text-[10px] ${
                        isCompleted
                          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : isActive
                          ? "border-primary/30 bg-primary/15 text-primary"
                          : isRevision || isCancelled
                          ? "border-destructive/30 bg-destructive/15 text-destructive"
                          : isWaiting
                          ? "border-amber-500/40 bg-amber-500/20 text-amber-800 dark:text-amber-300"
                          : "text-muted-foreground"
                      }`}
                    >
                      {info.badgeText}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* GRID RINCIAN METADATA & DOKUMEN TERUNGGAH */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* KOLOM KIRI: RINCIAN TAGIHAN & STATUS PEMERIKSAAN */}
        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              Rincian Metadata Tagihan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Nomor Agenda</span>
              <span className="font-mono font-semibold">
                {submission.agenda_no}
              </span>
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
              <span className="max-w-[220px] text-right font-medium">
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
              <span className="text-muted-foreground">Tanggal Softcopy</span>
              <span>{formatDateTimeWIB(submission.softcopy_date)}</span>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Tanggal Hardcopy</span>
              <span>{formatDateTimeWIB(submission.hardcopy_date)}</span>
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
                Verifikasi PIC Usaha
              </span>
              <Badge variant="outline">{submission.verification_status}</Badge>
            </div>
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-muted-foreground">Validasi Akuntansi</span>
              <Badge variant="outline">{submission.validation_status}</Badge>
            </div>
            {submission.target_finish_date && (
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">Target Selesai</span>
                <span>{formatDateWIB(submission.target_finish_date)}</span>
              </div>
            )}
            {submission.notes && (
              <div className="space-y-1 pt-1">
                <span className="text-muted-foreground">Catatan Mitra:</span>
                <p className="rounded-lg border bg-muted/30 p-2.5 leading-relaxed">
                  {submission.notes}
                </p>
              </div>
            )}
            {sppDoc && (
              <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="size-4" />
                  <span>SPP Terbit: {sppDoc.spp_no}</span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  Hash: {sppDoc.qr_verification_hash}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KOLOM KANAN: DAFTAR DOKUMEN TERUNGGAH & RIWAYAT STAGE LOGS */}
        <div className="space-y-6 lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck2 className="size-4 text-primary" />
                Dokumen Terunggah di Google Drive ({(documents ?? []).length})
              </CardTitle>
              <CardDescription>
                Seluruh file bersifat Private di Google Drive dan diakses lewat
                Proxy Stream Terautentikasi.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!documents || documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-xs text-muted-foreground">
                  <PackageCheck className="size-7 stroke-1" />
                  <p>Belum ada dokumen yang tercatat pada pengajuan ini.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-3 text-xs"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">
                            {DOC_CATEGORY_LABELS[doc.category]}
                          </Badge>
                          <span className="truncate font-semibold">
                            {doc.file_name}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            v{doc.version}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{formatBytes(Number(doc.file_size_bytes))}</span>
                          <span>•</span>
                          <span>{formatDateTimeWIB(doc.created_at)}</span>
                        </div>
                      </div>

                      <a
                        href={`/api/documents/${encodeURIComponent(
                          doc.drive_file_id
                        )}/view`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm" className="gap-1.5">
                          Lihat Dokumen
                          <ExternalLink className="size-3.5" />
                        </Button>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* RIWAYAT TRANSISI TAHAP (STAGE LOGS) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4 text-primary" />
                Log Riwayat Tahapan &amp; SLA ({(stageLogs ?? []).length})
              </CardTitle>
              <CardDescription>
                Jejak audit perpindahan tahap dan pencatatan hari kerja SLA
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!stageLogs || stageLogs.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  Belum ada catatan riwayat tahapan.
                </p>
              ) : (
                <div className="space-y-3">
                  {stageLogs.map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border bg-muted/20 p-3 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {STAGE_LABELS[log.to_stage]}
                          </Badge>
                          {log.decision && (
                            <span className="font-semibold">
                              {log.decision}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {formatDateTimeWIB(log.entered_at)}
                        </span>
                      </div>
                      {log.notes && (
                        <p className="mt-1.5 text-muted-foreground">
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

export default function MitraSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Detail &amp; Timeline Tagihan...
        </div>
      }
    >
      <MitraSubmissionDetailContent params={params} />
    </Suspense>
  );
}

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
  FileSpreadsheet,
  History,
  Info,
  Loader2,
  PauseCircle,
  QrCode,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BillingSubmission,
  StageLog,
  SubmissionDocument,
  Vendor,
} from "@/types";
import type { AkuntansiRejectTarget } from "@/app/api/submissions/[id]/transition/route";
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

interface AkuntansiSubmissionInspectClientProps {
  submission: BillingSubmission;
  vendor: Vendor | null;
  documents: SubmissionDocument[];
  stageLogs: StageLog[];
  stageSla: StageSlaIndicator;
}

interface AccountingChecklistState {
  nominalMatch: boolean;
  dppPpnPphMatch: boolean;
  fakturPajakValid: boolean;
  poKontrakMatch: boolean;
}

export function AkuntansiSubmissionInspectClient({
  submission,
  vendor,
  documents,
  stageLogs,
  stageSla,
}: AkuntansiSubmissionInspectClientProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState<
    "akuntansi_approve" | "akuntansi_reject" | null
  >(null);
  const [confirmDecision, setConfirmDecision] = React.useState<
    "akuntansi_approve" | "akuntansi_reject" | null
  >(null);
  const [notes, setNotes] = React.useState<string>(submission.findings ?? "");
  const [rejectTarget, setRejectTarget] =
    React.useState<AkuntansiRejectTarget>("revisi_mitra");
  const [followupPic, setFollowupPic] = React.useState<string>(
    submission.followup_pic ?? "Mitra / Vendor"
  );
  const [targetFinishDate, setTargetFinishDate] = React.useState<string>(
    submission.target_finish_date ?? ""
  );

  const [checklist, setChecklist] = React.useState<AccountingChecklistState>({
    nominalMatch: true,
    dppPpnPphMatch: true,
    fakturPajakValid: true,
    poKontrakMatch: true,
  });

  // Pilih dokumen fokus di DocumentViewer (Invoice, Faktur Pajak, PO/Kontrak, BAST)
  const [selectedDocId, setSelectedDocId] = React.useState<string | null>(
    () => {
      const latestInvoice = documents.find(
        (d) => d.is_latest && d.category === "INVOICE"
      );
      return latestInvoice?.id ?? documents[0]?.id ?? null;
    }
  );

  const [prevFindings, setPrevFindings] = React.useState<string | null>(
    submission.findings
  );
  if (submission.findings !== prevFindings) {
    setPrevFindings(submission.findings);
    setNotes(submission.findings ?? "");
  }

  const stage = submission.current_stage;
  const isActionable = stage === "ACCOUNTING_APPROVAL";
  const paused =
    isStagePaused(stage) || submission.final_status === "Menunggu Mitra";

  const allChecklistChecked =
    checklist.nominalMatch &&
    checklist.dppPpnPphMatch &&
    checklist.fakturPajakValid &&
    checklist.poKontrakMatch;

  function requestAkuntansiDecision(
    action: "akuntansi_approve" | "akuntansi_reject"
  ) {
    if (action === "akuntansi_approve" && !allChecklistChecked) {
      toast.error(
        "Pastikan seluruh item pada Panel Checklist Validasi Akuntansi & Pajak telah dicentang sebelum menyatakan Validasi Lulus."
      );
      return;
    }
    if (action === "akuntansi_reject" && !notes.trim()) {
      toast.error(
        "Rincian temuan wajib diisi apabila Validasi Akuntansi Tidak Lulus."
      );
      return;
    }
    setConfirmDecision(action);
  }

  async function handleAkuntansiDecision(
    action: "akuntansi_approve" | "akuntansi_reject"
  ) {
    if (action === "akuntansi_approve" && !allChecklistChecked) {
      toast.error(
        "Pastikan seluruh item pada Panel Checklist Validasi Akuntansi & Pajak telah dicentang sebelum menyatakan Validasi Lulus."
      );
      return;
    }

    if (action === "akuntansi_reject" && !notes.trim()) {
      toast.error(
        "Rincian temuan wajib diisi apabila Validasi Akuntansi Tidak Lulus."
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
            reject_target: rejectTarget,
            followup_pic:
              action === "akuntansi_reject"
                ? followupPic.trim() ||
                  (rejectTarget === "return_pic"
                    ? "PIC Usaha"
                    : "Mitra / Vendor")
                : null,
            target_finish_date:
              action === "akuntansi_reject"
                ? targetFinishDate.trim() || null
                : null,
          }),
        }
      );

      const json = (await response.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!response.ok || !json.ok) {
        toast.error(json.error ?? "Gagal memproses keputusan Akuntansi.");
        return;
      }

      if (action === "akuntansi_approve") {
        toast.success(
          "Validasi Akuntansi LULUS! Pengajuan diteruskan ke tahap Penyusunan SPP (SLA: 1 Hari Kerja)."
        );
      } else if (rejectTarget === "return_pic") {
        toast.success(
          "Validasi Tidak Lulus: Pengajuan dikembalikan ke PIC Usaha untuk koordinasi internal."
        );
      } else {
        toast.success(
          "Validasi Tidak Lulus: Pengajuan dikembalikan untuk Revisi Mitra / Koordinasi Admin Accelera (SLA di-PAUSE)."
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
        eyebrow={`Validasi Akuntansi & Pajak • ${STAGE_LABELS[stage]}`}
        title={`Validasi Keuangan ${submission.agenda_no}`}
        purpose="Layar split-screen validasi perpajakan dan akuntansi untuk menyandingkan Invoice, e-Faktur Pajak, PO/Kontrak, dan BAST (kiri) dengan 4 item checklist wajib (kanan) sebelum meneruskan ke Penyusunan SPP."
        defaultCollapsed={true}
        tip="Keempat item checklist wajib dicentang agar tombol Validasi Lulus (Ke SPP) aktif."
        topSlot={
          <Link
            href="/akuntansi"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Kembali ke Antrean Validasi Akuntansi
          </Link>
        }
        steps={[
          {
            title: "Pilih Dokumen Fokus",
            description:
              "Gunakan pintasan Invoice, Faktur Pajak, PO/Kontrak, dan BAST di atas viewer kiri.",
            badge: "Langkah 1",
            status: "active",
          },
          {
            title: "Verifikasi 4 Checklist",
            description:
              "Pastikan nominal, perhitungan DPP/PPN/PPh, seri Faktur Pajak, dan referensi PO/BAST sesuai.",
            badge: "Langkah 2",
          },
          {
            title: "Putuskan Lulus / Temuan",
            description:
              "Klik Validasi Lulus untuk meneruskan ke SPP (1 HK), atau pilih tujuan pengembalian terarah bila ada temuan.",
            badge: "SLA 2 HK",
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
                  SLA Akuntansi: {stageSla.label}
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

            {/* Baris 2: Info Vendor & Tombol Aksi */}
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
              {stage === "SPP_PROCESSING" && (
                <Link href="/spp">
                  <Button size="default" className="gap-1.5 text-xs">
                    <QrCode className="size-4" />
                    Buka Meja Penerbitan SPP
                  </Button>
                </Link>
              )}
            </div>
          </div>
        }
      />

      {/* SPLIT-SCREEN DESKTOP 2 KOLOM */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* KOLOM KIRI (55%): DOCUMENT VIEWER */}
        <div className="w-full lg:sticky lg:top-6 lg:w-[55%]">
          <DocumentViewer
            documents={documents}
            selectedDocumentId={selectedDocId}
            onSelectDocument={(doc) => setSelectedDocId(doc.id)}
          />
        </div>

        {/* KOLOM KANAN (45%): PANEL CHECKLIST VALIDASI AKUNTANSI & PAJAK */}
        <div className="w-full space-y-5 lg:w-[45%]">
          {/* 1. PANEL CHECKLIST VALIDASI AKUNTANSI & PAJAK */}
          <Card className="border-brand-teal/35 shadow-xs">
            <CardHeader className="border-b border-border bg-brand-teal/8">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="size-4 text-brand-teal" />
                  Panel Checklist Validasi Akuntansi &amp; Pajak
                </CardTitle>
                <Badge variant="default" className="text-xs">
                  Batas SLA: 2 Hari Kerja
                </Badge>
              </div>
              <CardDescription>
                Periksa keempat aspek perpajakan &amp; akuntansi di bawah ini
                dengan menyandingkan dokumen di layar kiri.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Ringkasan Nilai & NPWP */}
              <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    Mitra &amp; NPWP
                  </span>
                  <span className="font-semibold">
                    {vendor?.name ?? "-"} (NPWP: {vendor?.npwp || "-"})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    No. Invoice / PO
                  </span>
                  <span className="font-semibold">
                    {submission.invoice_no} / {submission.contract_po_no || "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-1.5">
                  <span className="text-muted-foreground">Nilai Tagihan</span>
                  <span className="font-mono text-sm font-bold text-primary">
                    {formatRupiah(Number(submission.amount))}
                  </span>
                </div>
                <p className="text-[11px] italic text-muted-foreground">
                  Terbilang: #{formatTerbilangRupiah(Number(submission.amount))}#
                </p>
              </div>

              {/* 4 ITEM CHECKLIST VALIDASI AKUNTANSI & PAJAK */}
              <div className="space-y-2">
                <p className="text-xs font-bold">
                  Checklist Pemeriksaan Wajib Akuntansi &amp; Perpajakan:
                </p>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-background p-2.5 text-xs hover:bg-muted/40">
                  <input
                    type="checkbox"
                    disabled={!isActionable || submitting !== null}
                    checked={checklist.nominalMatch}
                    onChange={(e) =>
                      setChecklist((prev) => ({
                        ...prev,
                        nominalMatch: e.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 rounded border-input accent-primary"
                  />
                  <div>
                    <p className="font-semibold">
                      1. Kesesuaian Nominal Tagihan
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Nominal angka &amp; terbilang pada Invoice sesuai dengan
                      nilai pengajuan ({formatRupiah(Number(submission.amount))}
                      ) dan BAST.
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-background p-2.5 text-xs hover:bg-muted/40">
                  <input
                    type="checkbox"
                    disabled={!isActionable || submitting !== null}
                    checked={checklist.dppPpnPphMatch}
                    onChange={(e) =>
                      setChecklist((prev) => ({
                        ...prev,
                        dppPpnPphMatch: e.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 rounded border-input accent-primary"
                  />
                  <div>
                    <p className="font-semibold">
                      2. Perhitungan DPP / PPN / PPh
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Dasar Pengenaan Pajak (DPP), tarif PPN, serta pemotongan
                      PPh (PPh 23 / PPh Final / PPh 21) telah dihitung secara
                      tepat.
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-background p-2.5 text-xs hover:bg-muted/40">
                  <input
                    type="checkbox"
                    disabled={!isActionable || submitting !== null}
                    checked={checklist.fakturPajakValid}
                    onChange={(e) =>
                      setChecklist((prev) => ({
                        ...prev,
                        fakturPajakValid: e.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 rounded border-input accent-primary"
                  />
                  <div>
                    <p className="font-semibold">
                      3. Nomor &amp; Tanggal Faktur Pajak (e-Faktur)
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Nomor seri Faktur Pajak, tanggal terbit, serta identitas
                      NPWP lawan transaksi valid dan sesuai ketentuan
                      perpajakan.
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-background p-2.5 text-xs hover:bg-muted/40">
                  <input
                    type="checkbox"
                    disabled={!isActionable || submitting !== null}
                    checked={checklist.poKontrakMatch}
                    onChange={(e) =>
                      setChecklist((prev) => ({
                        ...prev,
                        poKontrakMatch: e.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 rounded border-input accent-primary"
                  />
                  <div>
                    <p className="font-semibold">
                      4. Kesesuaian PO / Kontrak / SPK &amp; BAST
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Termin pembayaran, nomor referensi PO/Kontrak (
                      {submission.contract_po_no || "-"}), dan berita acara
                      penyelesaian pekerjaan telah sesuai.
                    </p>
                  </div>
                </label>
              </div>

              {isActionable ? (
                <div className="space-y-4 border-t pt-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="akuntansi-findings">
                      Catatan Validasi / Rincian Temuan Pajak &amp; Akuntansi{" "}
                      <span className="text-[11px] font-normal text-destructive">
                        (Wajib diisi jika Tidak Lulus)
                      </span>
                    </Label>
                    <Textarea
                      id="akuntansi-findings"
                      rows={3}
                      disabled={submitting !== null}
                      placeholder="Tuliskan rincian temuan apabila tidak lulus (contoh: Tarif PPN atau kode seri Faktur Pajak belum sesuai / perhitungan DPP selisih)..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>

                  {/* TUJUAN PENGEMBALIAN TERARAH SAAT REJECT */}
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2 text-xs">
                    <Label
                      htmlFor="reject-target-select"
                      className="text-xs font-bold text-amber-900 dark:text-amber-300"
                    >
                      Tujuan Pengembalian Terarah (Jika Validasi Tidak Lulus):
                    </Label>
                    <select
                      id="reject-target-select"
                      disabled={submitting !== null}
                      value={rejectTarget}
                      onChange={(e) => {
                        const next = e.target.value as AkuntansiRejectTarget;
                        setRejectTarget(next);
                        setFollowupPic(
                          next === "return_pic" ? "PIC Usaha" : "Mitra / Vendor"
                        );
                      }}
                      className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-xs font-medium outline-none"
                    >
                      <option value="revisi_mitra">
                        Opsi A: Koordinasi Admin Accelera / Revisi Mitra
                        (REVISION_ACCOUNTING • SLA Di-PAUSE)
                      </option>
                      <option value="return_pic">
                        Opsi B: Kembalikan ke PIC Usaha (PIC_APPROVAL • SLA
                        Internal Aktif)
                      </option>
                    </select>

                    <div className="grid gap-2.5 pt-1 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label
                          htmlFor="akuntansi-followup-pic"
                          className="text-[11px]"
                        >
                          PIC Tindak Lanjut
                        </Label>
                        <Input
                          id="akuntansi-followup-pic"
                          disabled={submitting !== null}
                          value={followupPic}
                          onChange={(e) => setFollowupPic(e.target.value)}
                          className="h-8 bg-background text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor="akuntansi-target-finish"
                          className="text-[11px]"
                        >
                          Target Selesai Tindak Lanjut
                        </Label>
                        <Input
                          id="akuntansi-target-finish"
                          type="date"
                          disabled={submitting !== null}
                          value={targetFinishDate}
                          onChange={(e) => setTargetFinishDate(e.target.value)}
                          className="h-8 bg-background text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      disabled={submitting !== null || !allChecklistChecked}
                      onClick={() =>
                        requestAkuntansiDecision("akuntansi_approve")
                      }
                      className="w-full gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {submitting === "akuntansi_approve" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      Validasi Lulus (Ke SPP)
                    </Button>

                    <Button
                      type="button"
                      variant="destructive"
                      disabled={submitting !== null}
                      onClick={() =>
                        requestAkuntansiDecision("akuntansi_reject")
                      }
                      className="w-full gap-1.5"
                    >
                      {submitting === "akuntansi_reject" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <XCircle className="size-4" />
                      )}
                      Validasi Tidak Lulus / Temuan
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-xs">
                  <Info className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Tahap Saat Ini: {STAGE_LABELS[stage]} (Status Validasi:{" "}
                      {submission.validation_status})
                    </p>
                    <p className="text-muted-foreground">
                      Keputusan Validasi Akuntansi hanya dapat diambil ketika
                      pengajuan berada pada tahap{" "}
                      <strong>Approval Akuntansi</strong>.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. RINGKASAN VERIFIKASI SEBELUMNYA */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="size-4 text-primary" />
                Ringkasan Hasil Verifikasi Sebelumnya
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">
                  Pre-Check Softcopy
                </span>
                <Badge variant="outline">{submission.precheck_status}</Badge>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">
                  Cek Fisik Hardcopy
                </span>
                <Badge variant="outline">{submission.physical_status}</Badge>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-muted-foreground">
                  Approval PIC Usaha
                </span>
                <Badge variant="outline">
                  {submission.verification_status}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Validasi Akuntansi
                </span>
                <Badge variant="outline">{submission.validation_status}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* 3. JEJAK AUDIT STAGE LOGS */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4 text-primary" />
                Jejak Audit Transisi &amp; SLA ({stageLogs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
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
              {confirmDecision === "akuntansi_approve"
                ? "Nyatakan Validasi Akuntansi Lulus?"
                : "Nyatakan Validasi Tidak Lulus?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDecision === "akuntansi_approve"
                ? `Seluruh aspek pajak & keuangan pada ${submission.agenda_no} akan dinyatakan Lulus dan diteruskan ke tahap Penerbitan SPP (Target SLA: 1 Hari Kerja).`
                : rejectTarget === "return_pic"
                ? `Pengajuan ${submission.agenda_no} akan dikembalikan ke PIC Usaha untuk koordinasi internal.`
                : `Pengajuan ${submission.agenda_no} akan dikembalikan untuk Revisi Mitra / Koordinasi Admin Accelera (Timer SLA di-PAUSE).`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting !== null}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              variant={
                confirmDecision === "akuntansi_approve"
                  ? "default"
                  : "destructive"
              }
              disabled={submitting !== null}
              onClick={() => {
                if (!confirmDecision) return;
                const actionToRun = confirmDecision;
                setConfirmDecision(null);
                void handleAkuntansiDecision(actionToRun);
              }}
            >
              {confirmDecision === "akuntansi_approve"
                ? "Ya, Validasi Lulus"
                : "Ya, Kembalikan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

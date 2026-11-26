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
  FileText,
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
  DocCategory,
  StageLog,
  SubmissionDocument,
  Vendor,
} from "@/types";
import type { AkuntansiRejectTarget } from "@/app/api/submissions/[id]/transition/route";
import type { StageSlaIndicator } from "@/lib/sla";
import {
  DOC_CATEGORY_LABELS,
  formatDateTimeWIB,
  formatRupiah,
  getFinalStatusBadgeClass,
  getSlaStatusBadgeClass,
  STAGE_LABELS,
} from "@/lib/constants";
import { formatTerbilangRupiah } from "@/lib/format-terbilang";
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

const PRIORITY_CATEGORIES: DocCategory[] = [
  "INVOICE",
  "FAKTUR_PAJAK",
  "PO_KONTRAK",
  "BAST",
];

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
  const [notes, setNotes] = React.useState<string>(submission.findings ?? "");
  const [rejectTarget, setRejectTarget] =
    React.useState<AkuntansiRejectTarget>("revisi_mitra");

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

  React.useEffect(() => {
    setNotes(submission.findings ?? "");
  }, [submission.findings]);

  const stage = submission.current_stage;
  const isActionable = stage === "ACCOUNTING_APPROVAL";
  const paused =
    isStagePaused(stage) || submission.final_status === "Menunggu Mitra";

  const allChecklistChecked =
    checklist.nominalMatch &&
    checklist.dppPpnPphMatch &&
    checklist.fakturPajakValid &&
    checklist.poKontrakMatch;

  function focusCategoryDoc(cat: DocCategory) {
    const target =
      documents.find((d) => d.category === cat && d.is_latest) ??
      documents.find((d) => d.category === cat);
    if (target) {
      setSelectedDocId(target.id);
    } else {
      toast.info(
        `Tidak ada dokumen kategori ${DOC_CATEGORY_LABELS[cat]} pada pengajuan ini.`
      );
    }
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
    <div className="space-y-4">
      {/* TOP BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background p-4 shadow-2xs">
        <div className="space-y-1">
          <Link
            href="/akuntansi"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Kembali ke Antrean Validasi Akuntansi
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
                <Clock className="size-3" />
                SLA Akuntansi: {stageSla.label}
              </Badge>
            )}
            {paused && (
              <Badge
                variant="outline"
                className="gap-1 border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-300"
              >
                <PauseCircle className="size-3" />
                SLA Di-PAUSE
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/submissions/${submission.id}/pdf?type=checksheet&download=1`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="size-3.5" />
              Unduh PDF Lembar Hasil Cek
            </Button>
          </a>

          {stage === "SPP_PROCESSING" && (
            <Link href="/spp">
              <Button size="sm" className="gap-1.5 text-xs">
                <QrCode className="size-3.5" />
                Buka Meja Penerbitan SPP
              </Button>
            </Link>
          )}

          {vendor && (
            <div className="flex items-center gap-2.5 rounded-xl border bg-muted/30 px-3.5 py-2 text-xs">
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
      </div>

      {/* SPLIT-SCREEN DESKTOP 2 KOLOM */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* KOLOM KIRI (55%): DOCUMENT VIEWER (FOKUS INVOICE, FAKTUR PAJAK, PO/KONTRAK, BAST) */}
        <div className="w-full space-y-2.5 lg:w-[55%] lg:sticky lg:top-18">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-background px-3 py-2 text-xs">
            <span className="font-semibold text-muted-foreground">
              Fokus Dokumen Pajak &amp; Keuangan:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {PRIORITY_CATEGORIES.map((cat) => {
                const doc = documents.find(
                  (d) => d.category === cat && d.is_latest
                );
                const isSelected = Boolean(doc && doc.id === selectedDocId);
                return (
                  <Button
                    key={cat}
                    type="button"
                    size="xs"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => focusCategoryDoc(cat)}
                    disabled={!doc}
                    className="gap-1"
                  >
                    <FileText className="size-3" />
                    {DOC_CATEGORY_LABELS[cat]}
                    {doc ? ` (v${doc.version})` : " (Kosong)"}
                  </Button>
                );
              })}
            </div>
          </div>

          <DocumentViewer
            documents={documents}
            selectedDocumentId={selectedDocId}
            onSelectDocument={(doc) => setSelectedDocId(doc.id)}
          />
        </div>

        {/* KOLOM KANAN (45%): PANEL CHECKLIST VALIDASI AKUNTANSI & PAJAK */}
        <div className="w-full space-y-5 lg:w-[45%]">
          {/* 1. PANEL CHECKLIST VALIDASI AKUNTANSI & PAJAK */}
          <Card className="border-primary/40 shadow-xs">
            <CardHeader className="border-b bg-primary/5 pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="size-4 text-primary" />
                  Panel Checklist Validasi Akuntansi &amp; Pajak
                </CardTitle>
                <Badge variant="default" className="text-[10px]">
                  Batas SLA: 2 Hari Kerja
                </Badge>
              </div>
              <CardDescription>
                Periksa keempat aspek perpajakan &amp; akuntansi di bawah ini
                dengan menyandingkan dokumen di layar kiri.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-4">
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
                      onChange={(e) =>
                        setRejectTarget(
                          e.target.value as AkuntansiRejectTarget
                        )
                      }
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
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      disabled={submitting !== null || !allChecklistChecked}
                      onClick={() =>
                        handleAkuntansiDecision("akuntansi_approve")
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
                        handleAkuntansiDecision("akuntansi_reject")
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
    </div>
  );
}

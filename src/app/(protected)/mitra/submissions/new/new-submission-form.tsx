"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  FileCheck,
  FileImage,
  FileText,
  HardDriveUpload,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import type { DocCategory, Vendor } from "@/types";
import {
  DOC_CATEGORY_META,
  formatBytes,
  formatNumberInputRupiah,
  formatRupiah,
  parseRupiahToNumber,
} from "@/lib/constants";
import {
  compressImageIfNeeded,
  uploadFileToGoogleDriveResumable,
} from "@/lib/image-compression";
import { cn } from "@/lib/utils";
import { PageGuide } from "@/components/layout/page-guide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface StagedDocumentItem {
  localId: string;
  category: DocCategory;
  file: File;
  originalSizeBytes: number;
  finalSizeBytes: number;
  wasCompressed: boolean;
  progress: number;
  status: "ready" | "uploading" | "done" | "error";
  driveFileId?: string;
  errorMessage?: string;
}

interface NewSubmissionFormProps {
  vendor: Vendor | null;
  availableVendors?: Vendor[];
  isInternalCreator?: boolean;
}

export function NewSubmissionForm({
  vendor,
  availableVendors = [],
  isInternalCreator = false,
}: NewSubmissionFormProps) {
  const router = useRouter();

  // Form Metadata Tagihan
  const [selectedVendorId, setSelectedVendorId] = React.useState<string>(
    vendor?.id ?? availableVendors[0]?.id ?? ""
  );
  const [invoiceNo, setInvoiceNo] = React.useState("");
  const [workType, setWorkType] = React.useState("");
  const [contractPoNo, setContractPoNo] = React.useState("");
  const [amountFormatted, setAmountFormatted] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // Multi-File Uploader State per Kategori
  const [stagedFiles, setStagedFiles] = React.useState<StagedDocumentItem[]>(
    []
  );
  const [compressingCategory, setCompressingCategory] =
    React.useState<DocCategory | null>(null);
  const [draggingCategory, setDraggingCategory] =
    React.useState<DocCategory | null>(null);
  const [replacingItem, setReplacingItem] = React.useState<{
    localId: string;
    category: DocCategory;
  } | null>(null);
  const replaceInputRef = React.useRef<HTMLInputElement | null>(null);

  // Submit & Resumable Upload Pipeline State
  const [submitting, setSubmitting] = React.useState(false);
  const [submitStepText, setSubmitStepText] = React.useState<string | null>(
    null
  );

  const numericAmount = React.useMemo(
    () => parseRupiahToNumber(amountFormatted),
    [amountFormatted]
  );

  function getFilesByCategory(category: DocCategory): StagedDocumentItem[] {
    return stagedFiles.filter((f) => f.category === category);
  }

  async function handleSelectFiles(
    category: DocCategory,
    fileList: FileList | null
  ) {
    if (!fileList || fileList.length === 0) return;
    const rawFiles = Array.from(fileList);

    setCompressingCategory(category);
    try {
      const additions: StagedDocumentItem[] = [];

      for (const rawFile of rawFiles) {
        const lowerName = rawFile.name.toLowerCase();
        const hasValidExt = ALLOWED_EXTENSIONS.some((ext) =>
          lowerName.endsWith(ext)
        );
        const hasValidMime = ALLOWED_MIMES.has(rawFile.type.toLowerCase());

        if (!hasValidExt && !hasValidMime) {
          toast.error(
            `File "${rawFile.name}" ditolak. Hanya format .pdf, .jpg, .jpeg, atau .png yang diizinkan.`
          );
          continue;
        }

        // Lakukan kompresi canvas otomatis bila file berupa foto (.jpg/.png) > 1 MB
        const compressedResult = await compressImageIfNeeded(rawFile);
        const processedFile = compressedResult.file;

        if (processedFile.size > MAX_FILE_SIZE_BYTES) {
          toast.error(
            `File "${rawFile.name}" (${formatBytes(
              processedFile.size
            )}) melebihi batas maksimal 5 MB per file.`
          );
          continue;
        }

        if (compressedResult.wasCompressed) {
          toast.success(
            `Foto "${rawFile.name}" otomatis dikompresi dari ${formatBytes(
              compressedResult.originalSizeBytes
            )} menjadi ${formatBytes(compressedResult.finalSizeBytes)}.`
          );
        }

        additions.push({
          localId: `${category}-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 7)}`,
          category,
          file: processedFile,
          originalSizeBytes: compressedResult.originalSizeBytes,
          finalSizeBytes: compressedResult.finalSizeBytes,
          wasCompressed: compressedResult.wasCompressed,
          progress: 0,
          status: "ready",
        });
      }

      if (additions.length > 0) {
        setStagedFiles((prev) => [...prev, ...additions]);
      }
    } finally {
      setCompressingCategory(null);
    }
  }

  function handleRemoveFile(localId: string) {
    if (submitting) return;
    setStagedFiles((prev) => prev.filter((item) => item.localId !== localId));
  }

  function triggerReplaceFile(item: StagedDocumentItem) {
    if (submitting || compressingCategory !== null) return;
    setReplacingItem({ localId: item.localId, category: item.category });
    replaceInputRef.current?.click();
  }

  async function handleReplaceFileChange(fileList: FileList | null) {
    if (!replacingItem || !fileList || fileList.length === 0) {
      setReplacingItem(null);
      return;
    }

    const rawFile = fileList[0];
    const lowerName = rawFile.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) =>
      lowerName.endsWith(ext)
    );
    const hasValidMime = ALLOWED_MIMES.has(rawFile.type.toLowerCase());

    if (!hasValidExt && !hasValidMime) {
      toast.error(
        `File "${rawFile.name}" ditolak. Hanya format .pdf, .jpg, .jpeg, atau .png yang diizinkan.`
      );
      setReplacingItem(null);
      return;
    }

    setCompressingCategory(replacingItem.category);
    try {
      const compressedResult = await compressImageIfNeeded(rawFile);
      const processedFile = compressedResult.file;

      if (processedFile.size > MAX_FILE_SIZE_BYTES) {
        toast.error(
          `File "${rawFile.name}" (${formatBytes(
            processedFile.size
          )}) melebihi batas maksimal 5 MB per file.`
        );
        return;
      }

      if (compressedResult.wasCompressed) {
        toast.success(
          `Foto "${rawFile.name}" otomatis dikompresi dari ${formatBytes(
            compressedResult.originalSizeBytes
          )} menjadi ${formatBytes(compressedResult.finalSizeBytes)}.`
        );
      }

      setStagedFiles((prev) =>
        prev.map((item) =>
          item.localId === replacingItem.localId
            ? {
                ...item,
                file: processedFile,
                originalSizeBytes: compressedResult.originalSizeBytes,
                finalSizeBytes: compressedResult.finalSizeBytes,
                wasCompressed: compressedResult.wasCompressed,
                progress: 0,
                status: "ready",
                errorMessage: undefined,
              }
            : item
        )
      );
      toast.success(`File berhasil diganti dengan "${processedFile.name}".`);
    } finally {
      setCompressingCategory(null);
      setReplacingItem(null);
    }
  }

  function updateStagedItem(
    localId: string,
    patch: Partial<StagedDocumentItem>
  ) {
    setStagedFiles((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, ...patch } : item
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedVendorId) {
      toast.error(
        "Akun Anda belum terhubung ke Perusahaan Mitra. Hubungi Admin Accelera."
      );
      return;
    }

    if (!invoiceNo.trim()) {
      toast.error("Nomor Invoice wajib diisi.");
      return;
    }

    if (!workType.trim()) {
      toast.error("Jenis Pekerjaan / Tagihan wajib diisi.");
      return;
    }

    if (numericAmount <= 0) {
      toast.error("Nilai Tagihan (Rp) harus lebih besar dari Rp 0.");
      return;
    }

    // Validasi dokumen wajib: INVOICE dan BAST
    const hasInvoiceDoc = getFilesByCategory("INVOICE").length > 0;
    const hasBastDoc = getFilesByCategory("BAST").length > 0;

    if (!hasInvoiceDoc) {
      toast.error("Dokumen kategori INVOICE wajib diunggah.");
      return;
    }

    if (!hasBastDoc) {
      toast.error("Dokumen kategori BAST wajib diunggah.");
      return;
    }

    setSubmitting(true);
    setSubmitStepText(
      "Membuat Nomor Agenda & menyiapkan folder Google Drive..."
    );

    try {
      // LANGKAH 1: POST /api/submissions
      const createResp = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoice_no: invoiceNo.trim(),
          work_type: workType.trim(),
          contract_po_no: contractPoNo.trim() || null,
          amount: numericAmount,
          notes: notes.trim() || null,
          vendor_id: selectedVendorId,
        }),
      });

      const createJson = (await createResp.json()) as {
        ok: boolean;
        error?: string;
        submission?: {
          id: string;
          agenda_no: string;
          drive_folder_id: string | null;
        };
      };

      if (!createResp.ok || !createJson.ok || !createJson.submission) {
        toast.error(
          createJson.error ?? "Gagal membuat pengajuan tagihan baru."
        );
        setSubmitting(false);
        setSubmitStepText(null);
        return;
      }

      const submission = createJson.submission;

      // LANGKAH 2, 3, 4: Unggah setiap file lewat Google Drive Resumable Upload & simpan metadata
      for (let i = 0; i < stagedFiles.length; i++) {
        const item = stagedFiles[i];
        setSubmitStepText(
          `Mengunggah dokumen (${i + 1}/${stagedFiles.length}): ${
            item.file.name
          }...`
        );
        updateStagedItem(item.localId, {
          status: "uploading",
          progress: 5,
          errorMessage: undefined,
        });

        // 2. Minta Resumable Upload Session URL dari POST /api/uploads/session
        const sessionResp = await fetch("/api/uploads/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submission_id: submission.id,
            category: item.category,
            file_name: item.file.name,
            mime_type: item.file.type || "application/pdf",
            file_size_bytes: item.file.size,
          }),
        });

        const sessionJson = (await sessionResp.json()) as {
          ok: boolean;
          uploadUrl?: string;
          error?: string;
        };

        if (!sessionResp.ok || !sessionJson.ok || !sessionJson.uploadUrl) {
          const errMsg =
            sessionJson.error ??
            `Gagal mendapatkan sesi upload Google Drive untuk ${item.file.name}`;
          updateStagedItem(item.localId, {
            status: "error",
            errorMessage: errMsg,
          });
          throw new Error(errMsg);
        }

        // 3. Unggah biner langsung (PUT) ke Google Drive dengan progress bar
        const driveFile = await uploadFileToGoogleDriveResumable({
          uploadUrl: sessionJson.uploadUrl,
          file: item.file,
          onProgress: (pct) => {
            updateStagedItem(item.localId, { progress: pct });
          },
        });

        // 4. Simpan drive_file_id ke POST /api/submissions/[id]/documents
        const docResp = await fetch(
          `/api/submissions/${submission.id}/documents`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              category: item.category,
              file_name: item.file.name,
              mime_type: item.file.type || "application/pdf",
              file_size_bytes: item.file.size,
              drive_file_id: driveFile.id,
            }),
          }
        );

        const docJson = (await docResp.json()) as {
          ok: boolean;
          error?: string;
        };

        if (!docResp.ok || !docJson.ok) {
          const errMsg =
            docJson.error ??
            `Gagal menyimpan metadata dokumen ${item.file.name}`;
          updateStagedItem(item.localId, {
            status: "error",
            errorMessage: errMsg,
          });
          throw new Error(errMsg);
        }

        updateStagedItem(item.localId, {
          status: "done",
          progress: 100,
          driveFileId: driveFile.id,
        });
      }

      toast.success(
        `Pengajuan Tagihan berhasil dikirim dengan Nomor Agenda: ${submission.agenda_no}`
      );
      router.push(`/mitra/submissions/${submission.id}`);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengunggah dokumen penagihan."
      );
      setSubmitting(false);
      setSubmitStepText(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageGuide
        eyebrow="Formulir Pengajuan Tagihan"
        title="Ajukan Dokumen Tagihan Baru"
        purpose="Gunakan formulir ini untuk mendaftarkan tagihan baru dan mengunggah berkas softcopy pendukung. Setelah terkirim, sistem langsung menerbitkan Nomor Agenda unik dan mengantrekan berkas ke Admin Accelera."
        tip="Dokumen wajib minimal: Invoice dan BAST (format PDF/JPG/PNG, maks. 5 MB per file)."
        topSlot={
          <Link
            href="/mitra"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Kembali ke Daftar Tagihan Mitra
          </Link>
        }
        steps={[
          {
            title: "Isi Metadata Tagihan",
            description:
              "Masukkan No. Invoice unik, No. PO/Kontrak, jenis pekerjaan, dan nominal tagihan (Rp).",
            badge: "Langkah 1",
            status: "active",
          },
          {
            title: "Unggah Softcopy Wajib",
            description:
              "Lampirkan file Invoice & BAST (serta Faktur Pajak / PO bila ada). Foto > 1 MB otomatis dikompresi.",
            badge: "Langkah 2",
          },
          {
            title: "Dapat Nomor Agenda",
            description:
              "Klik Kirim Pengajuan untuk menyimpan file ke Google Drive Private dan menerbitkan No. Agenda.",
            badge: "Langkah 3",
          },
          {
            title: "Tunggu Pre-Check (1 HK)",
            description:
              "Admin memeriksa softcopy Anda. Bila Pass, Anda akan menerima instruksi mengirim berkas fisik.",
            badge: "Langkah 4",
          },
        ]}
        actions={
          vendor ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-subtle/80 px-4 py-2.5 text-xs">
              <Building2 className="size-4 text-brand-teal" />
              <div>
                <p className="font-semibold text-foreground">{vendor.name}</p>
                <p className="text-muted-foreground">
                  NPWP: {vendor.npwp || "-"}
                </p>
              </div>
            </div>
          ) : undefined
        }
      />

      {!vendor && !isInternalCreator && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div>
            <strong>Akun Belum Terhubung ke Vendor:</strong> Profil Anda belum
            memiliki relasi <code>vendor_id</code>. Silakan hubungi Admin
            Accelera untuk mengaitkan akun Anda dengan Perusahaan Mitra.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* BAGIAN 1: METADATA TAGIHAN */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-4 text-brand-teal" />
              1. Informasi &amp; Metadata Tagihan
            </CardTitle>
            <CardDescription>
              Pastikan Nomor Invoice belum pernah digunakan pada pengajuan aktif
              di perusahaan Anda.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {isInternalCreator && availableVendors.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="select-vendor">
                  Perusahaan Mitra / Vendor{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <select
                  id="select-vendor"
                  required
                  disabled={submitting}
                  value={selectedVendorId}
                  onChange={(e) => setSelectedVendorId(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/35 dark:bg-card/70"
                >
                  <option value="">-- Pilih Perusahaan Mitra --</option>
                  {availableVendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} {v.npwp ? `(${v.npwp})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoice-no">
                  No. Invoice <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="invoice-no"
                  required
                  disabled={submitting}
                  placeholder="Contoh: INV/2026/XI/0042"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Segmen pertama nomor invoice akan digunakan pada format Nomor
                  Agenda otomatis.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract-po-no">No. PO / Kontrak / SPK</Label>
                <Input
                  id="contract-po-no"
                  disabled={submitting}
                  placeholder="Contoh: PO-ACC/2026/089"
                  value={contractPoNo}
                  onChange={(e) => setContractPoNo(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="work-type">
                  Jenis Pekerjaan / Tagihan{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="work-type"
                  required
                  disabled={submitting}
                  placeholder="Contoh: Jasa Pemeliharaan Infrastruktur IT Q4"
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount-rp">
                  Nilai Tagihan (Rp) <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                    Rp
                  </span>
                  <Input
                    id="amount-rp"
                    type="text"
                    inputMode="numeric"
                    required
                    disabled={submitting}
                    placeholder="125.000.000"
                    value={amountFormatted}
                    onChange={(e) =>
                      setAmountFormatted(
                        formatNumberInputRupiah(e.target.value)
                      )
                    }
                    className="pl-10 font-mono font-semibold"
                  />
                </div>
                {numericAmount > 0 && (
                  <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Terbaca: {formatRupiah(numericAmount)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="submission-notes">Catatan Tambahan</Label>
              <Textarea
                id="submission-notes"
                rows={3}
                disabled={submitting}
                placeholder="Tambahkan keterangan termin pembayaran, periode layanan, atau informasi penting lainnya..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* BAGIAN 2: MULTI-FILE UPLOADER TERSTRUKTUR */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <HardDriveUpload className="size-4 text-brand-teal" />
                  2. Multi-File Uploader Dokumen Penagihan
                </CardTitle>
                <CardDescription>
                  Format yang didukung: <code>.pdf</code>, <code>.jpg</code>,{" "}
                  <code>.jpeg</code>, <code>.png</code> (Maksimal 5 MB per
                  file).
                </CardDescription>
              </div>
              <Badge variant="secondary" className="gap-1.5 text-xs">
                <Sparkles className="size-3.5 text-brand-teal" />
                Auto-Compress Foto &gt; 1 MB
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <input
              ref={replaceInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => {
                handleReplaceFileChange(e.target.files);
                e.target.value = "";
              }}
            />

            {DOC_CATEGORY_META.map((meta) => {
              const categoryFiles = getFilesByCategory(meta.category);
              const isCompressing = compressingCategory === meta.category;
              const isDragging = draggingCategory === meta.category;
              const inputId = `file-input-${meta.category}`;

              return (
                <div
                  key={meta.category}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!submitting && !isCompressing) {
                      setDraggingCategory(meta.category);
                    }
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    if (draggingCategory === meta.category) {
                      setDraggingCategory(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDraggingCategory(null);
                    if (!submitting && !isCompressing) {
                      handleSelectFiles(meta.category, e.dataTransfer.files);
                    }
                  }}
                  className={cn(
                    "rounded-2xl border-2 border-dashed p-5 transition-all",
                    isDragging
                      ? "border-brand-teal bg-brand-teal/10 ring-2 ring-brand-teal/25"
                      : categoryFiles.length > 0
                      ? "border-emerald-500/45 bg-emerald-500/6"
                      : "border-border bg-surface-subtle/60 hover:border-brand-teal/50 hover:bg-surface-subtle"
                  )}
                >
                  <div className="flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={cn(
                          "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl",
                          isDragging
                            ? "bg-brand-teal text-brand-teal-foreground"
                            : categoryFiles.length > 0
                            ? "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-brand-teal/12 text-brand-teal"
                        )}
                      >
                        <UploadCloud className="size-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {meta.label}
                          </span>
                          {meta.required ? (
                            <Badge variant="default">Wajib</Badge>
                          ) : (
                            <Badge variant="outline">Opsional</Badge>
                          )}
                          {categoryFiles.length > 0 && (
                            <Badge
                              variant="outline"
                              className="border-emerald-500/35 bg-emerald-500/12 text-emerald-700 tabular-nums dark:text-emerald-300"
                            >
                              {categoryFiles.length} file dipilih
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {meta.description}
                        </p>
                        <p className="text-xs text-muted-foreground/90">
                          Seret &amp; lepas file ke area ini, atau klik tombol
                          pilih file (maks. 5 MB).
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <input
                        id={inputId}
                        type="file"
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                        disabled={submitting || isCompressing}
                        onChange={(e) => {
                          handleSelectFiles(meta.category, e.target.files);
                          e.target.value = "";
                        }}
                        className="sr-only"
                      />
                      <label htmlFor={inputId}>
                        <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3.5 text-xs font-semibold text-foreground shadow-2xs transition hover:border-brand-teal/60 hover:bg-accent hover:text-accent-foreground">
                          {isCompressing ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin text-brand-teal" />
                              Mengompresi...
                            </>
                          ) : (
                            <>
                              <Upload className="size-3.5 text-brand-teal" />
                              Pilih File {meta.category}
                            </>
                          )}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Daftar file yang sudah dipilih pada kategori ini */}
                  {categoryFiles.length > 0 && (
                    <div className="mt-4 space-y-2.5 border-t border-border/80 pt-3.5">
                      {categoryFiles.map((item) => {
                        const savedPct =
                          item.wasCompressed && item.originalSizeBytes > 0
                            ? Math.max(
                                1,
                                Math.round(
                                  ((item.originalSizeBytes -
                                    item.finalSizeBytes) /
                                    item.originalSizeBytes) *
                                    100
                                )
                              )
                            : 0;

                        return (
                          <div
                            key={item.localId}
                            className="rounded-xl border border-border bg-card p-3 text-xs shadow-2xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2.5">
                              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                                {item.file.type.startsWith("image/") ? (
                                  <FileImage className="size-4 shrink-0 text-brand-teal" />
                                ) : (
                                  <FileCheck className="size-4 shrink-0 text-primary" />
                                )}
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-foreground">
                                    {item.file.name}
                                  </p>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">
                                    <span className="font-medium text-foreground">
                                      {formatBytes(item.finalSizeBytes)}
                                    </span>
                                    {item.wasCompressed && (
                                      <Badge
                                        variant="outline"
                                        className="border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                      >
                                        Kompresi -{savedPct}% (dari{" "}
                                        {formatBytes(item.originalSizeBytes)})
                                      </Badge>
                                    )}
                                    {item.driveFileId && (
                                      <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                                        • Drive ID:{" "}
                                        {item.driveFileId.slice(0, 10)}...
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {item.status === "done" && (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 border-emerald-500/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                  >
                                    <CheckCircle2 className="size-3" />
                                    Terunggah
                                  </Badge>
                                )}
                                {item.status === "uploading" && (
                                  <span className="font-mono text-xs font-bold text-brand-teal tabular-nums">
                                    {item.progress}%
                                  </span>
                                )}
                                {!submitting && (
                                  <>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="xs"
                                      onClick={() => triggerReplaceFile(item)}
                                      className="gap-1"
                                      title="Ganti file ini"
                                    >
                                      <RefreshCw className="size-3" />
                                      Ganti
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-xs"
                                      onClick={() =>
                                        handleRemoveFile(item.localId)
                                      }
                                      title="Hapus file"
                                    >
                                      <Trash2 className="size-3.5 text-destructive" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Progress Bar Resumable Upload */}
                            {(item.status === "uploading" ||
                              item.status === "done") && (
                              <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full bg-brand-teal transition-all duration-200"
                                  style={{ width: `${item.progress}%` }}
                                />
                              </div>
                            )}

                            {item.errorMessage && (
                              <p className="mt-1.5 text-xs font-medium text-destructive">
                                {item.errorMessage}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>

          <CardFooter className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            <div className="text-sm text-muted-foreground">
              {submitStepText ? (
                <span className="inline-flex items-center gap-2 font-semibold text-primary">
                  <Loader2 className="size-4 animate-spin" />
                  {submitStepText}
                </span>
              ) : (
                <span>
                  Total dokumen siap diunggah:{" "}
                  <strong className="text-foreground">
                    {stagedFiles.length} file
                  </strong>{" "}
                  (Wajib: INVOICE &amp; BAST)
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <Link href="/mitra">
                <Button type="button" variant="outline" disabled={submitting}>
                  Batal
                </Button>
              </Link>
              <Button
                type="submit"
                size="lg"
                disabled={submitting || (!vendor && !isInternalCreator)}
                className="gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Mengirim &amp; Mengunggah...
                  </>
                ) : (
                  <>
                    <HardDriveUpload className="size-4" />
                    Kirim Pengajuan Tagihan
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

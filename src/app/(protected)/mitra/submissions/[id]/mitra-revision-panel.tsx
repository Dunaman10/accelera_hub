"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  History,
  Loader2,
  Send,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type {
  BillingSubmission,
  DocCategory,
  SubmissionDocument,
} from "@/types";
import {
  DOC_CATEGORY_LABELS,
  DOC_CATEGORY_META,
  formatBytes,
  formatDateTimeWIB,
  STAGE_LABELS,
} from "@/lib/constants";
import {
  compressImageIfNeeded,
  uploadFileToGoogleDriveResumable,
} from "@/lib/image-compression";
import { cn } from "@/lib/utils";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png"];
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface MitraRevisionPanelProps {
  submission: BillingSubmission;
  documents: SubmissionDocument[];
}

export function MitraRevisionPanel({
  submission,
  documents,
}: MitraRevisionPanelProps) {
  const router = useRouter();

  const [uploadingCategory, setUploadingCategory] =
    React.useState<DocCategory | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState<number>(0);
  const [uploadedCountInSession, setUploadedCountInSession] =
    React.useState<number>(0);
  const [resubmitNotes, setResubmitNotes] = React.useState<string>("");
  const [resubmitting, setResubmitting] = React.useState<boolean>(false);
  const [confirmResubmitOpen, setConfirmResubmitOpen] = React.useState(false);
  const [draggingCategory, setDraggingCategory] =
    React.useState<DocCategory | null>(null);

  // Kelompokkan dokumen per kategori (terbaru vs riwayat arsip)
  function getCategoryDocs(category: DocCategory) {
    const allInCat = documents
      .filter((d) => d.category === category)
      .sort((a, b) => b.version - a.version);
    const latestDoc = allInCat.find((d) => d.is_latest) ?? allInCat[0] ?? null;
    return { allInCat, latestDoc };
  }

  async function handleUploadRevisionFile(
    category: DocCategory,
    fileList: FileList | null
  ) {
    if (!fileList || fileList.length === 0) return;
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
      return;
    }

    setUploadingCategory(category);
    setUploadProgress(5);

    try {
      // 1. Kompresi otomatis jika gambar > 1 MB
      const compressed = await compressImageIfNeeded(rawFile);
      const processedFile = compressed.file;

      if (processedFile.size > MAX_FILE_SIZE_BYTES) {
        toast.error(
          `File "${rawFile.name}" (${formatBytes(
            processedFile.size
          )}) melebihi batas maksimal 5 MB.`
        );
        return;
      }

      // 2. Minta sesi Google Drive Resumable Upload
      const sessionResp = await fetch("/api/uploads/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submission_id: submission.id,
          category,
          file_name: processedFile.name,
          mime_type: processedFile.type || "application/pdf",
          file_size_bytes: processedFile.size,
        }),
      });

      const sessionJson = (await sessionResp.json()) as {
        ok: boolean;
        uploadUrl?: string;
        error?: string;
      };

      if (!sessionResp.ok || !sessionJson.ok || !sessionJson.uploadUrl) {
        throw new Error(
          sessionJson.error ??
            "Gagal membuat sesi Google Drive Resumable Upload."
        );
      }

      // 3. Unggah biner langsung ke Google Drive
      const driveFile = await uploadFileToGoogleDriveResumable({
        uploadUrl: sessionJson.uploadUrl,
        file: processedFile,
        onProgress: (pct) => setUploadProgress(pct),
      });

      // 4. Simpan versi baru ke submission_documents (otomatis set versi lama is_latest = false & version = old + 1)
      const saveResp = await fetch(
        `/api/submissions/${submission.id}/documents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            category,
            file_name: processedFile.name,
            mime_type: processedFile.type || "application/pdf",
            file_size_bytes: processedFile.size,
            drive_file_id: driveFile.id,
            replace_latest: true,
          }),
        }
      );

      const saveJson = (await saveResp.json()) as {
        ok: boolean;
        document?: SubmissionDocument;
        error?: string;
      };

      if (!saveResp.ok || !saveJson.ok || !saveJson.document) {
        throw new Error(
          saveJson.error ?? "Gagal menyimpan versi dokumen revisi."
        );
      }

      toast.success(
        `Dokumen revisi ${DOC_CATEGORY_LABELS[category]} berhasil diunggah sebagai Versi v${saveJson.document.version}.`
      );
      setUploadedCountInSession((prev) => prev + 1);
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal mengunggah dokumen revisi."
      );
    } finally {
      setUploadingCategory(null);
      setUploadProgress(0);
    }
  }

  async function handleResubmitSubmission() {
    setResubmitting(true);
    try {
      const resp = await fetch(
        `/api/submissions/${submission.id}/transition`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "mitra_resubmit",
            notes:
              resubmitNotes.trim() ||
              "Mitra telah memperbarui dokumen revisi dan mengirim ulang pengajuan.",
          }),
        }
      );

      const json = (await resp.json()) as {
        ok: boolean;
        error?: string;
      };

      if (!resp.ok || !json.ok) {
        toast.error(
          json.error ?? "Gagal mengirim ulang pengajuan tagihan."
        );
        return;
      }

      toast.success(
        "Pengajuan berhasil dikirim ulang! Timer SLA pemeriksaan kembali aktif."
      );
      setResubmitNotes("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan saat mengirim ulang pengajuan."
      );
    } finally {
      setResubmitting(false);
    }
  }

  return (
    <Card className="border-destructive/50 bg-destructive/5 shadow-xs">
      <CardHeader className="border-b border-destructive/20">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <CardTitle className="text-base text-destructive">
                Tindak Lanjut Revisi Dokumen ({STAGE_LABELS[submission.current_stage]})
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                Unggah dokumen pengganti pada kategori yang memerlukan perbaikan,
                lalu klik tombol <strong>&ldquo;Kirim Ulang Pengajuan&rdquo;</strong>{" "}
                di bawah. File versi lama tetap tersimpan aman untuk jejak audit.
              </CardDescription>
            </div>
          </div>

          <Badge variant="destructive" className="text-xs">
            Menunggu Revisi Mitra • SLA Di-Pause
          </Badge>
        </div>

        {/* KOTAK PERINGATAN MERAH CATATAN TEMUAN SPESIFIK DARI PEMERIKSA */}
        <div className="mt-3 rounded-xl border border-destructive/40 bg-card p-4 text-sm">
          <p className="font-bold text-destructive">
            Catatan Temuan / Kekurangan dari Pemeriksa:
          </p>
          <p className="mt-1 leading-relaxed text-foreground">
            {submission.findings?.trim() ||
              "Mohon periksa kembali kelengkapan dan kesesuaian dokumen penagihan Anda sesuai standar verifikasi Accelera."}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-3.5">
        {DOC_CATEGORY_META.map((meta) => {
          const { allInCat, latestDoc } = getCategoryDocs(meta.category);
          const isUploadingThis = uploadingCategory === meta.category;
          const isDraggingThis = draggingCategory === meta.category;
          const inputId = `revision-upload-${meta.category}`;

          return (
            <div
              key={meta.category}
              onDragOver={(e) => {
                e.preventDefault();
                if (uploadingCategory === null && !resubmitting) {
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
                if (uploadingCategory === null && !resubmitting) {
                  handleUploadRevisionFile(meta.category, e.dataTransfer.files);
                }
              }}
              className={cn(
                "rounded-xl border p-3.5 text-xs shadow-2xs transition-colors",
                isDraggingThis
                  ? "border-2 border-dashed border-primary bg-primary/8"
                  : "bg-background"
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">{meta.label}</span>
                    {latestDoc ? (
                      <Badge
                        variant="default"
                        className="h-4 px-1.5 text-[10px]"
                      >
                        Versi Aktif: v{latestDoc.version}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="h-4 px-1.5 text-[10px]"
                      >
                        Belum Ada File
                      </Badge>
                    )}
                    {allInCat.length > 1 && (
                      <Badge
                        variant="secondary"
                        className="h-4 gap-1 px-1.5 text-[10px]"
                      >
                        <History className="size-2.5" />
                        {allInCat.length} versi tercatat
                      </Badge>
                    )}
                  </div>

                  {latestDoc ? (
                    <p className="text-[11px] text-muted-foreground">
                      File terbaru: <strong>{latestDoc.file_name}</strong> (
                      {formatBytes(Number(latestDoc.file_size_bytes))} •{" "}
                      {formatDateTimeWIB(latestDoc.created_at)})
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      {meta.description}
                    </p>
                  )}
                </div>

                <div>
                  <input
                    id={inputId}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    disabled={uploadingCategory !== null || resubmitting}
                    onChange={(e) => {
                      handleUploadRevisionFile(meta.category, e.target.files);
                      e.target.value = "";
                    }}
                    className="sr-only"
                  />
                  <label htmlFor={inputId}>
                    <span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary/20">
                      {isUploadingThis ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Mengunggah ({uploadProgress}%)...
                        </>
                      ) : (
                        <>
                          <Upload className="size-3.5" />
                          Upload Dokumen Revisi
                        </>
                      )}
                    </span>
                  </label>
                </div>
              </div>

              {isUploadingThis && (
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}

        <div className="pt-2">
          <label
            htmlFor="mitra-resubmit-notes"
            className="mb-1.5 block text-xs font-semibold"
          >
            Catatan Perbaikan Mitra (Opsional)
          </label>
          <Textarea
            id="mitra-resubmit-notes"
            rows={2}
            disabled={resubmitting || uploadingCategory !== null}
            placeholder="Contoh: Dokumen BAST versi v2 yang sudah ditandatangani lengkap telah kami unggah..."
            value={resubmitNotes}
            onChange={(e) => setResubmitNotes(e.target.value)}
            className="bg-background text-xs"
          />
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-stretch justify-between gap-3 border-t border-destructive/20 bg-background/80 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {uploadedCountInSession > 0 ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              {uploadedCountInSession} dokumen revisi baru berhasil diunggah pada
              sesi ini.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <FileUp className="size-4 text-primary" />
              Pastikan dokumen revisi telah diunggah sebelum mengirim ulang
              pengajuan.
            </span>
          )}
        </div>

        <Button
          type="button"
          size="lg"
          disabled={resubmitting || uploadingCategory !== null}
          onClick={() => setConfirmResubmitOpen(true)}
          className="gap-2"
        >
          {resubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Mengirim Ulang Pengajuan...
            </>
          ) : (
            <>
              <Send className="size-4" />
              Kirim Ulang Pengajuan
            </>
          )}
        </Button>
      </CardFooter>

      <AlertDialog
        open={confirmResubmitOpen}
        onOpenChange={setConfirmResubmitOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kirim Ulang Pengajuan Revisi?</AlertDialogTitle>
            <AlertDialogDescription>
              Pengajuan <strong>{submission.agenda_no}</strong> akan dikirim
              kembali ke antrean pemeriksaan internal dan timer SLA akan
              kembali aktif berjalan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={resubmitting}
              onClick={() => {
                setConfirmResubmitOpen(false);
                void handleResubmitSubmission();
              }}
            >
              {resubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Ya, Kirim Ulang
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

"use client";

import * as React from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileImage,
  FileText,
  History,
  Maximize2,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { DocCategory, SubmissionDocument } from "@/types";
import {
  DOC_CATEGORY_LABELS,
  DOC_CATEGORY_META,
  formatBytes,
  formatDateTimeWIB,
} from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DocumentViewerProps {
  documents: SubmissionDocument[];
  selectedDocumentId?: string | null;
  onSelectDocument?: (doc: SubmissionDocument) => void;
  className?: string;
}

const ZOOM_STEPS = [50, 75, 100, 125, 150, 200] as const;

export function DocumentViewer({
  documents,
  selectedDocumentId,
  onSelectDocument,
  className,
}: DocumentViewerProps) {
  // Urutkan dokumen agar is_latest = true berada di atas, diikuti version menurun
  const sortedDocs = React.useMemo(() => {
    return [...documents].sort((a, b) => {
      if (a.is_latest !== b.is_latest) {
        return a.is_latest ? -1 : 1;
      }
      if (b.version !== a.version) {
        return b.version - a.version;
      }
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [documents]);

  const [internalSelectedId, setInternalSelectedId] = React.useState<
    string | null
  >(() => sortedDocs[0]?.id ?? null);

  const [activeCategoryFilter, setActiveCategoryFilter] = React.useState<
    DocCategory | "ALL"
  >("ALL");
  const [viewTab, setViewTab] = React.useState<"latest" | "history">("latest");
  const [zoomPercent, setZoomPercent] = React.useState<number>(100);
  const [rotationDeg, setRotationDeg] = React.useState<number>(0);

  const effectiveSelectedId = selectedDocumentId ?? internalSelectedId;

  const activeDoc = React.useMemo(() => {
    if (!sortedDocs.length) return null;
    return (
      sortedDocs.find((d) => d.id === effectiveSelectedId) ?? sortedDocs[0]
    );
  }, [sortedDocs, effectiveSelectedId]);

  // Reset rotasi ketika pindah dokumen
  React.useEffect(() => {
    setRotationDeg(0);
  }, [activeDoc?.id]);

  function handleSelectDoc(doc: SubmissionDocument) {
    setInternalSelectedId(doc.id);
    onSelectDocument?.(doc);
  }

  function handleZoomIn() {
    setZoomPercent((prev) => {
      const next = ZOOM_STEPS.find((step) => step > prev);
      return next ?? 200;
    });
  }

  function handleZoomOut() {
    setZoomPercent((prev) => {
      const reversed = [...ZOOM_STEPS].reverse();
      const next = reversed.find((step) => step < prev);
      return next ?? 50;
    });
  }

  function handleResetTransform() {
    setZoomPercent(100);
    setRotationDeg(0);
  }

  function handleRotateCw() {
    setRotationDeg((prev) => (prev + 90) % 360);
  }

  function handleRotateCcw() {
    setRotationDeg((prev) => (prev - 90 + 360) % 360);
  }

  // Filter daftar dokumen berdasarkan tab ("latest" vs "history") dan filter kategori
  const filteredDocs = React.useMemo(() => {
    return sortedDocs.filter((doc) => {
      if (
        activeCategoryFilter !== "ALL" &&
        doc.category !== activeCategoryFilter
      ) {
        return false;
      }
      if (viewTab === "latest") {
        return doc.is_latest;
      }
      return true;
    });
  }, [sortedDocs, activeCategoryFilter, viewTab]);

  // Versi-versi untuk kategori dokumen yang sedang dibuka
  const categoryVersionHistory = React.useMemo(() => {
    if (!activeDoc) return [];
    return sortedDocs
      .filter((d) => d.category === activeDoc.category)
      .sort((a, b) => b.version - a.version);
  }, [sortedDocs, activeDoc]);

  const isImageDoc = Boolean(
    activeDoc &&
      (activeDoc.mime_type.toLowerCase().startsWith("image/") ||
        /\.(jpg|jpeg|png)$/i.test(activeDoc.file_name))
  );

  // Gunakan endpoint proxy private /api/documents/[documentId]/view
  const streamUrl = activeDoc
    ? `/api/documents/${encodeURIComponent(activeDoc.id)}/view`
    : null;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-background shadow-2xs",
        className
      )}
    >
      {/* HEADER BAR: TAB DAFTAR FILE TERBARU VS RIWAYAT VERSI */}
      <div className="border-b bg-muted/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="xs"
              variant={viewTab === "latest" ? "default" : "outline"}
              onClick={() => setViewTab("latest")}
              className="gap-1"
            >
              <CheckCircle2 className="size-3.5" />
              Dokumen Aktif (
              {sortedDocs.filter((d) => d.is_latest).length})
            </Button>
            <Button
              type="button"
              size="xs"
              variant={viewTab === "history" ? "default" : "outline"}
              onClick={() => setViewTab("history")}
              className="gap-1"
            >
              <History className="size-3.5" />
              Riwayat Versi ({sortedDocs.length})
            </Button>
          </div>

          <Badge variant="outline" className="text-[10px]">
            Private Proxy Stream • No Public Link
          </Badge>
        </div>

        {/* FILTER KATEGORI DOKUMEN */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveCategoryFilter("ALL")}
            className={cn(
              "rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
              activeCategoryFilter === "ALL"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            )}
          >
            Semua Kategori
          </button>
          {DOC_CATEGORY_META.map((meta) => {
            const countInCat = sortedDocs.filter(
              (d) =>
                d.category === meta.category &&
                (viewTab === "history" || d.is_latest)
            ).length;

            return (
              <button
                key={meta.category}
                type="button"
                onClick={() => setActiveCategoryFilter(meta.category)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                  activeCategoryFilter === meta.category
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{DOC_CATEGORY_LABELS[meta.category]}</span>
                <span className="rounded-full bg-muted px-1.5 text-[10px]">
                  {countInCat}
                </span>
              </button>
            );
          })}
        </div>

        {/* HORIZONTAL FILE SELECTOR PILLS */}
        {filteredDocs.length > 0 && (
          <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
            {filteredDocs.map((doc) => {
              const isSelected = activeDoc?.id === doc.id;
              const isImg =
                doc.mime_type.toLowerCase().startsWith("image/") ||
                /\.(jpg|jpeg|png)$/i.test(doc.file_name);

              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => handleSelectDoc(doc)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 font-semibold text-foreground ring-1 ring-primary/30"
                      : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  )}
                >
                  {isImg ? (
                    <FileImage className="size-3.5 shrink-0 text-sky-600" />
                  ) : (
                    <FileText className="size-3.5 shrink-0 text-primary" />
                  )}
                  <div className="max-w-[175px]">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold uppercase text-primary">
                        {DOC_CATEGORY_LABELS[doc.category]}
                      </span>
                      <Badge
                        variant={doc.is_latest ? "default" : "secondary"}
                        className="h-4 px-1 text-[9px]"
                      >
                        v{doc.version}
                        {doc.is_latest ? " • Terbaru" : " • Arsip"}
                      </Badge>
                    </div>
                    <p className="truncate text-[11px]">{doc.file_name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* TOOLBAR KONTROL ZOOM, ROTASI & SWITCH VERSI */}
      {activeDoc && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-3 py-2 text-xs">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {DOC_CATEGORY_LABELS[activeDoc.category]}
              </Badge>
              <span className="truncate font-semibold">
                {activeDoc.file_name}
              </span>
              <Badge
                variant={activeDoc.is_latest ? "default" : "outline"}
                className="text-[10px]"
              >
                Versi {activeDoc.version}{" "}
                {activeDoc.is_latest ? "(Terbaru)" : "(Versi Lama)"}
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatBytes(Number(activeDoc.file_size_bytes))} • Diunggah{" "}
              {formatDateTimeWIB(activeDoc.created_at)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1">
            {/* Quick Version Switcher jika kategori ini punya >1 versi */}
            {categoryVersionHistory.length > 1 && (
              <select
                aria-label="Pilih versi dokumen"
                value={activeDoc.id}
                onChange={(e) => {
                  const target = sortedDocs.find(
                    (d) => d.id === e.target.value
                  );
                  if (target) handleSelectDoc(target);
                }}
                className="h-7 rounded-md border border-input bg-background px-2 text-[11px] font-medium"
              >
                {categoryVersionHistory.map((verDoc) => (
                  <option key={verDoc.id} value={verDoc.id}>
                    v{verDoc.version}{" "}
                    {verDoc.is_latest ? "(Terbaru)" : "(Arsip)"} —{" "}
                    {formatDateTimeWIB(verDoc.created_at)}
                  </option>
                ))}
              </select>
            )}

            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              onClick={handleZoomOut}
              disabled={zoomPercent <= 50}
              title="Perkecil (Zoom Out)"
            >
              <ZoomOut className="size-3.5" />
            </Button>
            <button
              type="button"
              onClick={handleResetTransform}
              className="min-w-[46px] rounded-md border px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold hover:bg-muted"
              title="Reset Zoom & Rotasi"
            >
              {zoomPercent}%
            </button>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              onClick={handleZoomIn}
              disabled={zoomPercent >= 200}
              title="Perbesar (Zoom In)"
            >
              <ZoomIn className="size-3.5" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              onClick={handleRotateCcw}
              title="Putar Kiri 90°"
            >
              <RotateCcw className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              onClick={handleRotateCw}
              title="Putar Kanan 90°"
            >
              <RotateCw className="size-3.5" />
            </Button>

            {streamUrl && (
              <a href={streamUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="gap-1"
                  title="Buka di Tab Baru"
                >
                  <Maximize2 className="size-3" />
                  <span className="hidden sm:inline">Layar Penuh</span>
                </Button>
              </a>
            )}
          </div>
        </div>
      )}

      {/* VIEWPORT PREVIEW DOKUMEN */}
      <div className="relative flex min-h-[480px] flex-1 items-center justify-center overflow-auto bg-neutral-900/95 p-3 lg:min-h-[640px]">
        {!activeDoc || !streamUrl ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-xs text-neutral-300">
            <FileText className="size-8 stroke-1 opacity-60" />
            <p>Belum ada dokumen untuk ditampilkan pada filter ini.</p>
          </div>
        ) : isImageDoc ? (
          <div className="flex min-h-full min-w-full items-center justify-center overflow-auto p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`${activeDoc.id}-${rotationDeg}`}
              src={streamUrl}
              alt={activeDoc.file_name}
              style={{
                transform: `scale(${
                  zoomPercent / 100
                }) rotate(${rotationDeg}deg)`,
                transformOrigin: "center center",
              }}
              className="max-h-[75vh] max-w-full rounded-md object-contain shadow-xl transition-transform duration-200"
            />
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <div
              className="h-[620px] w-full overflow-hidden rounded-lg bg-white shadow-xl transition-transform duration-200"
              style={{
                transform: `scale(${
                  zoomPercent / 100
                }) rotate(${rotationDeg}deg)`,
                transformOrigin: "top center",
              }}
            >
              <iframe
                key={activeDoc.id}
                src={`${streamUrl}#toolbar=1&navpanes=0&zoom=${zoomPercent}`}
                title={activeDoc.file_name}
                className="h-full w-full border-0"
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-neutral-300">
              <span>
                Apabila pratinjau PDF tidak muncul otomatis di perangkat Anda:
              </span>
              <a
                href={streamUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-sky-400 hover:underline"
              >
                Buka Stream PDF Langsung
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

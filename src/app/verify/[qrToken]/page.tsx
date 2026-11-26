import { Suspense } from "react";
import Link from "next/link";
import {
  Building2,
  CalendarCheck2,
  CheckCircle2,
  FileCheck2,
  Loader2,
  QrCode,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/server";
import { formatDateTimeWIB, STAGE_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Halaman Verifikasi QR Publik Terbatas (`/verify/[qrToken]`)
 * ----------------------------------------------------------------------------
 * - Menampilkan status keaslian dokumen (No. SPP, No. Agenda, Nama Mitra,
 *   Status Sah/Disetujui, Tanggal Terbit).
 * - TANPA mengekspos file PDF, nilai nominal sensitif, atau dokumen private Google Drive.
 */
async function VerifyQrTokenContent({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  const { qrToken } = await params;
  const cleanToken = decodeURIComponent(qrToken ?? "").trim();

  const adminSupabase = createAdminClient();

  // 1. Cari di tabel spp_documents berdasarkan qr_verification_hash
  const { data: sppDoc } = await adminSupabase
    .from("spp_documents")
    .select("id, submission_id, spp_no, qr_verification_hash, sent_to_finance_at, created_at")
    .eq("qr_verification_hash", cleanToken)
    .maybeSingle();

  let submissionId: string | null = sppDoc?.submission_id ?? null;

  // 2. Fallback apabila token berasal dari QR Lembar Hasil Cek (`CHK-...`)
  if (!submissionId && cleanToken.toUpperCase().startsWith("CHK-")) {
    const hexPrefix = cleanToken.slice(4).toLowerCase();
    if (hexPrefix.length >= 8) {
      const { data: allSubs } = await adminSupabase
        .from("billing_submissions")
        .select("id")
        .limit(200);
      const matched = (allSubs ?? []).find((s) =>
        s.id.replace(/-/g, "").toLowerCase().startsWith(hexPrefix)
      );
      if (matched) {
        submissionId = matched.id;
      }
    }
  }

  if (!submissionId) {
    return (
      <Card className="w-full max-w-lg border-destructive/40 shadow-lg">
        <CardHeader className="border-b bg-destructive/5 text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/15 text-destructive">
            <ShieldAlert className="size-6" />
          </div>
          <CardTitle className="text-lg text-destructive">
            Token Verifikasi QR Tidak Ditemukan
          </CardTitle>
          <CardDescription>
            Kode token <span className="font-mono font-semibold">{cleanToken}</span>{" "}
            tidak terdaftar pada basis data dokumen resmi Accelera HUB.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5 text-center text-xs text-muted-foreground">
          <p>
            Pastikan Anda memindai QR Code langsung dari dokumen Surat Pengajuan
            Pembayaran (SPP) atau Lembar Hasil Cek &amp; Approval resmi yang
            diterbitkan oleh Accelera HUB.
          </p>
          <Link href="/login">
            <Button variant="outline" size="sm">
              Kembali ke Portal Accelera HUB
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const { data: submission } = await adminSupabase
    .from("billing_submissions")
    .select(
      "id, agenda_no, vendor_id, current_stage, final_status, precheck_status, physical_status, verification_status, validation_status, completed_date, updated_at"
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) {
    return null;
  }

  const [{ data: vendor }, { data: linkedSpp }] = await Promise.all([
    adminSupabase
      .from("vendors")
      .select("name")
      .eq("id", submission.vendor_id)
      .maybeSingle(),
    sppDoc
      ? Promise.resolve({ data: sppDoc })
      : adminSupabase
          .from("spp_documents")
          .select(
            "id, submission_id, spp_no, qr_verification_hash, sent_to_finance_at, created_at"
          )
          .eq("submission_id", submission.id)
          .maybeSingle(),
  ]);

  const effectiveSpp = linkedSpp ?? null;
  const isFullyApproved =
    Boolean(effectiveSpp) ||
    submission.current_stage === "COMPLETED" ||
    submission.final_status === "Selesai";

  return (
    <Card className="w-full max-w-xl border-emerald-500/40 shadow-lg">
      <CardHeader className="border-b bg-emerald-500/10 pb-5 text-center">
        <div className="mx-auto mb-2.5 flex size-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm">
          <ShieldCheck className="size-8" />
        </div>
        <div className="flex justify-center">
          <Badge className="bg-emerald-600 text-white">
            {isFullyApproved
              ? "DOKUMEN RESMI SAH & DISETUJUI"
              : "DOKUMEN TERDAFTAR DALAM PROSES VERIFIKASI"}
          </Badge>
        </div>
        <CardTitle className="mt-2 text-xl">
          Verifikasi Keaslian Dokumen Digital
        </CardTitle>
        <CardDescription>
          Accelera HUB — Sistem Verifikasi Tagihan &amp; SPP Terintegrasi
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-5 text-xs">
        <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2.5">
            <span className="text-muted-foreground">Nomor SPP</span>
            <span className="font-mono text-sm font-bold text-primary">
              {effectiveSpp?.spp_no ?? "Belum Diterbitkan (Lembar Cek)"}
            </span>
          </div>

          <div className="flex items-center justify-between border-b pb-2.5">
            <span className="text-muted-foreground">Nomor Agenda</span>
            <span className="font-mono font-semibold">
              {submission.agenda_no}
            </span>
          </div>

          <div className="flex items-center justify-between border-b pb-2.5">
            <span className="text-muted-foreground">Nama Mitra / Vendor</span>
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <Building2 className="size-3.5 text-primary" />
              {vendor?.name ?? "-"}
            </span>
          </div>

          <div className="flex items-center justify-between border-b pb-2.5">
            <span className="text-muted-foreground">
              Status Keaslian &amp; Persetujuan
            </span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              {isFullyApproved
                ? "SAH / DISETUJUI LINTAS DIVISI"
                : `${STAGE_LABELS[submission.current_stage]} (${
                    submission.final_status
                  })`}
            </span>
          </div>

          <div className="flex items-center justify-between border-b pb-2.5">
            <span className="text-muted-foreground">Tanggal Terbit</span>
            <span className="inline-flex items-center gap-1 font-medium">
              <CalendarCheck2 className="size-3.5 text-primary" />
              {formatDateTimeWIB(
                effectiveSpp?.created_at ??
                  submission.completed_date ??
                  submission.updated_at
              )}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Token QR</span>
            <span className="font-mono text-[11px] text-muted-foreground">
              {cleanToken}
            </span>
          </div>
        </div>

        {/* RINGKASAN GERBANG VALIDASI (TANPA DATA SENSITIF/FILE PDF) */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border bg-background p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Pre-Check</p>
            <p className="mt-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
              {submission.precheck_status}
            </p>
          </div>
          <div className="rounded-lg border bg-background p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Cek Fisik</p>
            <p className="mt-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
              {submission.physical_status}
            </p>
          </div>
          <div className="rounded-lg border bg-background p-2 text-center">
            <p className="text-[10px] text-muted-foreground">PIC Usaha</p>
            <p className="mt-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
              {submission.verification_status}
            </p>
          </div>
          <div className="rounded-lg border bg-background p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Akuntansi</p>
            <p className="mt-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
              {submission.validation_status}
            </p>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <strong>Perlindungan Privasi Dokumen:</strong> Halaman verifikasi
          publik terbatas ini hanya menampilkan metadata keaslian persetujuan
          resmi dan tidak menyediakan akses unduhan berkas PDF maupun rincian
          finansial rahasia perusahaan.
        </div>
      </CardContent>
    </Card>
  );
}

export default function PublicVerifyQrPage({
  params,
}: {
  params: Promise<{ qrToken: string }>;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-5 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
          <FileCheck2 className="size-5" />
        </div>
        <div>
          <p className="text-base font-bold tracking-tight">Accelera HUB</p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <QrCode className="size-3" />
            Portal Verifikasi Keaslian QR Code Resmi
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Memverifikasi keaslian Token QR Code...
          </div>
        }
      >
        <VerifyQrTokenContent params={params} />
      </Suspense>
    </div>
  );
}

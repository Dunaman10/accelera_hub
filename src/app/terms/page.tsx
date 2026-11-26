import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileCheck2,
  Gavel,
  QrCode,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Ketentuan Layanan (Terms of Service)",
  description:
    "Syarat dan Ketentuan Penggunaan Sistem Verifikasi, Validasi Dokumen Penagihan & Monitoring SLA Accelera HUB.",
};

const TERMS_SECTIONS = [
  {
    icon: Gavel,
    title: "1. Ketentuan Umum Penggunaan",
    content:
      "Dengan mengakses dan menggunakan aplikasi web maupun aplikasi Android (PWA/TWA) Accelera HUB, Anda menyetujui untuk mematuhi prosedur standar operasional (SOP) verifikasi dokumen penagihan yang berlaku. Sistem ini hanya boleh digunakan untuk transaksi penagihan resmi antara perusahaan Mitra/Vendor terdaftar dengan Accelera.",
  },
  {
    icon: FileCheck2,
    title: "2. Keabsahan & Tanggung Jawab Dokumen Tagihan",
    content:
      "Mitra/Vendor bertanggung jawab penuh atas kebenaran, keaslian, dan keabsahan hukum dari seluruh dokumen softcopy maupun berkas fisik (hardcopy) yang diajukan, termasuk namun tidak terbatas pada Invoice, e-Faktur Pajak, Berita Acara Serah Terima (BAST), dan Kontrak/PO. Pengajuan nomor invoice ganda pada tagihan aktif akan ditolak secara otomatis oleh sistem.",
  },
  {
    icon: CheckCircle2,
    title: "3. Alur Pemeriksaan Berjenjang (State Machine Ketat)",
    content:
      "Setiap pengajuan tagihan wajib melewati 6 tahapan berurutan tanpa lompatan status: (1) Input Softcopy Mitra, (2) Pre-Check Softcopy Admin Accelera, (3) Pengiriman & Cek Fisik Hardcopy, (4) Approval Substansi PIC Usaha, (5) Validasi Pajak & Akuntansi, hingga (6) Penerbitan Surat Pengajuan Pembayaran (SPP) Digital. Tahap berikutnya hanya terbuka apabila tahap sebelumnya telah dinyatakan Lulus/Lengkap.",
  },
  {
    icon: Clock,
    title: "4. Perhitungan SLA 6 Hari Kerja & Mekanisme Auto-Pause",
    content:
      "Target total Service Level Agreement (SLA) pemeriksaan internal adalah 6 Hari Kerja (Senin–Jumat, mengecualikan hari Sabtu, Minggu, dan Hari Libur Nasional yang terdaftar). Argo SLA internal akan dijeda secara otomatis (Auto-Pause) ketika status pengajuan menunggu pengiriman berkas fisik dari Mitra (WAITING_HARDCOPY) atau menunggu perbaikan revisi dokumen oleh Mitra (REVISION_*).",
  },
  {
    icon: QrCode,
    title: "5. Penguncian SPP 1:1 & Verifikasi QR Code",
    content:
      "Setiap pengajuan yang telah lulus Validasi Akuntansi hanya dapat diterbitkan menjadi 1 (satu) dokumen SPP resmi ber-QR Code kriptografis. Setelah SPP diterbitkan, seluruh data dan dokumen pada pengajuan tersebut dikunci secara permanen (Read-Only) dan tidak dapat diubah kembali demi integritas audit keuangan.",
  },
  {
    icon: ShieldAlert,
    title: "6. Keamanan Akun & Larangan Penyalahgunaan",
    content:
      "Setiap pengguna wajib menjaga kerahasiaan kata sandi, kode OTP 6 digit, dan tautan Magic Link yang dikirimkan ke email terdaftar. Dilarang keras membagikan akses akun kepada pihak yang tidak berwenang, mencoba mengakses dokumen milik perusahaan Mitra lain, atau memodifikasi mekanisme keamanan sistem.",
  },
] as const;

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <BrandLogo
              variant="horizontal"
              size="sm"
              subtitle="Ketentuan Layanan & Kepatuhan SOP"
            />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <ArrowLeft className="size-3.5" />
                Portal Login
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
        <div className="rounded-3xl border border-[#1F4E78]/25 bg-gradient-to-br from-[#0B2E5C] via-[#1F4E78] to-[#085167] p-6 text-white shadow-sm sm:p-8">
          <Badge className="border border-teal-300/40 bg-teal-400/20 text-teal-100">
            Dokumen Legal Resmi • Publik
          </Badge>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Ketentuan Layanan (Terms of Service)
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-100/90 sm:text-sm">
            Aturan operasional, tata kelola pemeriksaan dokumen berjenjang, dan
            standar perhitungan SLA 6 Hari Kerja pada platform{" "}
            <strong>Accelera HUB</strong>.
          </p>
          <p className="mt-4 text-[11px] font-medium text-teal-200">
            Berlaku Efektif: 1 Januari 2026 • Pembaruan Terakhir: November 2026
          </p>
        </div>

        <div className="grid gap-4">
          {TERMS_SECTIONS.map((sec) => {
            const Icon = sec.icon;
            return (
              <Card key={sec.title} className="border-border/80">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/12 text-brand-teal">
                      <Icon className="size-4.5" />
                    </div>
                    <CardTitle className="text-base">{sec.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {sec.content}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-brand-teal/35 bg-brand-teal/5">
          <CardContent className="flex flex-col items-start justify-between gap-4 pt-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-brand-teal" />
              <div className="space-y-1 text-xs">
                <p className="font-bold text-foreground">
                  Kepatuhan &amp; Kebijakan Privasi
                </p>
                <p className="text-muted-foreground">
                  Pelajari lebih lanjut bagaimana kami mengamankan arsip Google
                  Drive dan mengisolasi data setiap perusahaan Mitra.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link href="/privacy">
                <Button variant="outline" size="sm" className="text-xs">
                  Kebijakan Privasi
                </Button>
              </Link>
              <Link href="/login">
                <Button size="sm" className="text-xs">
                  Masuk ke Portal
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

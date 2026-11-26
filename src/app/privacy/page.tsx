import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Database,
  EyeOff,
  FileLock2,
  HardDrive,
  Lock,
  ShieldCheck,
  UserCheck,
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
  title: "Kebijakan Privasi (Privacy Policy)",
  description:
    "Kebijakan Privasi, Perlindungan Data Finansial, dan Keamanan Dokumen Penagihan di Accelera HUB.",
};

const PRIVACY_SECTIONS = [
  {
    icon: UserCheck,
    title: "1. Ruang Lingkup & Akses Terbatas (Invite-Only)",
    content:
      "Accelera HUB adalah sistem internal korporasi untuk verifikasi, validasi dokumen penagihan Mitra/Vendor, dan pemantauan Service Level Agreement (SLA) 6 Hari Kerja. Akses ke sistem bersifat tertutup (Invite-Only) dan hanya diberikan kepada akun Mitra serta personel internal (Admin Accelera, PIC Usaha, Tim Akuntansi, dan Divisi Usaha) yang telah didaftarkan secara resmi.",
  },
  {
    icon: Database,
    title: "2. Data yang Dikumpulkan & Diproses",
    content:
      "Sistem hanya mengumpulkan dan memproses data yang diperlukan secara sah untuk proses verifikasi tagihan, meliputi: (a) Identitas akun pengguna (nama lengkap, alamat email korporasi, jabatan/peran); (b) Identitas perusahaan Mitra/Vendor (nama badan usaha, NPWP, nama PIC, nomor kontak WhatsApp, email resmi); serta (c) Metadata dan berkas dokumen penagihan (Invoice, e-Faktur Pajak, BAST, Kontrak/PO/SPK, dan Surat Pengajuan Pembayaran / SPP).",
  },
  {
    icon: HardDrive,
    title: "3. Penyimpanan Dokumen Private & Integrasi Google Drive API",
    content:
      "Seluruh dokumen digital yang diunggah ke Accelera HUB disimpan pada penyimpanan arsip Google Drive terpusat milik organisasi dengan status akses Private (tidak pernah dibagikan secara publik / 'Anyone with the link'). Penggunaan Google Drive API (OAuth 2.0) semata-mata digunakan untuk membuat struktur folder arsip penagihan, menerima unggahan dokumen tagihan Mitra, menyimpan PDF SPP resmi, dan menyajikan pratinjau dokumen melalui jalur proxy terautentikasi (/api/documents/[id]/view).",
  },
  {
    icon: Lock,
    title: "4. Isolasi Data Antar-Mitra (Row Level Security)",
    content:
      "Basis data Accelera HUB menerapkan kebijakan Row Level Security (RLS) berlapis pada tingkat PostgreSQL maupun validasi server. Setiap pengguna dengan peran Mitra/Vendor hanya dapat melihat, mengunggah, dan menindaklanjuti dokumen penagihan yang terkait langsung dengan ID perusahaannya sendiri (vendor_id).",
  },
  {
    icon: EyeOff,
    title: "5. Kebijakan Tanpa Cache Offline untuk Data Finansial",
    content:
      "Pada perangkat mobile dan aplikasi Android (PWA / Trusted Web Activity), Service Worker Accelera HUB dikonfigurasi secara ketat agar hanya menyimpan aset antarmuka statis (ikon, font, dan skrip tampilan). Respons API (/api/*), sesi autentikasi (/auth/*), dan stream dokumen tagihan (/api/documents/*) dilarang disimpan di dalam cache browser demi mencegah kebocoran data finansial pada perangkat bersama.",
  },
  {
    icon: FileLock2,
    title: "6. Retensi Data, Jejak Audit & Hak Pengguna",
    content:
      "Setiap transisi tahapan pemeriksaan, waktu mulai/jeda SLA, dan penerbitan SPP dicatat dalam log audit (stage_logs) untuk keperluan kepatuhan keuangan dan audit internal. Pengguna maupun Mitra dapat mengajukan permohonan pembaruan data profil, penonaktifan akun, atau klarifikasi privasi melalui Administrator Accelera HUB.",
  },
] as const;

export default function PrivacyPolicyPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <BrandLogo
              variant="horizontal"
              size="sm"
              subtitle="Kebijakan Privasi & Keamanan Data"
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
            Kebijakan Privasi (Privacy Policy)
          </h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-100/90 sm:text-sm">
            Komitmen <strong>Accelera HUB</strong> dalam melindungi kerahasiaan
            dokumen penagihan Mitra, kepatuhan penggunaan Google Drive API, dan
            keamanan data finansial perusahaan.
          </p>
          <p className="mt-4 text-[11px] font-medium text-teal-200">
            Berlaku Efektif: 1 Januari 2026 • Pembaruan Terakhir: November 2026
          </p>
        </div>

        <div className="grid gap-4">
          {PRIVACY_SECTIONS.map((sec) => {
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
                  Kontak Pengelola Sistem &amp; Kepatuhan Data
                </p>
                <p className="text-muted-foreground">
                  Untuk pertanyaan terkait privasi data, akses akun Invite-Only,
                  atau verifikasi dokumen SPP, silakan hubungi Administrator
                  Internal Accelera HUB.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Link href="/terms">
                <Button variant="outline" size="sm" className="text-xs">
                  Ketentuan Layanan
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

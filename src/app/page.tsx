import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  HardDrive,
  LogIn,
  PackageCheck,
  QrCode,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { getAuthenticatedContext } from "@/lib/auth";
import { getHomeRouteForRole, ROLE_LABELS } from "@/lib/constants";
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

const WORKFLOW_STAGES = [
  {
    step: 1,
    title: "Input Softcopy Mitra",
    actor: "Mitra / Vendor",
    sla: "Hari ke-0",
    description:
      "Mitra mengisi rincian tagihan, mengunggah Invoice & BAST, lalu memperoleh Nomor Agenda otomatis.",
    icon: UploadCloud,
  },
  {
    step: 2,
    title: "Pre-Check Softcopy",
    actor: "Admin Accelera",
    sla: "SLA 1 HK",
    description:
      "Admin memeriksa kelengkapan dokumen digital sebelum Mitra mengirimkan berkas fisik.",
    icon: ClipboardCheck,
  },
  {
    step: 3,
    title: "Kirim & Cek Fisik",
    actor: "Mitra → Admin",
    sla: "SLA 1 HK",
    description:
      "Timer SLA otomatis di-Pause saat menunggu berkas fisik, lalu dilanjutkan ketika hardcopy diterima di loket.",
    icon: PackageCheck,
  },
  {
    step: 4,
    title: "Approval PIC Usaha",
    actor: "PIC Usaha",
    sla: "SLA 1 HK",
    description:
      "Verifikasi substansi pekerjaan, kesesuaian BAST, dan nilai kontrak sebelum masuk tahap akuntansi.",
    icon: ShieldCheck,
  },
  {
    step: 5,
    title: "Validasi Akuntansi",
    actor: "Tim Akuntansi",
    sla: "SLA 2 HK",
    description:
      "Validasi nominal tagihan, DPP/PPN/PPh, nomor & tanggal e-Faktur Pajak, serta referensi PO/Kontrak.",
    icon: FileSpreadsheet,
  },
  {
    step: 6,
    title: "Terbit SPP Digital",
    actor: "Divisi Usaha",
    sla: "SLA 1 HK",
    description:
      "Penerbitan PDF SPP resmi ber-QR Code verifikasi publik dan pengarsipan aman ke Google Drive.",
    icon: QrCode,
  },
] as const;

const SYSTEM_PILLARS = [
  {
    title: "Portal Mandiri Mitra & Isolasi Data",
    description:
      "Setiap perusahaan Mitra hanya dapat melihat dan menindaklanjuti pengajuan miliknya sendiri dengan login Password atau Kode OTP 6 Digit.",
    icon: ShieldCheck,
    tag: "Akses Invite-Only",
  },
  {
    title: "Arsip Private Google Drive Terenkripsi",
    description:
      "Seluruh dokumen tagihan dan PDF SPP tersimpan secara private tanpa tautan publik, ditampilkan lewat proxy stream terautentikasi.",
    icon: HardDrive,
    tag: "Private Vault",
  },
  {
    title: "Mesin SLA 6 Hari Kerja & Auto-Pause",
    description:
      "Perhitungan hari kerja internal otomatis mengecualikan Sabtu, Minggu, Hari Libur Nasional, serta berhenti sementara saat menunggu Mitra.",
    icon: Clock,
    tag: "Total SLA 6 HK",
  },
  {
    title: "Pemeriksaan Bertingkat Tanpa Lompatan",
    description:
      "Setiap gerbang verifikasi dan validasi saling mengunci berurutan hingga penerbitan SPP ber-QR Code yang dapat diverifikasi secara terbuka.",
    icon: CheckCircle2,
    tag: "Kontrol Berjenjang",
  },
] as const;

async function HeaderAuthAction() {
  const ctx = await getAuthenticatedContext();
  const dashboardHref = ctx
    ? getHomeRouteForRole(ctx.profile.role)
    : "/login";

  if (ctx) {
    return (
      <Link href={dashboardHref}>
        <Button size="lg" className="gap-2">
          Buka Workspace ({ROLE_LABELS[ctx.profile.role]})
          <ArrowRight className="size-4" />
        </Button>
      </Link>
    );
  }

  return (
    <Link href="/login">
      <Button size="lg" className="gap-2">
        <LogIn className="size-4" />
        Masuk ke Portal
      </Button>
    </Link>
  );
}

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="transition-opacity hover:opacity-90">
            <BrandLogo
              variant="horizontal"
              size="md"
              subtitle="Portal Penagihan & SLA 6 HK"
            />
          </Link>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Suspense
              fallback={
                <Link href="/login">
                  <Button size="default" className="gap-2">
                    <LogIn className="size-4" />
                    Masuk ke Portal
                  </Button>
                </Link>
              }
            >
              <HeaderAuthAction />
            </Suspense>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          {/* HERO SECTION */}
          <section className="relative overflow-hidden rounded-3xl border border-brand-navy/20 bg-gradient-to-br from-[#0B2E5C] via-[#0D386E] to-[#085167] p-6 text-white shadow-md sm:p-10 dark:border-brand-teal/25">
            <div className="grid items-center gap-8 lg:grid-cols-12">
              <div className="space-y-5 lg:col-span-8">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-teal-300/40 bg-teal-400/20 text-teal-100">
                    Platform Resmi Accelera HUB
                  </Badge>
                  <Badge className="border border-white/20 bg-white/10 text-slate-100">
                    Target SLA Internal: 6 Hari Kerja
                  </Badge>
                </div>

                <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                  Sistem Verifikasi, Validasi &amp; Monitoring SLA Dokumen
                  Penagihan
                </h1>

                <p className="max-w-2xl text-sm leading-relaxed text-slate-100/90 sm:text-base">
                  Halaman beranda ini memperkenalkan fungsi dan alur kerja
                  terpadu <strong>Accelera HUB</strong> — mulai dari pengajuan
                  dokumen penagihan oleh Mitra, pemeriksaan bertingkat oleh
                  Admin Accelera, PIC Usaha, dan Tim Akuntansi, hingga
                  penerbitan Surat Pengajuan Pembayaran (SPP) digital ber-QR
                  Code.
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Suspense
                    fallback={
                      <Link href="/login">
                        <Button
                          size="lg"
                          className="gap-2 bg-brand-teal text-white hover:bg-brand-teal/90"
                        >
                          <LogIn className="size-4" />
                          Masuk ke Portal Sekarang
                        </Button>
                      </Link>
                    }
                  >
                    <Link href="/login">
                      <Button
                        size="lg"
                        className="gap-2 bg-[#059C95] text-white shadow-sm hover:bg-[#04857f]"
                      >
                        <LogIn className="size-4" />
                        Masuk ke Portal
                        <ArrowRight className="size-4" />
                      </Button>
                    </Link>
                  </Suspense>

                  <a
                    href="#alur-kerja"
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                  >
                    Pelajari Alur 6 Tahap
                  </a>
                </div>
              </div>

              <div className="flex items-center justify-center lg:col-span-4">
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-xs">
                  <BrandLogo variant="full" size="lg" inverted />
                  <p className="mt-3 text-center text-xs font-medium text-teal-100">
                    Transparan • Akuntabel • Terukur SLA
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ALUR KERJA 6 TAHAP */}
          <section id="alur-kerja" className="space-y-5">
            <div className="space-y-1.5">
              <Badge
                variant="outline"
                className="border-brand-teal/40 bg-brand-teal/10 text-accent-foreground"
              >
                Panduan Alur End-to-End
              </Badge>
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Bagaimana Alur Dokumen Penagihan Bekerja?
              </h2>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Setiap pengajuan melewati 6 gerbang berurutan tanpa lompatan
                status. Tahap berikutnya otomatis terbuka setelah tahap
                sebelumnya dinyatakan lulus.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {WORKFLOW_STAGES.map((item) => {
                const Icon = item.icon;
                return (
                  <Card
                    key={item.step}
                    className="transition-all hover:border-brand-teal/50 hover:shadow-sm"
                  >
                    <CardHeader className="gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-8 items-center justify-center rounded-full bg-brand-navy text-xs font-bold text-white dark:bg-brand-teal dark:text-[#041E2B]">
                            {item.step}
                          </span>
                          <div className="flex size-9 items-center justify-center rounded-xl bg-brand-teal/12 text-brand-teal">
                            <Icon className="size-4.5" />
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {item.sla}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-base">{item.title}</CardTitle>
                        <p className="text-xs font-semibold text-brand-teal">
                          Penanggung Jawab: {item.actor}
                        </p>
                      </div>
                      <CardDescription className="text-sm leading-relaxed">
                        {item.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* KEUNGGULAN UTAMA */}
          <section className="space-y-5">
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Pilar Utama Sistem Accelera HUB
              </h2>
              <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Dirancang khusus untuk kenyamanan Mitra di perangkat mobile
                maupun pemeriksaan dokumen split-screen bagi tim internal.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {SYSTEM_PILLARS.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title}>
                    <CardHeader className="gap-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-brand-teal/12 text-brand-teal">
                          <Icon className="size-5" />
                        </div>
                        <Badge variant="outline">{item.tag}</Badge>
                      </div>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription className="text-sm leading-relaxed">
                        {item.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-xs font-semibold text-brand-teal">
                        <CheckCircle2 className="size-4" />
                        Aktif &amp; Terintegrasi di Seluruh Portal
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-border bg-card/70 py-5 text-center text-xs text-muted-foreground">
        Accelera HUB • Sistem Verifikasi, Validasi &amp; Monitoring SLA Dokumen
        Penagihan
      </footer>
    </div>
  );
}

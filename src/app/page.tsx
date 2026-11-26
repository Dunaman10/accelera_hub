import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  FileCheck2,
  HardDrive,
  LogIn,
  ShieldCheck,
} from "lucide-react";
import { getAuthenticatedContext } from "@/lib/auth";
import { getHomeRouteForRole, ROLE_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const INFRASTRUCTURE_PILLARS = [
  {
    title: "Autentikasi RBAC & Invite-Only",
    description:
      "Mendukung login Email + Password serta Passwordless OTP 6 Digit / Magic Link dengan isolasi ketat per vendor_id dan proteksi middleware otomatis.",
    icon: Database,
    tag: "Supabase Auth + RLS",
  },
  {
    title: "Google Drive Private Vault",
    description:
      "Integrasi REST API v3 murni via fetch() tanpa SDK berat, mendukung Resumable Upload langsung dari klien dan kompresi foto otomatis di sisi browser.",
    icon: HardDrive,
    tag: "Resumable Upload",
  },
  {
    title: "Mesin SLA 6 Hari Kerja",
    description:
      "Perhitungan otomatis hari kerja yang memotong akhir pekan, hari libur nasional, serta auto-pause saat status menunggu berkas fisik atau revisi Mitra.",
    icon: Clock,
    tag: "Visual Timeline 6 Tahap",
  },
  {
    title: "Master Vendor & Manajemen User",
    description:
      "Pengelolaan data perusahaan Mitra, NPWP, PIC WhatsApp, serta provisioning user menggunakan Service Role Key secara terpusat.",
    icon: ShieldCheck,
    tag: "Sprint Minggu 2 Aktif",
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
          Buka Dashboard ({ROLE_LABELS[ctx.profile.role]})
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
    <main className="flex-1 bg-muted/30">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 sm:px-6 lg:py-16">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="gap-1.5">
                <FileCheck2 className="size-3.5" />
                Accelera HUB
              </Badge>
              <Badge variant="secondary">
                Sprint Minggu 2 — RBAC, Master Vendor &amp; Portal Mitra
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Suspense
                fallback={
                  <Link href="/login">
                    <Button size="lg" className="gap-2">
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

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Sistem Verifikasi, Validasi &amp; Monitoring SLA Dokumen Penagihan
          </h1>
          <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
            Platform terpadu pengajuan tagihan mandiri Mitra, pemeriksaan
            bertingkat Admin Accelera, PIC Usaha, dan Akuntansi, serta pelacakan
            SLA 6 hari kerja secara transparan.
          </p>
        </header>

        <Separator />

        <section className="grid gap-4 sm:grid-cols-2">
          {INFRASTRUCTURE_PILLARS.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="border-border/80">
                <CardHeader className="gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </div>
                    <Badge variant="outline">{item.tag}</Badge>
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription className="leading-relaxed">
                    {item.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" />
                    Terkonfigurasi &amp; Teruji Tipe
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      </div>
    </main>
  );
}

import {
  CheckCircle2,
  Clock,
  Database,
  FileCheck2,
  HardDrive,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
    title: "PostgreSQL & Row Level Security",
    description:
      "8 tabel inti dengan isolasi ketat per vendor_id untuk Mitra serta kontrol kewenangan bertingkat bagi Admin Accelera, PIC Usaha, Akuntansi, dan Divisi Usaha.",
    icon: Database,
    tag: "Supabase SSR",
  },
  {
    title: "Google Drive Private Vault",
    description:
      "Integrasi REST API v3 murni via fetch() tanpa SDK berat, mendukung Resumable Upload langsung dari klien dan proxy streaming dokumen terautentikasi.",
    icon: HardDrive,
    tag: "15 GB Quota Monitor",
  },
  {
    title: "Mesin SLA 6 Hari Kerja",
    description:
      "Perhitungan otomatis hari kerja yang memotong akhir pekan, hari libur nasional, serta auto-pause saat status menunggu berkas fisik atau revisi Mitra.",
    icon: Clock,
    tag: "State Machine Ketat",
  },
  {
    title: "Edge-Ready & Anti-Pause Cron",
    description:
      "Siap dideploy pada Cloudflare Workers melalui OpenNext beserta endpoint terjadwal keep-alive untuk menjaga ketersediaan database.",
    icon: ShieldCheck,
    tag: "Cloudflare Workers",
  },
] as const;

export default function HomePage() {
  return (
    <main className="flex-1 bg-muted/30">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 sm:px-6 lg:py-16">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default" className="gap-1.5">
              <FileCheck2 className="size-3.5" />
              Accelera HUB
            </Badge>
            <Badge variant="secondary">Sprint Minggu 1 — Fondasi Aktif</Badge>
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Sistem Verifikasi, Validasi &amp; Monitoring SLA Dokumen Penagihan
          </h1>
          <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
            Fondasi infrastruktur Next.js App Router, skema Supabase PostgreSQL
            berbasis RLS, serta utilitas Google Drive REST API murni telah siap
            untuk alur pengajuan Mitra hingga penerbitan SPP.
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

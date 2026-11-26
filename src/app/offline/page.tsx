"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
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

function subscribeOnlineStatus(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot() {
  return typeof navigator !== "undefined" ? navigator.onLine : false;
}

function getOnlineServerSnapshot() {
  return false;
}

export default function OfflinePage() {
  const router = useRouter();
  const isOnline = React.useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  );
  const [retrying, setRetrying] = React.useState(false);

  function handleRetryConnection() {
    setRetrying(true);
    window.setTimeout(() => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        router.push("/login");
        router.refresh();
      } else {
        window.location.reload();
      }
    }, 350);
  }

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 pt-5 sm:px-6">
        <Link href="/login" className="transition-opacity hover:opacity-90">
          <BrandLogo
            variant="horizontal"
            size="sm"
            subtitle="Mode Perlindungan Offline"
          />
        </Link>
        <ThemeToggle showLabel />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md border-t-4 border-t-[#1F4E78] shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-[#1F4E78]/10 text-[#1F4E78] dark:bg-brand-teal/15 dark:text-brand-teal">
              {isOnline ? (
                <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <WifiOff className="size-8" />
              )}
            </div>

            <div className="flex justify-center">
              <Badge
                variant="outline"
                className={
                  isOnline
                    ? "border-emerald-500/40 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                    : "border-amber-500/40 bg-amber-500/12 text-amber-800 dark:text-amber-300"
                }
              >
                {isOnline
                  ? "Koneksi Internet Kembali Tersedia"
                  : "Koneksi Internet Terputus"}
              </Badge>
            </div>

            <CardTitle className="mt-2 text-xl font-bold">
              {isOnline
                ? "Perangkat Anda Kembali Online"
                : "Anda Sedang Berada di Luar Jaringan"}
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {isOnline
                ? "Jaringan internet telah terhubung kembali. Klik tombol Coba Lagi di bawah untuk melanjutkan aktivitas di Accelera HUB."
                : "Perangkat Anda saat ini kehilangan koneksi internet. Pastikan Wi-Fi atau paket data seluler Anda aktif lalu tekan tombol Coba Lagi."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 text-xs">
            <div className="rounded-xl border border-border bg-surface-subtle/70 p-3.5 leading-relaxed text-muted-foreground">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-teal" />
                <div>
                  <p className="font-semibold text-foreground">
                    Keamanan Data Finansial &amp; Dokumen Tagihan
                  </p>
                  <p className="mt-0.5">
                    Demi melindungi kerahasiaan dokumen penagihan dan transaksi
                    SPP, Accelera HUB tidak menyimpan berkas PDF maupun data API
                    di memori cache offline perangkat.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2.5">
            <Button
              type="button"
              size="lg"
              onClick={handleRetryConnection}
              disabled={retrying}
              className="w-full gap-2 bg-[#1F4E78] text-white hover:bg-[#163a5c] dark:bg-brand-teal dark:text-[#041E2B]"
            >
              <RefreshCw
                className={`size-4 ${retrying ? "animate-spin" : ""}`}
              />
              {retrying ? "Memeriksa Koneksi..." : "Coba Lagi"}
            </Button>

            <Link href="/login" className="w-full">
              <Button variant="outline" size="default" className="w-full gap-1.5">
                <ArrowLeft className="size-4" />
                Kembali ke Halaman Login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}

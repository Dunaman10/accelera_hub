"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getHomeRouteForRole } from "@/lib/constants";
import { BrandLogo } from "@/components/brand/brand-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERROR_MESSAGES: Record<string, string> = {
  account_inactive:
    "Akun Anda saat ini berstatus nonaktif. Silakan hubungi Admin Accelera.",
  profile_not_found:
    "Profil akun belum terdaftar di sistem (Skema Invite-Only). Hubungi Admin Accelera.",
  invalid_role: "Role akun tidak valid. Silakan hubungi Administrator.",
  session_expired: "Sesi autentikasi telah berakhir. Silakan login kembali.",
};

function LoginForm04() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const nextParam = searchParams.get("next");

  const [authMode, setAuthMode] = React.useState<"password" | "otp">(
    "password"
  );

  // State Email + Password
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loadingPassword, setLoadingPassword] = React.useState(false);

  // State Passwordless (Magic Link / OTP 6 Digit)
  const [otpEmail, setOtpEmail] = React.useState("");
  const [otpCode, setOtpCode] = React.useState("");
  const [otpStep, setOtpStep] = React.useState<"request" | "verify">("request");
  const [loadingOtp, setLoadingOtp] = React.useState(false);
  const [otpCooldown, setOtpCooldown] = React.useState(0);

  React.useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setOtpCooldown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpCooldown]);

  // State Reset Password Request
  const [showForgotBox, setShowForgotBox] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState("");
  const [loadingForgot, setLoadingForgot] = React.useState(false);

  const errorBannerMessage = errorParam
    ? ERROR_MESSAGES[errorParam] ?? errorParam
    : null;

  async function resolvePostLoginRedirect(userId: string) {
    const supabase = createClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (error || !profile) {
      await supabase.auth.signOut();
      toast.error(
        "Profil akun Anda belum terdaftar di sistem Invite-Only Accelera HUB."
      );
      return;
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      toast.error("Akun Anda sedang dinonaktifkan oleh Admin Accelera.");
      return;
    }

    toast.success("Berhasil masuk ke Accelera HUB.");
    if (nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")) {
      router.replace(nextParam);
    } else {
      router.replace(getHomeRouteForRole(profile.role));
    }
    router.refresh();
  }

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      toast.error("Mohon isi email dan password terlebih dahulu.");
      return;
    }

    setLoadingPassword(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error || !data.user) {
        toast.error(
          error?.message === "Invalid login credentials"
            ? "Email atau password tidak sesuai."
            : error?.message ?? "Gagal melakukan autentikasi."
        );
        return;
      }

      await resolvePostLoginRedirect(data.user.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Terjadi kesalahan jaringan."
      );
    } finally {
      setLoadingPassword(false);
    }
  }

  async function handleSendOtpOrMagicLink(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = otpEmail.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Masukkan alamat email yang terdaftar.");
      return;
    }

    setLoadingOtp(true);
    try {
      const resp = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          next: nextParam,
        }),
      });

      const json = (await resp.json()) as {
        ok: boolean;
        error?: string;
        fallbackToSupabase?: boolean;
      };

      if (!resp.ok || !json.ok) {
        // Fallback ke Supabase bawaan jika Resend belum dikonfigurasi
        if (json.fallbackToSupabase) {
          const supabase = createClient();
          const redirectUrl = `${window.location.origin}/auth/callback${
            nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""
          }`;
          const { error } = await supabase.auth.signInWithOtp({
            email: cleanEmail,
            options: {
              shouldCreateUser: false,
              emailRedirectTo: redirectUrl,
            },
          });
          if (error) {
            const matchSec = error.message.match(/after\s+(\d+)\s+seconds/i);
            if (matchSec) {
              const sec = Number(matchSec[1]);
              setOtpCooldown(sec);
              toast.error(
                `Demi keamanan, mohon tunggu ${sec} detik sebelum meminta kode OTP kembali.`
              );
            } else {
              toast.error(error.message);
            }
            return;
          }
        } else {
          toast.error(json.error ?? "Gagal mengirim kode OTP.");
          return;
        }
      }

      setOtpCooldown(60);
      setOtpStep("verify");
      toast.success(
        "Kode OTP 6 digit & tautan Magic Link telah dikirim ke email Anda."
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengirim kode OTP."
      );
    } finally {
      setLoadingOtp(false);
    }
  }

  async function handleVerifyOtpCode(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = otpEmail.trim().toLowerCase();
    const cleanToken = otpCode.replace(/\D/g, "").trim();

    if (!cleanEmail || cleanToken.length < 6) {
      toast.error("Masukkan kode OTP 6 digit yang dikirim ke email Anda.");
      return;
    }

    setLoadingOtp(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: "email",
      });

      if (error || !data.user) {
        toast.error(
          error?.message ?? "Kode OTP tidak valid atau sudah kedaluwarsa."
        );
        return;
      }

      await resolvePostLoginRedirect(data.user.id);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal memverifikasi kode OTP."
      );
    } finally {
      setLoadingOtp(false);
    }
  }

  async function handleRequestResetPassword(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = forgotEmail.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Masukkan email akun Anda.");
      return;
    }

    setLoadingForgot(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(
        "Tautan atur ulang password telah dikirim ke email Anda."
      );
      setShowForgotBox(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengirim email pemulihan."
      );
    } finally {
      setLoadingForgot(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden border-border/80 p-0 shadow-xl">
        <CardContent className="grid p-0 md:min-h-[550px] md:grid-cols-2">
          {/* KOLOM KIRI: FORM LOGIN (SHADCN LOGIN-04) */}
          <div className="flex flex-col justify-center px-5 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
            <div className="flex flex-col gap-7">
              {/* Mobile Logo (hanya tampil di layar kecil saat panel kanan tersembunyi) */}
              <div className="flex justify-center md:hidden">
                <BrandLogo variant="horizontal" size="md" />
              </div>

              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Selamat Datang Kembali
                </h1>
                <p className="mt-1.5 text-sm text-balance text-muted-foreground">
                  Masuk ke akun Accelera HUB Anda
                </p>
              </div>

              {errorBannerMessage && (
                <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <div className="flex-1 leading-relaxed">
                    {errorBannerMessage}
                  </div>
                </div>
              )}

              {authMode === "password" ? (
                <form onSubmit={handlePasswordLogin} className="grid gap-5">
                  <div className="grid gap-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="nama@perusahaan.co.id"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="grid gap-2">
                    <div className="flex items-center">
                      <Label htmlFor="login-password">Password</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setShowForgotBox((prev) => !prev);
                        }}
                        className="ml-auto cursor-pointer text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        Lupa password?
                      </button>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={loadingPassword}
                  >
                    {loadingPassword ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Memverifikasi...
                      </>
                    ) : (
                      "Login"
                    )}
                  </Button>
                </form>
              ) : otpStep === "request" ? (
                <form
                  onSubmit={handleSendOtpOrMagicLink}
                  className="grid gap-5"
                >
                  <div className="rounded-xl border border-border bg-surface-subtle/70 p-3 text-xs leading-relaxed text-muted-foreground">
                    Masukkan email terdaftar Anda untuk menerima{" "}
                    <strong className="text-foreground">Kode OTP 6 Digit</strong>{" "}
                    sekaligus{" "}
                    <strong className="text-foreground">Magic Link</strong>{" "}
                    sekali klik.
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="otp-email">Email Terdaftar</Label>
                    <Input
                      id="otp-email"
                      type="email"
                      placeholder="pic@mitra-vendor.co.id"
                      required
                      value={otpEmail}
                      onChange={(e) => setOtpEmail(e.target.value)}
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={loadingOtp || otpCooldown > 0}
                  >
                    {loadingOtp ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Mengirim Kode OTP...
                      </>
                    ) : otpCooldown > 0 ? (
                      `Tunggu ${otpCooldown} detik untuk kirim ulang`
                    ) : (
                      "Kirim Kode OTP & Magic Link"
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtpCode} className="grid gap-5">
                  <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                    <div>
                      Kode OTP 6 digit telah dikirim ke{" "}
                      <strong>{otpEmail}</strong>.
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="otp-code">Kode OTP (6 Digit)</Label>
                    <Input
                      id="otp-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="123456"
                      required
                      value={otpCode}
                      onChange={(e) =>
                        setOtpCode(e.target.value.replace(/\D/g, ""))
                      }
                      className="h-11 text-center font-mono text-lg font-bold tracking-[0.45em]"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={loadingOtp || otpCode.length < 6}
                  >
                    {loadingOtp ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Memverifikasi OTP...
                      </>
                    ) : (
                      "Verifikasi & Login"
                    )}
                  </Button>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep("request");
                        setOtpCode("");
                      }}
                      className="cursor-pointer text-muted-foreground hover:text-foreground"
                    >
                      Ganti email
                    </button>
                    <button
                      type="button"
                      onClick={handleSendOtpOrMagicLink}
                      disabled={loadingOtp || otpCooldown > 0}
                      className="cursor-pointer font-semibold text-brand-teal hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
                    >
                      {otpCooldown > 0
                        ? `Kirim ulang (${otpCooldown}d)`
                        : "Kirim ulang kode"}
                    </button>
                  </div>
                </form>
              )}

              {showForgotBox && authMode === "password" && (
                <form
                  onSubmit={handleRequestResetPassword}
                  className="space-y-3 rounded-xl border border-border bg-surface-subtle/80 p-3.5"
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">
                      Kirim Tautan Reset Password
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Tautan pemulihan akan dikirim ke email terdaftar Anda.
                    </p>
                  </div>
                  <Input
                    type="email"
                    placeholder="Email terdaftar Anda"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setShowForgotBox(false)}
                    >
                      Batal
                    </Button>
                    <Button type="submit" size="xs" disabled={loadingForgot}>
                      {loadingForgot ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      Kirim Link Reset
                    </Button>
                  </div>
                </form>
              )}

              {/* DIVIDER "Atau lanjutkan dengan" PERSIS SHADCN LOGIN-04 */}
              <div className="relative text-center text-xs after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
                <span className="relative z-10 bg-card px-2.5 text-muted-foreground">
                  Atau lanjutkan dengan
                </span>
              </div>

              {/* TOMBOL PILIHAN METODE LOGIN ALTERNATIF */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={authMode === "password" ? "default" : "outline"}
                  onClick={() => {
                    setAuthMode("password");
                  }}
                  className="w-full gap-2 text-xs"
                >
                  <Lock className="size-3.5" />
                  <span>Password</span>
                </Button>

                <Button
                  type="button"
                  variant={authMode === "otp" ? "default" : "outline"}
                  onClick={() => {
                    if (email && !otpEmail) setOtpEmail(email);
                    setAuthMode("otp");
                  }}
                  className="w-full gap-2 text-xs"
                >
                  <Sparkles className="size-3.5" />
                  <span>OTP / Magic Link</span>
                </Button>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN: PANEL VISUAL & LOGO (SHADCN LOGIN-04 IMAGE SIDE) */}
          <div className="relative hidden flex-col items-center justify-center overflow-hidden border-l border-border/70 bg-surface-subtle p-10 md:flex dark:bg-[#0A1729]">
            {/* Dekorasi Cahaya Halus */}
            <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-brand-teal/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-brand-navy/15 blur-3xl dark:bg-brand-teal/10" />

            {/* Badge Sudut Atas */}
            <div className="absolute inset-x-8 top-8 z-10 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1 font-semibold text-foreground shadow-2xs">
                <ShieldCheck className="size-3.5 text-brand-teal" />
                Invite-Only Portal
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card/80 px-2.5 py-1 text-[11px]">
                <Clock className="size-3 text-brand-teal" />
                SLA 6 HK
              </span>
            </div>

            {/* Logo Utama di Tengah Panel Visual */}
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="rounded-3xl border border-border/80 bg-card/95 p-8 shadow-md backdrop-blur-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/logo-full-light.png"
                  alt="Logo Accelera HUB"
                  className="h-36 w-auto object-contain select-none dark:hidden"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/logo-full-dark.png"
                  alt="Logo Accelera HUB"
                  className="hidden h-36 w-auto object-contain select-none dark:block"
                />
              </div>
              <p className="mt-6 max-w-[260px] text-xs leading-relaxed text-muted-foreground">
                Sistem Verifikasi, Validasi &amp; Monitoring SLA 6 Hari Kerja
                Dokumen Penagihan Mitra Terintegrasi.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1.5 text-center text-xs text-balance text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary">
        <p>
          Akses khusus pengguna terdaftar (<em>Invite-Only</em>). Lupa akses
          akun? <Link href="/reset-password">Atur ulang password</Link> atau
          hubungi Admin Accelera.
        </p>
        <p className="text-[11px]">
          <Link href="/privacy">Kebijakan Privasi</Link> •{" "}
          <Link href="/terms">Ketentuan Layanan</Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col overflow-x-clip bg-muted/60 dark:bg-background">
      {/* Top Bar Ringkas */}
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 pt-5 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Kembali ke Beranda
        </Link>
        <ThemeToggle showLabel />
      </div>

      {/* Center Container mengikuti struktur shadcn login-04 */}
      <main className="flex flex-1 flex-col items-center justify-center p-4 sm:p-6 md:p-10">
        <div className="w-full max-w-sm md:max-w-3xl">
          <Suspense
            fallback={
              <div className="mx-auto flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-brand-teal" />
                Memuat halaman login...
              </div>
            }
          >
            <LoginForm04 />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

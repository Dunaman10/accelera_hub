"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getHomeRouteForRole } from "@/lib/constants";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ERROR_MESSAGES: Record<string, string> = {
  account_inactive:
    "Akun Anda saat ini berstatus nonaktif. Silakan hubungi Admin Accelera.",
  profile_not_found:
    "Profil akun belum terdaftar di sistem (Skema Invite-Only). Hubungi Admin Accelera.",
  invalid_role: "Role akun tidak valid. Silakan hubungi Administrator.",
  session_expired: "Sesi autentikasi telah berakhir. Silakan login kembali.",
};

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const nextParam = searchParams.get("next");

  const [activeTab, setActiveTab] = React.useState<"password" | "otp">(
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

  // State Reset Password Request
  const [showForgotModal, setShowForgotModal] = React.useState(false);
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
      const supabase = createClient();
      const redirectUrl = `${window.location.origin}/auth/callback${
        nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""
      }`;

      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false, // Skema Invite-Only: tolak pembuatan user baru otomatis
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) {
        toast.error(
          error.message.toLowerCase().includes("signups not allowed")
            ? "Email ini belum terdaftar di sistem (Skema Invite-Only). Hubungi Admin Accelera."
            : error.message
        );
        return;
      }

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
      setShowForgotModal(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengirim email pemulihan."
      );
    } finally {
      setLoadingForgot(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/15"
        >
          <FileCheck2 className="size-4" />
          Accelera HUB
        </Link>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Masuk ke Portal Penagihan
        </h1>
        <p className="text-sm text-muted-foreground">
          Sistem Verifikasi, Validasi &amp; Monitoring SLA 6 Hari Kerja
        </p>
      </div>

      {errorBannerMessage && (
        <div className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="flex-1 leading-relaxed">{errorBannerMessage}</div>
        </div>
      )}

      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Autentikasi Pengguna</CardTitle>
            <Badge variant="outline" className="text-[11px]">
              Invite-Only Access
            </Badge>
          </div>
          <CardDescription>
            Pilih metode masuk menggunakan Password atau Kode OTP / Magic Link
            Email.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-2">
          <Tabs
            value={activeTab}
            onValueChange={(val) => {
              setActiveTab(val as "password" | "otp");
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password" className="gap-1.5 text-xs">
                <Lock className="size-3.5" />
                Email &amp; Password
              </TabsTrigger>
              <TabsTrigger value="otp" className="gap-1.5 text-xs">
                <Sparkles className="size-3.5" />
                OTP / Magic Link
              </TabsTrigger>
            </TabsList>

            {/* METODE 1: EMAIL & PASSWORD */}
            <TabsContent value="password" className="mt-4">
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="login-email">Alamat Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="nama@perusahaan.co.id"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(email);
                        setShowForgotModal((prev) => !prev);
                      }}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Lupa password?
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Masukkan password Anda"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={loadingPassword}
                >
                  {loadingPassword ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Memverifikasi...
                    </>
                  ) : (
                    <>
                      Masuk dengan Password
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </Button>
              </form>

              {showForgotModal && (
                <form
                  onSubmit={handleRequestResetPassword}
                  className="mt-4 space-y-3 rounded-xl border bg-muted/40 p-3.5"
                >
                  <div className="space-y-1">
                    <p className="text-xs font-semibold">
                      Kirim Tautan Reset Password
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Kami akan mengirimkan tautan ke email Anda untuk menuju
                      halaman <code>/reset-password</code>.
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
                      size="sm"
                      onClick={() => setShowForgotModal(false)}
                    >
                      Batal
                    </Button>
                    <Button type="submit" size="sm" disabled={loadingForgot}>
                      {loadingForgot ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      Kirim Link Reset
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>

            {/* METODE 2: PASSWORDLESS (MAGIC LINK / OTP 6 DIGIT) */}
            <TabsContent value="otp" className="mt-4">
              {otpStep === "request" ? (
                <form
                  onSubmit={handleSendOtpOrMagicLink}
                  className="space-y-4"
                >
                  <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                    Solusi bebas lupa password bagi Mitra: masukkan email Anda
                    untuk menerima <strong>Kode OTP 6 Digit</strong> sekaligus{" "}
                    <strong>Magic Link</strong> sekali klik.
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="otp-email">Email Terdaftar</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                      <Input
                        id="otp-email"
                        type="email"
                        placeholder="pic@mitra-vendor.co.id"
                        required
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={loadingOtp}
                  >
                    {loadingOtp ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Mengirim Kode OTP...
                      </>
                    ) : (
                      <>
                        Kirim Kode OTP &amp; Magic Link
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtpCode} className="space-y-4">
                  <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                    <div>
                      Kode OTP 6 digit telah dikirim ke{" "}
                      <strong>{otpEmail}</strong>. Anda juga dapat langsung
                      mengeklik Magic Link di dalam email tersebut.
                    </div>
                  </div>

                  <div className="space-y-1.5">
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
                      className="text-center font-mono text-lg tracking-[0.4em]"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={loadingOtp || otpCode.length < 6}
                  >
                    {loadingOtp ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Memverifikasi OTP...
                      </>
                    ) : (
                      <>
                        Verifikasi &amp; Masuk
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpStep("request");
                        setOtpCode("");
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Ganti alamat email
                    </button>
                    <button
                      type="button"
                      onClick={handleSendOtpOrMagicLink}
                      disabled={loadingOtp}
                      className="font-medium text-primary hover:underline"
                    >
                      Kirim ulang kode
                    </button>
                  </div>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="flex-col items-start gap-2 border-t bg-muted/30 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="leading-relaxed">
              <strong>Pendaftaran Publik Ditutup (Invite-Only):</strong> Akun
              Mitra dan Internal hanya dapat didaftarkan oleh Admin Accelera
              atau Super Admin.
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-1 flex-col justify-center bg-muted/30 px-4 py-10">
      <Suspense
        fallback={
          <div className="mx-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Memuat portal autentikasi...
          </div>
        }
      >
        <LoginFormContent />
      </Suspense>
    </main>
  );
}

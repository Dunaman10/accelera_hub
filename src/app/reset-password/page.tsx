"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  Loader2,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getHomeRouteForRole } from "@/lib/constants";
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

export default function ResetPasswordPage() {
  const router = useRouter();
  const [checkingSession, setCheckingSession] = React.useState(true);
  const [hasSession, setHasSession] = React.useState(false);
  const [userEmail, setUserEmail] = React.useState<string | null>(null);

  // State saat belum punya sesi recovery (kirim email recovery)
  const [emailInput, setEmailInput] = React.useState("");
  const [sendingEmail, setSendingEmail] = React.useState(false);
  const [emailSent, setEmailSent] = React.useState(false);

  // State saat sudah punya sesi recovery (update password baru)
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [updatingPassword, setUpdatingPassword] = React.useState(false);

  React.useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setHasSession(true);
        setUserEmail(data.user.email ?? null);
      }
      setCheckingSession(false);
    });
  }, []);

  async function handleSendResetEmail(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Masukkan alamat email terdaftar Anda.");
      return;
    }

    setSendingEmail(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      setEmailSent(true);
      toast.success("Tautan pemulihan password telah dikirim ke email Anda.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengirim tautan reset."
      );
    } finally {
      setSendingEmail(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Password baru minimal terdiri dari 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Konfirmasi password tidak cocok.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error || !data.user) {
        toast.error(error?.message ?? "Gagal memperbarui password.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .maybeSingle();

      toast.success("Password berhasil diperbarui!");
      router.replace(getHomeRouteForRole(profile?.role));
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Terjadi kesalahan sistem."
      );
    } finally {
      setUpdatingPassword(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-1 flex-col justify-center bg-muted/30 px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-sm font-semibold text-primary"
          >
            <FileCheck2 className="size-4" />
            Accelera HUB
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            Atur Ulang Password
          </h1>
          <p className="text-sm text-muted-foreground">
            Perbarui kata sandi akun Accelera HUB Anda dengan aman
          </p>
        </div>

        <Card className="border-border/80 shadow-sm">
          {checkingSession ? (
            <CardContent className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Memeriksa sesi pemulihan...
            </CardContent>
          ) : hasSession ? (
            <>
              <CardHeader>
                <CardTitle className="text-base">Buat Password Baru</CardTitle>
                <CardDescription>
                  Masukkan password baru untuk akun{" "}
                  <strong>{userEmail ?? "Anda"}</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password">
                      Password Baru (Minimal 8 Karakter)
                    </Label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                      <Input
                        id="new-password"
                        type="password"
                        required
                        minLength={8}
                        placeholder="Minimal 8 karakter"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password">
                      Konfirmasi Password Baru
                    </Label>
                    <div className="relative">
                      <KeyRound className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        required
                        minLength={8}
                        placeholder="Ulangi password baru"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={updatingPassword}
                  >
                    {updatingPassword ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Menyimpan Password...
                      </>
                    ) : (
                      "Simpan Password Baru"
                    )}
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-base">
                  Minta Tautan Pemulihan Password
                </CardTitle>
                <CardDescription>
                  Masukkan email akun Anda. Kami akan mengirimkan tautan untuk
                  mengatur ulang password.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {emailSent ? (
                  <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                    <div className="leading-relaxed">
                      Tautan pemulihan telah dikirim ke{" "}
                      <strong>{emailInput}</strong>. Silakan buka kotak masuk
                      email Anda dan klik tautan tersebut untuk membuka formulir
                      password baru.
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSendResetEmail} className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="reset-email">Email Terdaftar</Label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
                        <Input
                          id="reset-email"
                          type="email"
                          required
                          placeholder="nama@perusahaan.co.id"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={sendingEmail}
                    >
                      {sendingEmail ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Mengirim Tautan...
                        </>
                      ) : (
                        "Kirim Tautan Reset Password"
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </>
          )}

          <CardFooter className="border-t bg-muted/30">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              Kembali ke Halaman Login
            </Link>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}

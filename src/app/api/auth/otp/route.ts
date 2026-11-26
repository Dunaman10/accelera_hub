import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { sendResendEmail } from "@/lib/notifications";

function buildOtpMagicLinkEmail(params: {
  fullName: string;
  otpCode: string;
  magicLink: string;
}): { subject: string; html: string; text: string } {
  const { fullName, otpCode, magicLink } = params;
  const safeName = fullName
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const subject = `[Accelera HUB] Kode OTP (${otpCode}) & Tautan Masuk Portal`;

  const html = `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; background-color: #f4f7fa; padding: 32px 16px; margin: 0;">
      <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border: 1px solid #d8e2ec; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(11, 46, 92, 0.06);">
        <!-- Header Navy + Aksen Teal -->
        <div style="background-color: #0B2E5C; padding: 24px 28px; border-bottom: 4px solid #059C95;">
          <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #ffffff;">
            ACCELERA <span style="color: #2dd4bf;">HUB</span>
          </h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #cbd5e1;">
            Sistem Verifikasi, Validasi &amp; Monitoring SLA 6 Hari Kerja
          </p>
        </div>

        <!-- Body -->
        <div style="padding: 28px; color: #0a192f; font-size: 14px; line-height: 1.6;">
          <p style="margin: 0 0 12px 0;">Yth. Bapak/Ibu <strong>${safeName}</strong>,</p>
          <p style="margin: 0 0 20px 0; color: #475569;">
            Kami menerima permintaan masuk ke Portal <strong>Accelera HUB</strong>. Anda dapat menggunakan <strong>Kode OTP 6 Digit</strong> di bawah ini atau mengeklik tombol <strong>Magic Link</strong> untuk masuk secara langsung:
          </p>

          <!-- Kotak Kode OTP -->
          <div style="background-color: #f4f7fa; border: 1px dashed #059C95; border-radius: 12px; padding: 20px; text-align: center; margin: 0 0 24px 0;">
            <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #066a65;">
              Kode Verifikasi OTP Anda
            </p>
            <div style="font-family: 'Courier New', monospace; font-size: 32px; font-weight: 800; letter-spacing: 0.3em; color: #0B2E5C;">
              ${otpCode}
            </div>
          </div>

          <!-- Tombol Magic Link -->
          <div style="text-align: center; margin: 0 0 24px 0;">
            <a href="${magicLink}" style="display: inline-block; background-color: #059C95; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 10px;">
              Masuk ke Accelera HUB
            </a>
          </div>

          <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5;">
            Kode OTP dan tautan ini bersifat rahasia, hanya berlaku sementara, dan hanya dapat digunakan satu kali. Jika Anda tidak merasa meminta akses ini, silakan abaikan email ini.
          </p>
        </div>

        <!-- Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 28px; text-align: center; font-size: 11px; color: #64748b;">
          Email ini dikirim secara otomatis oleh sistem <strong>Accelera HUB</strong>. Mohon tidak membalas email ini.
        </div>
      </div>
    </div>
  `;

  const text = `Yth. ${fullName}, Kode OTP Accelera HUB Anda adalah: ${otpCode}. Atau klik tautan berikut untuk masuk langsung: ${magicLink}`;

  return { subject, html, text };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: string;
      next?: string | null;
    };

    const cleanEmail = body.email?.trim().toLowerCase();
    if (!cleanEmail) {
      return NextResponse.json(
        { ok: false, error: "Masukkan alamat email yang terdaftar." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // 1. Validasi Invite-Only: pastikan email terdaftar & aktif di tabel profiles
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("id, full_name, is_active")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Email ini belum terdaftar di sistem (Skema Invite-Only). Hubungi Admin Accelera.",
        },
        { status: 404 }
      );
    }

    if (!profile.is_active) {
      return NextResponse.json(
        {
          ok: false,
          error: "Akun Anda sedang dinonaktifkan oleh Admin Accelera.",
        },
        { status: 403 }
      );
    }

    // 2. Generate Magic Link + Kode OTP 6 Digit melalui Supabase Admin API
    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const redirectTo = `${origin.replace(/\/$/, "")}/auth/callback${
      body.next && body.next.startsWith("/") && !body.next.startsWith("//")
        ? `?next=${encodeURIComponent(body.next)}`
        : ""
    }`;

    const { data: linkData, error: linkError } =
      await adminSupabase.auth.admin.generateLink({
        type: "magiclink",
        email: cleanEmail,
        options: { redirectTo },
      });

    if (
      linkError ||
      !linkData?.properties?.email_otp ||
      !linkData?.properties?.action_link
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            linkError?.message ?? "Gagal membuat kode OTP & tautan masuk.",
        },
        { status: 500 }
      );
    }

    // 3. Kirim email profesional beridentitas Accelera HUB via Resend
    const emailTemplate = buildOtpMagicLinkEmail({
      fullName: profile.full_name || cleanEmail,
      otpCode: linkData.properties.email_otp,
      magicLink: linkData.properties.action_link,
    });

    const dispatch = await sendResendEmail({
      to: cleanEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (!dispatch.sent) {
      return NextResponse.json(
        {
          ok: false,
          fallbackToSupabase: true,
          error:
            dispatch.error ||
            dispatch.skippedReason ||
            "Layanan email Resend belum aktif.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memproses permintaan OTP.",
      },
      { status: 500 }
    );
  }
}

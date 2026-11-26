import { STAGE_LABELS, formatRupiah } from "@/lib/constants";
import type { BillingSubmission, SubmissionStage, UserRole, Vendor } from "@/types";

export interface SendResendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface NotificationDispatchResult {
  sent: boolean;
  skippedReason?: string;
  error?: string;
}

/**
 * Mengirim email transaksional melalui Resend REST API murni via `fetch()`
 * (Kompatibel Edge/Cloudflare Workers, tanpa SDK berat).
 * Melakukan graceful fallback jika `RESEND_API_KEY` belum diisi atau masih placeholder.
 */
export async function sendResendEmail({
  to,
  subject,
  html,
  text,
}: SendResendEmailParams): Promise<NotificationDispatchResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey || apiKey === "re_your_resend_api_key") {
    return {
      sent: false,
      skippedReason: "RESEND_API_KEY belum dikonfigurasi (graceful fallback).",
    };
  }

  const recipients = (Array.isArray(to) ? to : [to])
    .map((e) => e.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return {
      sent: false,
      skippedReason: "Alamat email penerima kosong.",
    };
  }

  const fromEmail =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Accelera HUB <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: recipients,
        subject,
        html,
        ...(text ? { text } : {}),
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(
        `[Resend Email Fallback] HTTP ${response.status}: ${errBody}`
      );
      return {
        sent: false,
        error: `Resend HTTP ${response.status}: ${errBody}`,
      };
    }

    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown Resend error";
    console.warn(`[Resend Email Fallback] ${msg}`);
    return {
      sent: false,
      error: msg,
    };
  }
}

/**
 * Mengirim pesan notifikasi ke grup Telegram internal via Bot API `fetch()` murni.
 * Melakukan graceful fallback apabila `TELEGRAM_BOT_TOKEN` atau `TELEGRAM_CHAT_ID` belum dikonfigurasi.
 */
export async function sendTelegramMessage(
  htmlMessage: string
): Promise<NotificationDispatchResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();

  if (
    !botToken ||
    !chatId ||
    botToken.includes("ABCdefGHIjklMNOpqrsTUVwxyz") ||
    chatId === "-1001234567890"
  ) {
    return {
      sent: false,
      skippedReason:
        "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum dikonfigurasi (graceful fallback).",
    };
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: htmlMessage,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.warn(`[Telegram Bot Fallback] HTTP ${response.status}: ${errBody}`);
      return {
        sent: false,
        error: `Telegram HTTP ${response.status}: ${errBody}`,
      };
    }

    return { sent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown Telegram error";
    console.warn(`[Telegram Bot Fallback] ${msg}`);
    return {
      sent: false,
      error: msg,
    };
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Menyusun HTML email profesional untuk Mitra pada 3 peristiwa utama:
 * 1. Pre-Check Pass (`precheck_pass`)
 * 2. Diminta Revisi (`revision_requested` — memuat catatan temuan)
 * 3. SPP Selesai (`spp_completed`)
 */
export function buildMitraEmailTemplate(params: {
  eventType: "precheck_pass" | "revision_requested" | "spp_completed";
  submission: BillingSubmission;
  vendorName: string;
  findings?: string | null;
  sppNo?: string | null;
  appUrl?: string;
}): { subject: string; html: string; text: string } {
  const {
    eventType,
    submission,
    vendorName,
    findings,
    sppNo,
    appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  } = params;

  const detailUrl = `${appUrl.replace(/\/$/, "")}/mitra/submissions/${submission.id}`;
  const formattedAmount = formatRupiah(Number(submission.amount));

  if (eventType === "precheck_pass") {
    const subject = `[Accelera HUB] Pre-Check Softcopy PASS — ${submission.agenda_no} (${submission.invoice_no})`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #0B2E5C; color: #ffffff; padding: 18px 24px; border-bottom: 3px solid #059C95;">
          <h2 style="margin: 0; font-size: 18px;">ACCELERA HUB — Pre-Check Softcopy PASS</h2>
        </div>
        <div style="padding: 20px 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">
          <p>Yth. Bapak/Ibu PIC <strong>${escapeHtml(vendorName)}</strong>,</p>
          <p>Dokumen softcopy pengajuan tagihan Anda telah dinyatakan <strong>PASS</strong> pada tahap Pre-Check Softcopy:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px;">
            <tr><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Nomor Agenda</td><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${escapeHtml(submission.agenda_no)}</td></tr>
            <tr><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Nomor Invoice</td><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${escapeHtml(submission.invoice_no)}</td></tr>
            <tr><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Jenis Pekerjaan</td><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(submission.work_type)}</td></tr>
            <tr><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Nilai Tagihan</td><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${escapeHtml(formattedAmount)}</td></tr>
          </table>
          <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; margin: 14px 0;">
            <strong>Instruksi Tindak Lanjut:</strong><br/>
            Silakan kirimkan berkas fisik (Hardcopy) asli ke Loket Accelera dengan mencantumkan Nomor Agenda <strong>${escapeHtml(submission.agenda_no)}</strong> pada amplop dokumen.
          </div>
          <p style="margin-top: 20px;">
            <a href="${detailUrl}" style="background-color: #0B2E5C; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: bold; display: inline-block;">Lihat Detail Pengajuan</a>
          </p>
        </div>
      </div>
    `;
    const text = `Yth. ${vendorName}, Pre-Check Softcopy untuk No. Agenda ${submission.agenda_no} (Invoice: ${submission.invoice_no}) telah dinyatakan PASS. Silakan kirimkan berkas fisik (Hardcopy) ke Loket Accelera. Detail: ${detailUrl}`;
    return { subject, html, text };
  }

  if (eventType === "revision_requested") {
    const cleanFindings = findings?.trim() || submission.findings || "Mohon periksa kelengkapan dokumen Anda.";
    const subject = `[Accelera HUB] Permintaan Revisi Dokumen — ${submission.agenda_no} (${submission.invoice_no})`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #C55A11; color: #ffffff; padding: 18px 24px;">
          <h2 style="margin: 0; font-size: 18px;">ACCELERA HUB — Permintaan Revisi Dokumen</h2>
        </div>
        <div style="padding: 20px 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">
          <p>Yth. Bapak/Ibu PIC <strong>${escapeHtml(vendorName)}</strong>,</p>
          <p>Terdapat catatan temuan/kekurangan pada pemeriksaan pengajuan tagihan Anda:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px;">
            <tr><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Nomor Agenda</td><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${escapeHtml(submission.agenda_no)}</td></tr>
            <tr><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Nomor Invoice</td><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${escapeHtml(submission.invoice_no)}</td></tr>
            <tr><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Tahap Pemeriksaan</td><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${escapeHtml(STAGE_LABELS[submission.current_stage])}</td></tr>
            <tr><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Nilai Tagihan</td><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${escapeHtml(formattedAmount)}</td></tr>
          </table>
          <div style="background-color: #fff7ed; border-left: 4px solid #C55A11; padding: 12px 16px; margin: 14px 0;">
            <strong>Catatan Temuan / Kekurangan:</strong><br/>
            ${escapeHtml(cleanFindings)}
          </div>
          <p>Selama menunggu perbaikan dari Mitra, perhitungan SLA internal dihentikan sementara (<em>Auto-Pause</em>). Silakan unggah dokumen revisi melalui Portal Mitra:</p>
          <p style="margin-top: 20px;">
            <a href="${detailUrl}" style="background-color: #C55A11; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: bold; display: inline-block;">Unggah Dokumen Revisi</a>
          </p>
        </div>
      </div>
    `;
    const text = `Yth. ${vendorName}, Terdapat permintaan revisi untuk No. Agenda ${submission.agenda_no} (Invoice: ${submission.invoice_no}). Catatan Temuan: "${cleanFindings}". Silakan unggah dokumen revisi di Portal Mitra: ${detailUrl}`;
    return { subject, html, text };
  }

  // spp_completed
  const subject = `[Accelera HUB] SPP Resmi Terbit (${sppNo ?? "Selesai"}) — ${submission.agenda_no}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
      <div style="background-color: #059C95; color: #ffffff; padding: 18px 24px;">
        <h2 style="margin: 0; font-size: 18px;">ACCELERA HUB — SPP Resmi Diterbitkan</h2>
      </div>
      <div style="padding: 20px 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">
        <p>Yth. Bapak/Ibu PIC <strong>${escapeHtml(vendorName)}</strong>,</p>
        <p>Seluruh rangkaian verifikasi &amp; validasi tagihan Anda telah <strong>SELESAI</strong> dan Surat Pengajuan Pembayaran (SPP) telah diterbitkan ke bagian Keuangan:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px;">
          <tr><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Nomor SPP</td><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #059C95;">${escapeHtml(sppNo || "-")}</td></tr>
          <tr><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Nomor Agenda</td><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${escapeHtml(submission.agenda_no)}</td></tr>
          <tr><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Nomor Invoice</td><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${escapeHtml(submission.invoice_no)}</td></tr>
          <tr><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Nilai Tagihan</td><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${escapeHtml(formattedAmount)}</td></tr>
          <tr><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Durasi SLA Internal</td><td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${submission.actual_working_days} / ${submission.sla_target_days} Hari Kerja (${escapeHtml(submission.sla_status)})</td></tr>
        </table>
        <p style="margin-top: 20px;">
          <a href="${detailUrl}" style="background-color: #059C95; color: #ffffff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: bold; display: inline-block;">Lihat Status &amp; Bukti SPP</a>
        </p>
      </div>
    </div>
  `;
  const text = `Yth. ${vendorName}, SPP (${sppNo || "-"}) untuk No. Agenda ${submission.agenda_no} (Invoice: ${submission.invoice_no}) telah resmi diterbitkan dan dikirim ke Keuangan. Detail: ${detailUrl}`;
  return { subject, html, text };
}

/**
 * Menyusun pesan Telegram internal setiap kali terjadi perpindahan tahap (`stage transition`).
 */
export function buildTelegramStageTransitionMessage(params: {
  submission: BillingSubmission;
  vendorName: string;
  fromStage: SubmissionStage | null;
  toStage: SubmissionStage;
  decisionLabel: string;
  actorName: string;
  findings?: string | null;
  sppNo?: string | null;
}): string {
  const {
    submission,
    vendorName,
    fromStage,
    toStage,
    decisionLabel,
    actorName,
    findings,
    sppNo,
  } = params;

  const fromLabel = fromStage ? STAGE_LABELS[fromStage] : "Pengajuan Baru";
  const toLabel = STAGE_LABELS[toStage];

  const lines = [
    `🔔 <b>ACCELERA HUB — UPDATE TAHAP TAGIHAN</b>`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📌 <b>No. Agenda:</b> <code>${escapeHtml(submission.agenda_no)}</code>`,
    `🏢 <b>Mitra/Vendor:</b> ${escapeHtml(vendorName)}`,
    `🧾 <b>No. Invoice:</b> <code>${escapeHtml(submission.invoice_no)}</code>`,
    `💰 <b>Nilai:</b> ${escapeHtml(formatRupiah(Number(submission.amount)))}`,
    `🔄 <b>Transisi:</b> ${escapeHtml(fromLabel)} ➡️ <b>${escapeHtml(toLabel)}</b>`,
    `✅ <b>Keputusan:</b> ${escapeHtml(decisionLabel)}`,
    `👤 <b>Oleh:</b> ${escapeHtml(actorName)}`,
    `⏱️ <b>SLA Internal:</b> ${submission.actual_working_days}/${submission.sla_target_days} HK (<b>${escapeHtml(submission.sla_status)}</b>)`,
  ];

  if (sppNo) {
    lines.push(`📄 <b>Nomor SPP:</b> <code>${escapeHtml(sppNo)}</code>`);
  }

  if (findings?.trim()) {
    lines.push(`⚠️ <b>Catatan/Temuan:</b> ${escapeHtml(findings.trim())}`);
  }

  return lines.join("\n");
}

/**
 * Menormalkan nomor telepon Indonesia (`0812...`, `+62812...`, `62-812...`) menjadi format `62812...` untuk `https://wa.me/`.
 */
export function normalizeWhatsappPhone(rawPhone?: string | null): string {
  if (!rawPhone) return "";
  let digits = rawPhone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith("8")) {
    digits = `62${digits}`;
  }
  return digits;
}

/**
 * Membuat tautan pintas WhatsApp (`https://wa.me/{pic_phone}?text={template_otomatis}`)
 * berisi No. Agenda, No. Invoice, status terkini, dan ringkasan temuan.
 */
export function buildWhatsappFollowupUrl(params: {
  submission: BillingSubmission;
  vendor: Vendor | null;
  customFindings?: string | null;
}): string {
  const { submission, vendor, customFindings } = params;
  const phone = normalizeWhatsappPhone(vendor?.whatsapp_number);
  const picGreeting = vendor?.pic_name
    ? `Bapak/Ibu ${vendor.pic_name} (${vendor.name})`
    : vendor?.name || "Mitra/Vendor";

  const activeFindings =
    customFindings?.trim() ||
    submission.findings?.trim() ||
    "Tidak ada catatan temuan tambahan (mohon pantau tindak lanjut tahapan aktif).";

  const messageLines = [
    `Halo Yth. ${picGreeting},`,
    ``,
    `Kami dari Tim Admin *Accelera HUB* menginformasikan status terkini pengajuan dokumen penagihan Anda:`,
    `• *No. Agenda:* ${submission.agenda_no}`,
    `• *No. Invoice:* ${submission.invoice_no}`,
    `• *Jenis Pekerjaan:* ${submission.work_type}`,
    `• *Nilai Tagihan:* ${formatRupiah(Number(submission.amount))}`,
    `• *Tahap Saat Ini:* ${STAGE_LABELS[submission.current_stage]} (${submission.final_status})`,
    `• *Ringkasan Temuan / Catatan:* ${activeFindings}`,
    ``,
    `Mohon dapat segera ditindaklanjuti melalui Portal Mitra Accelera HUB. Terima kasih.`,
  ];

  const encodedText = encodeURIComponent(messageLines.join("\n"));
  return phone
    ? `https://wa.me/${phone}?text=${encodedText}`
    : `https://wa.me/?text=${encodedText}`;
}

/**
 * Menentukan URL tujuan detail pengajuan berdasarkan `role` pengguna saat notifikasi in-app diklik.
 */
export function getSubmissionDetailHrefForRole(
  role: UserRole,
  submissionId: string
): string {
  switch (role) {
    case "mitra":
      return `/mitra/submissions/${submissionId}`;
    case "admin_accelera":
      return `/admin/submissions/${submissionId}`;
    case "pic_usaha":
      return `/pic/submissions/${submissionId}`;
    case "akuntansi":
      return `/akuntansi/submissions/${submissionId}`;
    case "divisi_usaha":
      return `/spp/submissions/${submissionId}`;
    case "super_admin":
    default:
      return `/admin/submissions/${submissionId}`;
  }
}

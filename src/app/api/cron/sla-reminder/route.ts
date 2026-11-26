import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { recalculateSubmissionSlaServer } from "@/lib/sla/server";
import { sendTelegramMessage } from "@/lib/notifications";
import { STAGE_LABELS, formatRupiah } from "@/lib/constants";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * GET /api/cron/sla-reminder
 * Endpoint Cron Harian (dilindungi `Authorization: Bearer ${CRON_SECRET}`):
 * 1. Menjalankan `recalculateSubmissionSlaServer()` untuk seluruh tagihan yang masih berjalan (`final_status` IN ('Dalam Proses', 'Menunggu Mitra')).
 * 2. Mengumpulkan seluruh tagihan yang berstatus SLA `'Perlu Perhatian'` atau `'Terlambat'`.
 * 3. Mengirimkan **Daily Digest** ke Grup Telegram Internal.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  try {
    const startedAt = Date.now();
    const adminSupabase = createAdminClient();

    // Ambil seluruh tagihan aktif yang belum Selesai / Dibatalkan
    const { data: activeSubmissions, error: subError } = await adminSupabase
      .from("billing_submissions")
      .select("id")
      .not("final_status", "in", '("Selesai","Dibatalkan")');

    if (subError) {
      return NextResponse.json(
        { ok: false, error: subError.message },
        { status: 500 }
      );
    }

    // 1. Sinkronkan kalkulasi SLA untuk seluruh tagihan aktif
    const activeIds = (activeSubmissions ?? []).map((s) => s.id);
    for (const subId of activeIds) {
      await recalculateSubmissionSlaServer(subId);
    }

    // 2. Ambil daftar tagihan dengan sla_status IN ('Perlu Perhatian', 'Terlambat')
    const { data: attentionRows, error: queryErr } = await adminSupabase
      .from("billing_submissions")
      .select("*, vendors(name)")
      .in("sla_status", ["Perlu Perhatian", "Terlambat"])
      .neq("final_status", "Dibatalkan")
      .order("actual_working_days", { ascending: false });

    if (queryErr) {
      return NextResponse.json(
        { ok: false, error: queryErr.message },
        { status: 500 }
      );
    }

    const items = attentionRows ?? [];
    const overdueItems = items.filter((r) => r.sla_status === "Terlambat");
    const warningItems = items.filter((r) => r.sla_status === "Perlu Perhatian");

    const nowWib = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "full",
      timeStyle: "short",
    }).format(new Date());

    // 3. Susun pesan Daily Digest Telegram
    const digestLines: string[] = [
      `📊 <b>ACCELERA HUB — DAILY SLA DIGEST</b>`,
      `🗓️ <i>${escapeHtml(nowWib)} WIB</i>`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `🚨 <b>Terlambat (&gt; 6 HK):</b> ${overdueItems.length} tagihan`,
      `⚠️ <b>Perlu Perhatian:</b> ${warningItems.length} tagihan`,
      `📋 <b>Total Tagihan Dipantau:</b> ${activeIds.length} tagihan aktif`,
    ];

    if (items.length === 0) {
      digestLines.push(
        ``,
        `✅ <b>Seluruh pengajuan tagihan aktif berada dalam batas aman SLA.</b>`
      );
    } else {
      digestLines.push(``, `<b>Rincian Tagihan Prioritas:</b>`);
      for (const row of items.slice(0, 15)) {
        const vendorRel = row.vendors as
          | { name?: string }
          | Array<{ name?: string }>
          | null
          | undefined;
        const vendorName =
          (Array.isArray(vendorRel) ? vendorRel[0]?.name : vendorRel?.name) ??
          "Mitra";
        const icon = row.sla_status === "Terlambat" ? "🔴" : "🟠";

        digestLines.push(
          `${icon} <code>${escapeHtml(row.agenda_no)}</code> — <b>${escapeHtml(vendorName)}</b>`,
          `   • Invoice: <code>${escapeHtml(row.invoice_no)}</code> (${escapeHtml(formatRupiah(Number(row.amount)))})`,
          `   • Tahap: ${escapeHtml(STAGE_LABELS[row.current_stage])} (${escapeHtml(row.final_status)})`,
          `   • Durasi SLA: <b>${row.actual_working_days}/${row.sla_target_days} HK</b> [${escapeHtml(row.sla_status)}]`
        );
      }

      if (items.length > 15) {
        digestLines.push(
          `<i>...dan ${items.length - 15} tagihan lainnya di Dashboard Monitoring.</i>`
        );
      }
    }

    const telegramResult = await sendTelegramMessage(digestLines.join("\n"));

    return NextResponse.json({
      ok: true,
      recalculatedActiveCount: activeIds.length,
      overdueCount: overdueItems.length,
      warningCount: warningItems.length,
      telegram: telegramResult,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed running SLA reminder",
      },
      { status: 500 }
    );
  }
}

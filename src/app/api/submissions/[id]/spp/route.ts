import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  ensureSubmissionDriveFolder,
  uploadBinaryFileToDrive,
} from "@/lib/google-drive";
import {
  calculateWorkingDays,
} from "@/lib/sla";
import {
  fetchHolidayDateStrings,
  recalculateSubmissionSlaServer,
} from "@/lib/sla/server";
import {
  buildMitraEmailTemplate,
  buildTelegramStageTransitionMessage,
  sendResendEmail,
  sendTelegramMessage,
} from "@/lib/notifications";
import { generateSppPdf } from "@/lib/pdf/spp-pdf";
import type { BillingSubmission, Profile, SppDocument } from "@/types";

interface FinalizeSppRequestBody {
  notes?: string | null;
}

/**
 * Menghasilkan nomor SPP otomatis dengan format: `SPP/{TAHUN}/{BULAN}/{URUT}`
 * Contoh: `SPP/2026/11/0001`
 */
async function generateNextSppNumber(refDate: Date = new Date()): Promise<string> {
  const adminSupabase = createAdminClient();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(refDate);
  const year =
    parts.find((p) => p.type === "year")?.value ??
    String(refDate.getUTCFullYear());
  const month =
    parts.find((p) => p.type === "month")?.value ??
    String(refDate.getUTCMonth() + 1).padStart(2, "0");

  const prefix = `SPP/${year}/${month}/`;
  const { data: existingRows } = await adminSupabase
    .from("spp_documents")
    .select("spp_no")
    .like("spp_no", `SPP/${year}/%`);

  let maxSeq = 0;
  for (const row of existingRows ?? []) {
    const match = row.spp_no.match(/\/([0-9]+)$/);
    if (match) {
      const seq = Number(match[1]);
      if (Number.isFinite(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

/**
 * Menghasilkan token QR verifikasi unik (`qr_verification_hash` / `verification_qr_token`)
 */
function generateQrVerificationToken(): string {
  const randomUuid = crypto.randomUUID().replace(/-/g, "");
  return `SPP-${randomUuid.slice(0, 24).toUpperCase()}`;
}

/**
 * POST /api/submissions/[id]/spp
 * Finalisasi SPP (Penguncian Ketat 1:1):
 * - Wajib menolak pembuatan SPP jika `validation_status <> 'Lulus'` atau `spp_documents` untuk `submission_id` sudah ada.
 * - Saat Divisi Usaha / Akuntansi klik "Terbitkan SPP & Tandai Dikirim ke Keuangan":
 *   1. Generate PDF SPP (`pdf-lib` + `qrcode`) & unggah otomatis ke `drive_folder_id` pengajuan via Google Drive REST API (`fetch`).
 *   2. Simpan ke `spp_documents` (`submission_id`, `spp_no`, `generated_by`, `qr_verification_hash`, `drive_file_id`, `sent_to_finance_at = NOW()`).
 *   3. Update `billing_submissions`: `current_stage = 'COMPLETED'`, `final_status = 'Selesai'`, `followup_action = 'Selesai'`, `completed_date = NOW()`.
 *   4. Tutup `stage_logs` terakhir (`decision = 'spp_issued'`) dan kunci seluruh pengajuan menjadi read-only.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: submissionId } = await context.params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: "Sesi autentikasi tidak valid. Silakan login." },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, vendor_id, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.is_active) {
      return NextResponse.json(
        { ok: false, error: "Profil pengguna tidak aktif." },
        { status: 403 }
      );
    }

    const canIssueSpp =
      profile.role === "divisi_usaha" ||
      profile.role === "akuntansi" ||
      profile.role === "super_admin";

    if (!canIssueSpp) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Hanya Divisi Usaha atau Tim Akuntansi yang berwenang menerbitkan SPP.",
        },
        { status: 403 }
      );
    }

    let body: FinalizeSppRequestBody = {};
    try {
      body = (await request.json()) as FinalizeSppRequestBody;
    } catch {
      body = {};
    }

    const adminSupabase = createAdminClient();

    const { data: submission, error: subError } = await adminSupabase
      .from("billing_submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();

    if (subError || !submission) {
      return NextResponse.json(
        { ok: false, error: "Pengajuan tagihan tidak ditemukan." },
        { status: 404 }
      );
    }

    // ATURAN PENGUNCIAN KETAT 1:1
    // 1. Tolak jika validation_status !== 'Lulus'
    if (submission.validation_status !== "Lulus") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Blokir Penerbitan SPP: Pengajuan ini belum dinyatakan 'Lulus' pada tahap Validasi Akuntansi.",
        },
        { status: 400 }
      );
    }

    // 2. Tolak jika spp_documents untuk submission_id ini sudah ada (1:1 Strict Lock)
    const { data: existingSpp } = await adminSupabase
      .from("spp_documents")
      .select("*")
      .eq("submission_id", submission.id)
      .maybeSingle();

    if (existingSpp) {
      return NextResponse.json(
        {
          ok: false,
          error: `Blokir 1:1: Dokumen SPP (${existingSpp.spp_no}) untuk pengajuan ini sudah pernah diterbitkan dan bersifat Read-Only.`,
        },
        { status: 409 }
      );
    }

    // Ambil vendor & stage_logs untuk mengekstrak pejabat penyetuju (approved_pic_id & approved_acc_id)
    const [{ data: vendor }, { data: stageLogs }, { data: holidays }] =
      await Promise.all([
        adminSupabase
          .from("vendors")
          .select("*")
          .eq("id", submission.vendor_id)
          .maybeSingle(),
        adminSupabase
          .from("stage_logs")
          .select("*")
          .eq("submission_id", submission.id)
          .order("entered_at", { ascending: true }),
        adminSupabase.from("national_holidays").select("holiday_date"),
      ]);

    const logs = stageLogs ?? [];

    // Cari pejabat PIC Usaha & Akuntansi dari riwayat stage_logs
    let approvedPicId: string | null = null;
    let approvedAccId: string | null = null;

    for (const log of logs) {
      if (
        (log.from_stage === "PIC_APPROVAL" &&
          log.to_stage === "ACCOUNTING_APPROVAL") ||
        (log.to_stage === "PIC_APPROVAL" && log.decision === "approved")
      ) {
        if (log.action_by) approvedPicId = log.action_by;
      }
      if (
        (log.from_stage === "ACCOUNTING_APPROVAL" &&
          log.to_stage === "SPP_PROCESSING") ||
        (log.to_stage === "ACCOUNTING_APPROVAL" && log.decision === "approved")
      ) {
        if (log.action_by) approvedAccId = log.action_by;
      }
    }

    const actorIds = Array.from(
      new Set(
        [user.id, approvedPicId, approvedAccId].filter(
          (id): id is string => Boolean(id)
        )
      )
    );

    const { data: actorProfiles } =
      actorIds.length > 0
        ? await adminSupabase
            .from("profiles")
            .select("id, full_name, role")
            .in("id", actorIds)
        : { data: [] as Array<Pick<Profile, "id" | "full_name" | "role">> };

    const profileMap = new Map(
      (actorProfiles ?? []).map((p) => [p.id, p])
    );

    const nowIso = new Date().toISOString();
    const sppNo = await generateNextSppNumber(new Date(nowIso));
    const qrToken = generateQrVerificationToken();
    const origin =
      request.nextUrl.origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://accelera-hub.pages.dev";
    const qrVerificationUrl = `${origin}/verify/${encodeURIComponent(qrToken)}`;

    // 1. Generate PDF SPP menggunakan pdf-lib + qrcode
    const sppPdfBytes = await generateSppPdf({
      submission,
      vendor: vendor ?? null,
      sppNo,
      qrVerificationUrl,
      qrToken,
      issuedAt: nowIso,
      sentToFinanceAt: nowIso,
      createdByProfile: profileMap.get(user.id) ?? {
        id: profile.id,
        full_name: profile.full_name,
        role: profile.role,
      },
      approvedPicProfile: approvedPicId
        ? profileMap.get(approvedPicId) ?? null
        : null,
      approvedAccProfile: approvedAccId
        ? profileMap.get(approvedAccId) ?? null
        : null,
      notes: body.notes?.trim() || null,
    });

    // 2. Unggah otomatis PDF SPP ke drive_folder_id pengajuan via Google Drive REST API (fetch)
    let targetFolderId = submission.drive_folder_id;
    let driveFileId: string | null = null;
    let driveUploadWarning: string | null = null;

    try {
      if (!targetFolderId) {
        const ensured = await ensureSubmissionDriveFolder({
          agendaNo: submission.agenda_no,
          vendorName: vendor?.name ?? "Mitra",
          referenceDate: submission.received_date,
        });
        targetFolderId = ensured.submissionFolderId;
        await adminSupabase
          .from("billing_submissions")
          .update({ drive_folder_id: targetFolderId })
          .eq("id", submission.id);
      }

      if (targetFolderId) {
        const safeSppFileName = `${sppNo.replace(/\//g, "-")}_${submission.agenda_no.replace(
          /\//g,
          "-"
        )}.pdf`;
        const uploadedDriveFile = await uploadBinaryFileToDrive({
          fileName: safeSppFileName,
          mimeType: "application/pdf",
          folderId: targetFolderId,
          bytes: sppPdfBytes,
          description: `Surat Pengajuan Pembayaran Resmi (${sppNo}) - Agenda ${submission.agenda_no}`,
        });
        driveFileId = uploadedDriveFile.id;
      }
    } catch (driveErr) {
      driveUploadWarning =
        driveErr instanceof Error
          ? driveErr.message
          : "Gagal mengunggah PDF SPP ke Google Drive.";
      console.error("Google Drive SPP PDF upload warning:", driveUploadWarning);
    }

    // Susun catatan metadata audit pejabat penyetuju (approved_pic_id & approved_acc_id)
    const approvalMetaNote = [
      body.notes?.trim() ||
        `SPP ${sppNo} diterbitkan dan dikirim ke Keuangan.`,
      approvedPicId ? `approved_pic_id=${approvedPicId}` : null,
      approvedAccId ? `approved_acc_id=${approvedAccId}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    // 3. Simpan ke tabel spp_documents
    const { data: createdSpp, error: insertSppError } = await adminSupabase
      .from("spp_documents")
      .insert({
        submission_id: submission.id,
        spp_no: sppNo,
        generated_by: user.id,
        qr_verification_hash: qrToken,
        drive_file_id: driveFileId,
        sent_to_finance_at: nowIso,
        notes: approvalMetaNote,
        created_at: nowIso,
      })
      .select("*")
      .single();

    if (insertSppError || !createdSpp) {
      return NextResponse.json(
        {
          ok: false,
          error:
            insertSppError?.message ??
            "Gagal menyimpan dokumen SPP ke database.",
        },
        { status: 500 }
      );
    }

    // 4. Hitung final SLA & tutup stage_logs terakhir (decision = 'spp_issued')
    const holidayDates =
      holidays && holidays.length > 0
        ? holidays.map((h) => h.holiday_date)
        : await fetchHolidayDateStrings();
    const openLog = logs.find((l) => l.exited_at === null) ?? null;

    let openLogWorkingDays = 0;
    if (openLog) {
      openLogWorkingDays = openLog.is_paused
        ? 0
        : calculateWorkingDays(openLog.entered_at, nowIso, holidayDates);
    }

    if (openLog) {
      await adminSupabase
        .from("stage_logs")
        .update({
          exited_at: nowIso,
          working_days_spent: openLogWorkingDays,
          action_by: user.id,
          decision: "spp_issued",
        })
        .eq("id", openLog.id);
    }

    // Catat log final COMPLETED
    await adminSupabase.from("stage_logs").insert({
      submission_id: submission.id,
      from_stage: submission.current_stage,
      to_stage: "COMPLETED",
      entered_at: nowIso,
      exited_at: nowIso,
      is_paused: false,
      working_days_spent: 0,
      action_by: user.id,
      decision: "spp_issued",
      notes: `SPP ${sppNo} resmi diterbitkan dan ditandai dikirim ke Keuangan. Pengajuan dikunci (Read-Only).`,
    });

    // 5. Update billing_submissions menjadi COMPLETED & Selesai
    const { data: updatedSubmission, error: updateSubErr } = await adminSupabase
      .from("billing_submissions")
      .update({
        current_stage: "COMPLETED",
        final_status: "Selesai",
        followup_action: "Selesai",
        completed_date: nowIso,
      })
      .eq("id", submission.id)
      .select("*")
      .single();

    if (updateSubErr || !updatedSubmission) {
      return NextResponse.json(
        {
          ok: false,
          error:
            updateSubErr?.message ??
            "Gagal mengunci status akhir pengajuan tagihan.",
        },
        { status: 500 }
      );
    }

    // 6. Panggil mesin kalkulasi SLA (recalculate_submission_sla) agar durasi & status SLA sinkron
    const recalculatedSla = await recalculateSubmissionSlaServer(
      submission.id,
      nowIso
    );
    const finalSubmission =
      recalculatedSla.submission ?? (updatedSubmission as BillingSubmission);

    // 7. Kirim notifikasi In-App ke Mitra bahwa SPP telah selesai diterbitkan
    if (submission.submitted_by) {
      await adminSupabase.from("notifications").insert({
        recipient_id: submission.submitted_by,
        submission_id: submission.id,
        title: `SPP Terbit & Dikirim ke Keuangan (${sppNo})`,
        message: `Surat Pengajuan Pembayaran (${sppNo}) untuk invoice ${submission.invoice_no} (No. Agenda: ${submission.agenda_no}) telah resmi diterbitkan dan diteruskan ke Keuangan.`,
        channel: "IN_APP",
        is_read: false,
        sent_at: nowIso,
      });
    }

    // 8. Kirim Notifikasi Telegram ke Grup Internal
    const telegramMsg = buildTelegramStageTransitionMessage({
      submission: finalSubmission,
      vendorName: vendor?.name ?? "Mitra",
      fromStage: submission.current_stage,
      toStage: "COMPLETED",
      decisionLabel: `SPP Terbit & Dikirim ke Keuangan (${sppNo})`,
      actorName: profile.full_name,
      sppNo,
    });
    await sendTelegramMessage(telegramMsg);

    // 9. Kirim Email Otomatis (Resend REST API via fetch) ke Mitra saat SPP Selesai
    const { data: submitterProfile } = await adminSupabase
      .from("profiles")
      .select("email")
      .eq("id", submission.submitted_by)
      .maybeSingle();

    const mitraEmails = Array.from(
      new Set(
        [vendor?.email, submitterProfile?.email]
          .map((e) => e?.trim())
          .filter((e): e is string => Boolean(e))
      )
    );

    if (mitraEmails.length > 0) {
      const tpl = buildMitraEmailTemplate({
        eventType: "spp_completed",
        submission: finalSubmission,
        vendorName: vendor?.name ?? "Mitra",
        sppNo,
        appUrl: origin,
      });
      await sendResendEmail({
        to: mitraEmails,
        subject: tpl.subject,
        html: tpl.html,
        text: tpl.text,
      });
    }

    return NextResponse.json({
      ok: true,
      spp: createdSpp as SppDocument,
      submission: finalSubmission,
      drive_file_id: driveFileId,
      drive_upload_warning: driveUploadWarning,
      verification_url: qrVerificationUrl,
      metadata: {
        spp_number: createdSpp.spp_no,
        created_by: createdSpp.generated_by,
        approved_pic_id: approvedPicId,
        approved_acc_id: approvedAccId,
        verification_qr_token: createdSpp.qr_verification_hash,
        issued_at: createdSpp.created_at,
        sent_to_finance_at: createdSpp.sent_to_finance_at,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat menerbitkan SPP.",
      },
      { status: 500 }
    );
  }
}

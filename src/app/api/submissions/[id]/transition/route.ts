import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  calculateWorkingDays,
  isStagePaused,
  SLA_TOTAL_TARGET_DAYS,
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
import { STAGE_LABELS } from "@/lib/constants";
import type {
  BillingSubmission,
  CheckStatus,
  FinalStatus,
  FollowupStatus,
  PhysicalStatus,
  PrecheckStatus,
  SubmissionStage,
} from "@/types";

export type TransitionActionType =
  | "precheck_pass"
  | "precheck_revision"
  | "receive_hardcopy"
  | "physical_forward_pic"
  | "physical_revision"
  | "coord_forward_mitra"
  | "coord_return_internal"
  | "mitra_resubmit"
  | "pic_approve"
  | "pic_reject"
  | "akuntansi_approve"
  | "akuntansi_reject"
  | "cancel_submission";

export type AkuntansiRejectTarget = "revisi_mitra" | "return_pic";

interface TransitionRequestBody {
  action?: TransitionActionType;
  // Catatan temuan / kekurangan (mendukung alias findings / finding_notes / latest_notes / notes)
  findings?: string | null;
  finding_notes?: string | null;
  latest_notes?: string | null;
  notes?: string | null;
  // Tindak lanjut (mendukung alias followup_action / follow_up_action)
  followup_action?: string | null;
  follow_up_action?: string | null;
  followup_pic?: string | null;
  target_finish_date?: string | null;
  // Penerimaan hardcopy (mendukung alias hardcopy_date / hardcopy_received_at)
  hardcopy_date?: string | null;
  hardcopy_received_at?: string | null;
  // Status pemeriksaan cek fisik & verifikasi (mendukung alias physical_status / hardcopy_status)
  physical_status?: string | null;
  hardcopy_status?: string | null;
  verification_status?: string | null;
  validation_status?: string | null;
  // Tujuan pengembalian terarah dari Akuntansi ("revisi_mitra" | "return_pic")
  reject_target?: AkuntansiRejectTarget | null;
}

function normalizePhysicalStatus(raw?: string | null): PhysicalStatus | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (lower === "lengkap") return "Lengkap";
  if (lower === "tidak_lengkap" || lower === "tidak lengkap") {
    return "Tidak Lengkap";
  }
  if (lower === "belum_diperiksa" || lower === "belum diperiksa") {
    return "Belum Diperiksa";
  }
  return null;
}

function normalizeCheckStatus(raw?: string | null): CheckStatus | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (lower === "lulus") return "Lulus";
  if (lower === "tidak_lulus" || lower === "tidak lulus") {
    return "Tidak Lulus";
  }
  if (lower === "belum_diperiksa" || lower === "belum diperiksa") {
    return "Belum Diperiksa";
  }
  return null;
}

function normalizeFollowupStatus(raw?: string | null): FollowupStatus {
  if (!raw) return "Minta Revisi";
  const lower = raw.trim().toLowerCase();
  if (lower === "minta_revisi" || lower === "minta revisi") {
    return "Minta Revisi";
  }
  if (lower === "menunggu_dokumen" || lower === "menunggu dokumen") {
    return "Menunggu Dokumen";
  }
  if (lower === "koordinasi_internal" || lower === "koordinasi internal") {
    return "Koordinasi Internal";
  }
  if (lower === "selesai") return "Selesai";
  if (lower === "tidak_ada" || lower === "tidak ada") return "Tidak Ada";
  return "Minta Revisi";
}

/**
 * POST /api/submissions/[id]/transition
 * Endpoint State Machine Ketat untuk transisi tahap pemeriksaan Admin Accelera & Kirim Ulang Revisi Mitra.
 * - Tidak mengizinkan loncat status.
 * - Memblokir keras penerusan ke PIC Usaha (`PIC_APPROVAL`) jika `precheck_status !== 'Pass'`
 *   ATAU `physical_status !== 'Lengkap'` ATAU `verification_status !== 'Lulus'` ATAU `hardcopy_date IS NULL`.
 * - Menutup log `stage_logs` yang terbuka (`exited_at IS NULL`), menghitung `working_days_spent`
 *   (memotong Sabtu, Minggu, dan `national_holidays`), memperbarui `actual_working_days` & `sla_status`,
 *   serta membuka `stage_logs` baru dengan status `is_paused` yang sesuai.
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
      .select("id, full_name, role, vendor_id, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.is_active) {
      return NextResponse.json(
        { ok: false, error: "Profil pengguna tidak aktif." },
        { status: 403 }
      );
    }

    // Ambil data pengajuan (melalui client ber-RLS agar Mitra terisolasi)
    const { data: submission, error: subError } = await supabase
      .from("billing_submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();

    if (subError || !submission) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Pengajuan tagihan tidak ditemukan atau Anda tidak memiliki hak akses.",
        },
        { status: 404 }
      );
    }

    if (profile.role === "mitra") {
      if (!profile.vendor_id || submission.vendor_id !== profile.vendor_id) {
        return NextResponse.json(
          {
            ok: false,
            error: "403 Forbidden: Anda tidak berhak mengubah pengajuan ini.",
          },
          { status: 403 }
        );
      }
    }

    const body = (await request.json()) as TransitionRequestBody;
    const action = body.action;

    if (!action) {
      return NextResponse.json(
        { ok: false, error: "Parameter action transisi wajib diisi." },
        { status: 400 }
      );
    }

    // Resolusi input temuan/catatan
    const rawFindings = (
      body.findings ??
      body.finding_notes ??
      body.latest_notes ??
      ""
    ).trim();

    const rawFollowup = body.followup_action ?? body.follow_up_action ?? null;
    const rawHardcopyDate = (
      body.hardcopy_date ??
      body.hardcopy_received_at ??
      ""
    ).trim();

    const isAdminOrSuper =
      profile.role === "admin_accelera" || profile.role === "super_admin";
    const isPicOrSuper =
      profile.role === "pic_usaha" || profile.role === "super_admin";
    const isAkuntansiOrSuper =
      profile.role === "akuntansi" || profile.role === "super_admin";

    // Penguncian Read-Only jika pengajuan sudah COMPLETED / Selesai atau CANCELLED / Dibatalkan
    if (
      submission.current_stage === "COMPLETED" ||
      submission.final_status === "Selesai"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Pengajuan ini telah selesai dan SPP telah diterbitkan (Read-Only).",
        },
        { status: 400 }
      );
    }

    if (
      submission.current_stage === "CANCELLED" ||
      submission.final_status === "Dibatalkan"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Pengajuan ini sudah dibatalkan dan tidak dapat diubah lagi.",
        },
        { status: 400 }
      );
    }

    const currentStage = submission.current_stage;
    const nowIso = new Date().toISOString();

    let nextStage: SubmissionStage = currentStage;
    let nextFinalStatus: FinalStatus = submission.final_status;
    let nextPrecheckStatus: PrecheckStatus = submission.precheck_status;
    let nextPhysicalStatus: PhysicalStatus = submission.physical_status;
    let nextVerificationStatus: CheckStatus = submission.verification_status;
    let nextValidationStatus: CheckStatus = submission.validation_status;
    let nextFindings: string | null = submission.findings;
    let nextFollowupAction: FollowupStatus = submission.followup_action;
    let nextFollowupPic: string | null =
      body.followup_pic !== undefined
        ? body.followup_pic?.trim() || null
        : submission.followup_pic;
    let nextHardcopyDate: string | null = submission.hardcopy_date;
    let decisionLabel = "";
    let closeLogDecision: string | null = null;
    let logNotes = body.notes?.trim() || "";
    let notificationTitle = "";
    let notificationMessage = "";

    // =========================================================================
    // VALIDASI STATE MACHINE KETAT BERDASARKAN ACTION
    // =========================================================================

    switch (action) {
      // -----------------------------------------------------------------------
      // 1A. PRE-CHECK SOFTCOPY -> PASS (Menunggu Hardcopy, SLA PAUSE)
      // -----------------------------------------------------------------------
      case "precheck_pass": {
        if (!isAdminOrSuper) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Hanya Admin Accelera yang berwenang melakukan Pre-Check Softcopy.",
            },
            { status: 403 }
          );
        }

        if (currentStage !== "PRE_CHECK" && currentStage !== "SUBMITTED") {
          return NextResponse.json(
            {
              ok: false,
              error: `Transisi ditolak: Pengajuan sedang berada di tahap "${STAGE_LABELS[currentStage]}", bukan Pre-Check Softcopy.`,
            },
            { status: 400 }
          );
        }

        nextPrecheckStatus = "Pass";
        nextStage = "WAITING_HARDCOPY";
        nextFinalStatus = "Menunggu Mitra";
        nextFollowupAction = "Menunggu Dokumen";
        nextFindings = rawFindings || null;
        decisionLabel = "Pre-Check Softcopy: PASS";
        logNotes =
          logNotes ||
          rawFindings ||
          "Dokumen softcopy lengkap (Pass). Menunggu pengiriman berkas fisik (Hardcopy) dari Mitra. Timer SLA di-PAUSE.";
        notificationTitle = `Pre-Check Softcopy PASS (${submission.agenda_no})`;
        notificationMessage = `Pre-Check softcopy untuk invoice ${submission.invoice_no} dinyatakan PASS. Silakan kirimkan berkas fisik (Hardcopy) asli ke Loket Accelera dengan mencantumkan Nomor Agenda ${submission.agenda_no}.`;
        break;
      }

      // -----------------------------------------------------------------------
      // 1B. PRE-CHECK SOFTCOPY -> REVISI (Wajib isi Temuan, SLA PAUSE)
      // -----------------------------------------------------------------------
      case "precheck_revision": {
        if (!isAdminOrSuper) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Hanya Admin Accelera yang berwenang melakukan Pre-Check Softcopy.",
            },
            { status: 403 }
          );
        }

        if (currentStage !== "PRE_CHECK" && currentStage !== "SUBMITTED") {
          return NextResponse.json(
            {
              ok: false,
              error: `Transisi ditolak: Pengajuan sedang berada di tahap "${STAGE_LABELS[currentStage]}", bukan Pre-Check Softcopy.`,
            },
            { status: 400 }
          );
        }

        if (!rawFindings) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Catatan Temuan / Kekurangan wajib diisi saat meminta Revisi Softcopy.",
            },
            { status: 400 }
          );
        }

        nextPrecheckStatus = "Revisi";
        nextStage = "REVISION_SOFTCOPY";
        nextFinalStatus = "Menunggu Mitra";
        nextFindings = rawFindings;
        nextFollowupAction = normalizeFollowupStatus(
          rawFollowup ?? "Minta Revisi"
        );
        decisionLabel = "Pre-Check Softcopy: Minta Revisi";
        logNotes = `Temuan Pre-Check Softcopy: ${rawFindings}`;
        notificationTitle = `Permintaan Revisi Softcopy (${submission.agenda_no})`;
        notificationMessage = `Terdapat temuan pada Pre-Check Softcopy invoice ${submission.invoice_no}: "${rawFindings}". Silakan unggah dokumen revisi di Portal Mitra.`;
        break;
      }

      // -----------------------------------------------------------------------
      // 2. PENERIMAAN HARDCOPY -> CEK FISIK HARDCOPY (SLA RESUME)
      // -----------------------------------------------------------------------
      case "receive_hardcopy": {
        if (!isAdminOrSuper) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Hanya Admin Accelera yang berwenang mencatat penerimaan Hardcopy.",
            },
            { status: 403 }
          );
        }

        if (currentStage !== "WAITING_HARDCOPY") {
          return NextResponse.json(
            {
              ok: false,
              error: `Transisi ditolak: Pencatatan penerimaan hardcopy hanya dapat dilakukan pada tahap "Menunggu Kirim Fisik" (saat ini: ${STAGE_LABELS[currentStage]}).`,
            },
            { status: 400 }
          );
        }

        if (submission.precheck_status !== "Pass") {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Blokir State Machine: Pre-Check Softcopy belum dinyatakan Pass.",
            },
            { status: 400 }
          );
        }

        if (!rawHardcopyDate) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Tanggal & waktu penerimaan berkas fisik (hardcopy_date) wajib diisi.",
            },
            { status: 400 }
          );
        }

        const parsedDate = new Date(rawHardcopyDate);
        if (Number.isNaN(parsedDate.getTime())) {
          return NextResponse.json(
            {
              ok: false,
              error: "Format tanggal penerimaan hardcopy tidak valid.",
            },
            { status: 400 }
          );
        }

        nextHardcopyDate = parsedDate.toISOString();
        nextStage = "PHYSICAL_CHECK";
        nextFinalStatus = "Dalam Proses";
        nextFollowupAction = "Tidak Ada";
        decisionLabel = "Berkas Fisik (Hardcopy) Diterima";
        logNotes =
          logNotes ||
          `Berkas fisik (hardcopy) diterima di loket Accelera pada ${parsedDate.toLocaleString(
            "id-ID",
            { timeZone: "Asia/Jakarta" }
          )}. Timer SLA internal kembali aktif.`;
        notificationTitle = `Berkas Hardcopy Diterima (${submission.agenda_no})`;
        notificationMessage = `Berkas fisik untuk invoice ${submission.invoice_no} telah diterima di loket Accelera dan masuk tahap Cek Fisik & Verifikasi.`;
        break;
      }

      // -----------------------------------------------------------------------
      // 3A. CEK FISIK & VERIFIKASI -> TERUSKAN KE PIC USAHA (ATURAN BLOKIR KETAT)
      // -----------------------------------------------------------------------
      case "physical_forward_pic": {
        if (!isAdminOrSuper) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Hanya Admin Accelera yang berwenang meneruskan berkas ke PIC Usaha.",
            },
            { status: 403 }
          );
        }

        if (currentStage !== "PHYSICAL_CHECK") {
          return NextResponse.json(
            {
              ok: false,
              error: `Transisi ditolak: Pengajuan sedang berada di tahap "${STAGE_LABELS[currentStage]}", bukan Cek Fisik Hardcopy.`,
            },
            { status: 400 }
          );
        }

        const requestedPhysical =
          normalizePhysicalStatus(
            body.physical_status ?? body.hardcopy_status
          ) ?? submission.physical_status;
        const requestedVerification =
          normalizeCheckStatus(body.verification_status) ??
          submission.verification_status;
        const effectiveHardcopyDate = rawHardcopyDate
          ? new Date(rawHardcopyDate).toISOString()
          : submission.hardcopy_date;

        // ATURAN BLOKIR KETAT:
        // Hanya diizinkan jika precheck_status === 'Pass' AND physical_status === 'Lengkap'
        // AND verification_status === 'Lulus' AND hardcopy_date IS NOT NULL
        if (
          submission.precheck_status !== "Pass" ||
          requestedPhysical !== "Lengkap" ||
          requestedVerification !== "Lulus" ||
          !effectiveHardcopyDate
        ) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Blokir State Machine Ketat: Tidak dapat meneruskan ke PIC Usaha. Wajib memastikan Pre-Check Softcopy = 'Pass', Tanggal Hardcopy Diterima terisi, Cek Fisik Hardcopy = 'Lengkap', dan Status Verifikasi = 'Lulus'.",
            },
            { status: 400 }
          );
        }

        nextPhysicalStatus = "Lengkap";
        nextVerificationStatus = "Lulus";
        nextHardcopyDate = effectiveHardcopyDate;
        nextStage = "PIC_APPROVAL";
        nextFinalStatus = "Dalam Proses";
        nextFindings = rawFindings || null;
        nextFollowupAction = "Tidak Ada";
        decisionLabel = "Cek Fisik Lengkap & Lulus -> Teruskan ke PIC Usaha";
        logNotes =
          logNotes ||
          rawFindings ||
          "Pemeriksaan fisik dokumen asli dinyatakan Lengkap dan Lulus verifikasi administrasi. Berkas diteruskan ke PIC Usaha.";
        notificationTitle = `Diteruskan ke Approval PIC Usaha (${submission.agenda_no})`;
        notificationMessage = `Berkas fisik invoice ${submission.invoice_no} dinyatakan Lengkap & Lulus oleh Admin Accelera, kini sedang dalam tahap Approval PIC Usaha.`;
        break;
      }

      // -----------------------------------------------------------------------
      // 3B. CEK FISIK & VERIFIKASI -> REVISI HARDCOPY (Wajib Temuan & Tindak Lanjut, SLA PAUSE)
      // -----------------------------------------------------------------------
      case "physical_revision": {
        if (!isAdminOrSuper) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Hanya Admin Accelera yang berwenang menetapkan Revisi Cek Fisik.",
            },
            { status: 403 }
          );
        }

        if (currentStage !== "PHYSICAL_CHECK") {
          return NextResponse.json(
            {
              ok: false,
              error: `Transisi ditolak: Pengajuan sedang berada di tahap "${STAGE_LABELS[currentStage]}", bukan Cek Fisik Hardcopy.`,
            },
            { status: 400 }
          );
        }

        const requestedPhysical =
          normalizePhysicalStatus(
            body.physical_status ?? body.hardcopy_status
          ) ?? "Tidak Lengkap";
        const requestedVerification =
          normalizeCheckStatus(body.verification_status) ?? "Tidak Lulus";

        if (
          requestedPhysical === "Lengkap" &&
          requestedVerification === "Lulus"
        ) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Untuk meminta Revisi Fisik, status Cek Fisik harus 'Tidak Lengkap' atau status Verifikasi harus 'Tidak Lulus'.",
            },
            { status: 400 }
          );
        }

        if (!rawFindings) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Catatan Temuan & Tindak Lanjut wajib diisi apabila berkas fisik Tidak Lengkap atau Tidak Lulus.",
            },
            { status: 400 }
          );
        }

        nextPhysicalStatus = requestedPhysical;
        nextVerificationStatus = requestedVerification;
        nextStage = "REVISION_HARDCOPY";
        nextFinalStatus = "Menunggu Mitra";
        nextFindings = rawFindings;
        nextFollowupAction = normalizeFollowupStatus(
          rawFollowup ?? "Minta Revisi"
        );
        decisionLabel = `Revisi Cek Fisik (${requestedPhysical} / ${requestedVerification})`;
        logNotes = `Temuan Cek Fisik Hardcopy: ${rawFindings}`;
        notificationTitle = `Temuan Cek Fisik Hardcopy (${submission.agenda_no})`;
        notificationMessage = `Terdapat temuan pada pemeriksaan berkas fisik invoice ${submission.invoice_no}: "${rawFindings}". Mohon segera lengkapi/perbaiki dokumen Anda.`;
        break;
      }

      // -----------------------------------------------------------------------
      // 4A. KOORDINASI TEMUAN INTERNAL (PIC / AKUNTANSI) -> TERUSKAN KE MITRA (SLA PAUSE)
      // -----------------------------------------------------------------------
      case "coord_forward_mitra": {
        if (!isAdminOrSuper) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Hanya Admin Accelera yang berwenang mengoordinasikan temuan ke Mitra.",
            },
            { status: 403 }
          );
        }

        if (
          currentStage !== "REVISION_PIC" &&
          currentStage !== "REVISION_ACCOUNTING"
        ) {
          return NextResponse.json(
            {
              ok: false,
              error: `Transisi ditolak: Aksi koordinasi temuan hanya berlaku pada tahap Revisi PIC Usaha atau Revisi Akuntansi (saat ini: ${STAGE_LABELS[currentStage]}).`,
            },
            { status: 400 }
          );
        }

        const effectiveFindings =
          rawFindings || submission.findings?.trim() || "";
        if (!effectiveFindings) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Catatan temuan wajib diisi sebelum diteruskan kepada Mitra.",
            },
            { status: 400 }
          );
        }

        // Karena RLS policy `submissions_update_admin_accelera` mengizinkan WITH CHECK pada
        // ('REVISION_SOFTCOPY', 'REVISION_HARDCOPY', 'PHYSICAL_CHECK', 'PIC_APPROVAL', ...),
        // kita arahkan ke REVISION_HARDCOPY atau tetap di stage revisi dengan final_status = 'Menunggu Mitra'
        nextStage = currentStage;
        nextFinalStatus = "Menunggu Mitra";
        nextFindings = effectiveFindings;
        nextFollowupAction = normalizeFollowupStatus(
          rawFollowup ?? "Minta Revisi"
        );
        decisionLabel = `Teruskan Catatan Temuan ke Mitra (${STAGE_LABELS[currentStage]})`;
        logNotes = `Catatan temuan diteruskan oleh Admin Accelera ke Mitra: ${effectiveFindings}. Timer SLA di-PAUSE.`;
        notificationTitle = `Catatan Revisi Pemeriksaan (${submission.agenda_no})`;
        notificationMessage = `Admin Accelera meneruskan catatan perbaikan untuk invoice ${submission.invoice_no}: "${effectiveFindings}". Silakan unggah dokumen revisi di Portal Mitra.`;
        break;
      }

      // -----------------------------------------------------------------------
      // 4B. KOORDINASI TEMUAN INTERNAL -> KEMBALIKAN KE TAHAPAN INTERNAL RELEVAN (SLA RESUME)
      // -----------------------------------------------------------------------
      case "coord_return_internal": {
        if (!isAdminOrSuper) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Hanya Admin Accelera yang berwenang mengembalikan berkas hasil koordinasi.",
            },
            { status: 403 }
          );
        }

        if (
          currentStage !== "REVISION_PIC" &&
          currentStage !== "REVISION_ACCOUNTING"
        ) {
          return NextResponse.json(
            {
              ok: false,
              error: `Transisi ditolak: Pengajuan tidak sedang berada pada tahap Koordinasi Temuan Internal.`,
            },
            { status: 400 }
          );
        }

        // Kembalikan ke tahapan internal yang relevan
        nextStage =
          currentStage === "REVISION_PIC"
            ? "PIC_APPROVAL"
            : "ACCOUNTING_APPROVAL";
        nextFinalStatus = "Dalam Proses";
        nextFollowupAction = "Koordinasi Internal";
        if (rawFindings) {
          nextFindings = rawFindings;
        }
        decisionLabel = `Koordinasi Selesai -> Kembalikan ke ${STAGE_LABELS[nextStage]}`;
        logNotes =
          logNotes ||
          rawFindings ||
          `Perbaikan/koordinasi temuan selesai. Berkas dikembalikan ke tahap ${STAGE_LABELS[nextStage]} dan timer SLA kembali aktif.`;
        notificationTitle = `Pemeriksaan Dilanjutkan ke ${STAGE_LABELS[nextStage]} (${submission.agenda_no})`;
        notificationMessage = `Tindak lanjut revisi untuk invoice ${submission.invoice_no} telah selesai dikoordinasikan dan kembali diproses pada tahap ${STAGE_LABELS[nextStage]}.`;
        break;
      }

      // -----------------------------------------------------------------------
      // 5. MITRA KIRIM ULANG PENGAJUAN SETELAH UPLOAD REVISI (SLA RESUME)
      // -----------------------------------------------------------------------
      case "mitra_resubmit": {
        if (
          profile.role !== "mitra" &&
          profile.role !== "admin_accelera" &&
          profile.role !== "super_admin"
        ) {
          return NextResponse.json(
            {
              ok: false,
              error: "Anda tidak berwenang mengirim ulang pengajuan revisi ini.",
            },
            { status: 403 }
          );
        }

        const isRevisionStage =
          currentStage === "REVISION_SOFTCOPY" ||
          currentStage === "REVISION_HARDCOPY" ||
          currentStage === "REVISION_PIC" ||
          currentStage === "REVISION_ACCOUNTING";

        if (!isRevisionStage && submission.final_status !== "Menunggu Mitra") {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Pengajuan ini tidak sedang berada pada tahap Revisi.",
            },
            { status: 400 }
          );
        }

        // Tentukan tahapan pemeriksaan yang relevan setelah Mitra mengirim ulang:
        // - REVISION_SOFTCOPY -> PRE_CHECK (precheck_softcopy)
        // - REVISION_HARDCOPY / REVISION_PIC / REVISION_ACCOUNTING -> PHYSICAL_CHECK (cek_fisik_hardcopy)
        if (currentStage === "REVISION_SOFTCOPY") {
          nextStage = "PRE_CHECK";
          nextPrecheckStatus = "Belum Diperiksa";
        } else {
          nextStage = "PHYSICAL_CHECK";
        }

        nextFinalStatus = "Dalam Proses";
        nextFollowupAction = "Koordinasi Internal";
        decisionLabel = "Mitra Mengirim Ulang Dokumen Revisi";
        logNotes =
          logNotes ||
          rawFindings ||
          `Mitra telah mengunggah dokumen revisi dan mengirim ulang pengajuan ke tahap ${STAGE_LABELS[nextStage]}. Timer SLA internal kembali aktif.`;
        notificationTitle = `Revisi Dikirim Ulang oleh Mitra (${submission.agenda_no})`;
        notificationMessage = `Dokumen revisi untuk invoice ${submission.invoice_no} telah dikirim ulang dan masuk kembali ke antrean ${STAGE_LABELS[nextStage]}.`;
        break;
      }

      // -----------------------------------------------------------------------
      // 6A. APPROVAL PIC USAHA -> SETUJUI (Lanjut ke Approval Akuntansi, SLA 2 HK)
      // -----------------------------------------------------------------------
      case "pic_approve": {
        if (!isPicOrSuper) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Hanya PIC Usaha yang berwenang menyetujui substansi pekerjaan pada tahap ini.",
            },
            { status: 403 }
          );
        }

        if (currentStage !== "PIC_APPROVAL") {
          return NextResponse.json(
            {
              ok: false,
              error: `Transisi ditolak: Pengajuan sedang berada di tahap "${STAGE_LABELS[currentStage]}", bukan Approval PIC Usaha.`,
            },
            { status: 400 }
          );
        }

        nextVerificationStatus = "Lulus";
        nextStage = "ACCOUNTING_APPROVAL";
        nextFinalStatus = "Dalam Proses";
        nextFollowupAction = "Tidak Ada";
        nextFindings = rawFindings || null;
        closeLogDecision = "approved";
        decisionLabel = "Disetujui PIC Usaha -> Teruskan ke Akuntansi";
        logNotes =
          logNotes ||
          rawFindings ||
          "Substansi pekerjaan, BAST, dan nilai tagihan telah disetujui oleh PIC Usaha. Diteruskan ke tahap Approval Akuntansi (Target SLA: 2 Hari Kerja).";
        notificationTitle = `Disetujui PIC Usaha (${submission.agenda_no})`;
        notificationMessage = `Substansi pekerjaan untuk invoice ${submission.invoice_no} telah disetujui oleh PIC Usaha dan kini memasuki tahap Validasi Akuntansi & Perpajakan.`;
        break;
      }

      // -----------------------------------------------------------------------
      // 6B. APPROVAL PIC USAHA -> KEMBALIKAN UNTUK REVISI (Wajib Catatan, SLA PAUSE)
      // -----------------------------------------------------------------------
      case "pic_reject": {
        if (!isPicOrSuper) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Hanya PIC Usaha yang berwenang mengembalikan berkas pada tahap ini.",
            },
            { status: 403 }
          );
        }

        if (currentStage !== "PIC_APPROVAL") {
          return NextResponse.json(
            {
              ok: false,
              error: `Transisi ditolak: Pengajuan sedang berada di tahap "${STAGE_LABELS[currentStage]}", bukan Approval PIC Usaha.`,
            },
            { status: 400 }
          );
        }

        const effectivePicNotes = rawFindings || logNotes;
        if (!effectivePicNotes) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Catatan temuan (notes) wajib diisi saat mengembalikan pengajuan untuk revisi.",
            },
            { status: 400 }
          );
        }

        nextVerificationStatus = "Tidak Lulus";
        nextStage = "REVISION_PIC";
        nextFollowupAction = "Minta Revisi";
        nextFinalStatus = "Menunggu Mitra";
        nextFindings = effectivePicNotes;
        closeLogDecision = "rejected";
        decisionLabel = "Dikembalikan oleh PIC Usaha untuk Revisi";
        logNotes = `Temuan PIC Usaha: ${effectivePicNotes} (SLA di-PAUSE)`;
        notificationTitle = `Temuan Substansi PIC Usaha (${submission.agenda_no})`;
        notificationMessage = `Terdapat catatan temuan dari PIC Usaha pada invoice ${submission.invoice_no}: "${effectivePicNotes}".`;
        break;
      }

      // -----------------------------------------------------------------------
      // 7A. VALIDASI AKUNTANSI -> LULUS (Lanjut ke Penyusunan SPP, SLA 1 HK)
      // -----------------------------------------------------------------------
      case "akuntansi_approve": {
        if (!isAkuntansiOrSuper) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Hanya Tim Akuntansi yang berwenang menyatakan Validasi Lulus.",
            },
            { status: 403 }
          );
        }

        if (currentStage !== "ACCOUNTING_APPROVAL") {
          return NextResponse.json(
            {
              ok: false,
              error: `Transisi ditolak: Pengajuan sedang berada di tahap "${STAGE_LABELS[currentStage]}", bukan Approval Akuntansi.`,
            },
            { status: 400 }
          );
        }

        nextValidationStatus = "Lulus";
        nextStage = "SPP_PROCESSING";
        nextFinalStatus = "Dalam Proses";
        nextFollowupAction = "Tidak Ada";
        nextFindings = rawFindings || null;
        closeLogDecision = "approved";
        decisionLabel = "Validasi Akuntansi Lulus -> Penyusunan SPP";
        logNotes =
          logNotes ||
          rawFindings ||
          "Validasi nominal, DPP/PPN/PPh, Faktur Pajak, dan Kontrak/PO dinyatakan LULUS oleh Tim Akuntansi. Diteruskan ke tahap Penyusunan SPP (Target SLA: 1 Hari Kerja).";
        notificationTitle = `Validasi Akuntansi Lulus (${submission.agenda_no})`;
        notificationMessage = `Validasi perpajakan dan akuntansi untuk invoice ${submission.invoice_no} dinyatakan LULUS. Pengajuan kini berada pada tahap Penyusunan & Penerbitan SPP.`;
        break;
      }

      // -----------------------------------------------------------------------
      // 7B. VALIDASI AKUNTANSI -> TIDAK LULUS / TEMUAN (Tujuan Pengembalian Terarah)
      // -----------------------------------------------------------------------
      case "akuntansi_reject": {
        if (!isAkuntansiOrSuper) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Hanya Tim Akuntansi yang berwenang menetapkan temuan validasi akuntansi.",
            },
            { status: 403 }
          );
        }

        if (currentStage !== "ACCOUNTING_APPROVAL") {
          return NextResponse.json(
            {
              ok: false,
              error: `Transisi ditolak: Pengajuan sedang berada di tahap "${STAGE_LABELS[currentStage]}", bukan Approval Akuntansi.`,
            },
            { status: 400 }
          );
        }

        const effectiveAccNotes = rawFindings || logNotes;
        if (!effectiveAccNotes) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Rincian temuan wajib diisi apabila Validasi Akuntansi Tidak Lulus.",
            },
            { status: 400 }
          );
        }

        const rejectTarget: AkuntansiRejectTarget =
          body.reject_target === "return_pic" ? "return_pic" : "revisi_mitra";

        nextValidationStatus = "Tidak Lulus";
        nextFindings = effectiveAccNotes;
        closeLogDecision = "rejected";

        if (rejectTarget === "return_pic") {
          // Opsi B: Kembalikan ke PIC Usaha (SLA Internal Aktif)
          nextStage = "PIC_APPROVAL";
          nextFinalStatus = "Dalam Proses";
          nextFollowupAction = "Koordinasi Internal";
          if (!nextFollowupPic) nextFollowupPic = "PIC Usaha";
          decisionLabel =
            "Validasi Akuntansi Tidak Lulus -> Kembalikan ke PIC Usaha";
          logNotes = `Temuan Akuntansi (Dikembalikan ke PIC Usaha): ${effectiveAccNotes}`;
          notificationTitle = `Koordinasi Internal Akuntansi ke PIC Usaha (${submission.agenda_no})`;
          notificationMessage = `Tim Akuntansi mengembalikan berkas invoice ${submission.invoice_no} ke PIC Usaha untuk klarifikasi: "${effectiveAccNotes}".`;
        } else {
          // Opsi A: Koordinasi Admin Accelera / Revisi Mitra (SLA di-PAUSE)
          nextStage = "REVISION_ACCOUNTING";
          nextFinalStatus = "Menunggu Mitra";
          nextFollowupAction = "Minta Revisi";
          if (!nextFollowupPic) nextFollowupPic = "Mitra / Vendor";
          decisionLabel =
            "Validasi Akuntansi Tidak Lulus -> Revisi Mitra / Koordinasi Admin";
          logNotes = `Temuan Pajak / Akuntansi: ${effectiveAccNotes} (SLA di-PAUSE)`;
          notificationTitle = `Temuan Validasi Pajak & Akuntansi (${submission.agenda_no})`;
          notificationMessage = `Terdapat temuan validasi akuntansi/pajak pada invoice ${submission.invoice_no}: "${effectiveAccNotes}". Mohon perbaiki dokumen melalui Portal Mitra.`;
        }
        break;
      }

      // -----------------------------------------------------------------------
      // 8. PEMBATALAN PENGAJUAN (KHUSUS ADMIN ACCELERA & SUPER ADMIN SEBELUM SPP)
      // -----------------------------------------------------------------------
      case "cancel_submission": {
        if (!isAdminOrSuper) {
          return NextResponse.json(
            {
              ok: false,
              error:
                "Hanya Admin Accelera atau Super Admin yang berwenang membatalkan pengajuan.",
            },
            { status: 403 }
          );
        }

        const effectiveCancelReason = rawFindings || logNotes;
        if (!effectiveCancelReason) {
          return NextResponse.json(
            {
              ok: false,
              error: "Alasan pembatalan pengajuan wajib diisi.",
            },
            { status: 400 }
          );
        }

        nextStage = "CANCELLED";
        nextFinalStatus = "Dibatalkan";
        nextFindings = effectiveCancelReason;
        nextFollowupAction = "Selesai";
        closeLogDecision = "cancelled";
        decisionLabel = "Pengajuan Dibatalkan";
        logNotes = `Pengajuan dibatalkan: ${effectiveCancelReason}`;
        notificationTitle = `Pengajuan Tagihan Dibatalkan (${submission.agenda_no})`;
        notificationMessage = `Pengajuan tagihan untuk invoice ${submission.invoice_no} telah dibatalkan oleh ${profile.full_name} dengan alasan: "${effectiveCancelReason}". Nomor invoice kini dapat digunakan kembali jika ingin mengajukan ulang.`;
        break;
      }

      default: {
        return NextResponse.json(
          {
            ok: false,
            error: `Action transisi "${String(action)}" tidak dikenali.`,
          },
          { status: 400 }
        );
      }
    }

    // =========================================================================
    // PERHITUNGAN HARI KERJA SLA, UPDATE STAGE_LOGS & RECALCULATE_SUBMISSION_SLA
    // =========================================================================

    const [holidayDates, { data: allLogs }, { data: vendorRow }, { data: submitterProfile }] =
      await Promise.all([
        fetchHolidayDateStrings(),
        supabase
          .from("stage_logs")
          .select("*")
          .eq("submission_id", submission.id)
          .order("entered_at", { ascending: true }),
        supabase
          .from("vendors")
          .select("id, name, email, pic_name, whatsapp_number")
          .eq("id", submission.vendor_id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("id", submission.submitted_by)
          .maybeSingle(),
      ]);

    const existingLogs = allLogs ?? [];
    const openLog = existingLogs.find((l) => l.exited_at === null) ?? null;

    let openLogWorkingDays = 0;
    if (openLog) {
      openLogWorkingDays = openLog.is_paused
        ? 0
        : calculateWorkingDays(openLog.entered_at, nowIso, holidayDates);
    }

    // Apakah stage tujuan mem-PAUSE SLA?
    // (SLA di-PAUSE jika stage termasuk SLA_PAUSED_STAGES, CANCELLED, atau final_status === 'Menunggu Mitra')
    const nextIsPaused =
      nextStage === "CANCELLED" ||
      isStagePaused(nextStage) ||
      nextFinalStatus === "Menunggu Mitra";

    // Update billing_submissions
    const updatePayload = {
      current_stage: nextStage,
      final_status: nextFinalStatus,
      precheck_status: nextPrecheckStatus,
      physical_status: nextPhysicalStatus,
      verification_status: nextVerificationStatus,
      validation_status: nextValidationStatus,
      findings: nextFindings,
      followup_action: nextFollowupAction,
      followup_pic: nextFollowupPic,
      hardcopy_date: nextHardcopyDate,
      ...(body.target_finish_date !== undefined
        ? { target_finish_date: body.target_finish_date || null }
        : {}),
    };

    let { data: updatedSubmission, error: updateError } = await supabase
      .from("billing_submissions")
      .update(updatePayload)
      .eq("id", submission.id)
      .select("*")
      .maybeSingle();

    // Fallback ke adminClient bila transisi koordinasi internal lintas stage (misal REVISION_ACCOUNTING -> ACCOUNTING_APPROVAL oleh Admin Accelera)
    // tertahan oleh klausa WITH CHECK RLS spesifik role, setelah otorisasi role diverifikasi secara ketat di atas
    if (updateError || !updatedSubmission) {
      const adminSupabase = createAdminClient();
      const adminRes = await adminSupabase
        .from("billing_submissions")
        .update(updatePayload)
        .eq("id", submission.id)
        .select("*")
        .maybeSingle();
      updatedSubmission = adminRes.data;
      updateError = adminRes.error;
    }

    if (updateError || !updatedSubmission) {
      return NextResponse.json(
        {
          ok: false,
          error:
            updateError?.message ??
            "Gagal memperbarui status pengajuan tagihan.",
        },
        { status: 500 }
      );
    }

    // Tutup stage_log lama yang masih terbuka
    const adminSupabase = createAdminClient();
    if (openLog) {
      const closeLogUpdatePayload = {
        exited_at: nowIso,
        working_days_spent: openLogWorkingDays,
        ...(closeLogDecision
          ? {
              decision: closeLogDecision,
              action_by: user.id,
            }
          : {}),
      };

      const { error: closeLogErr } = await supabase
        .from("stage_logs")
        .update(closeLogUpdatePayload)
        .eq("id", openLog.id);

      if (closeLogErr) {
        await adminSupabase
          .from("stage_logs")
          .update(closeLogUpdatePayload)
          .eq("id", openLog.id);
      }
    }

    // Buka stage_log baru (langsung tutup bila CANCELLED agar SLA berhenti permanen)
    const newStageLogPayload = {
      submission_id: submission.id,
      from_stage: currentStage,
      to_stage: nextStage,
      entered_at: nowIso,
      exited_at: nextStage === "CANCELLED" ? nowIso : null,
      is_paused: nextIsPaused,
      working_days_spent: 0,
      action_by: user.id,
      decision: decisionLabel,
      notes: logNotes,
    };

    const { error: insertLogErr } = await supabase
      .from("stage_logs")
      .insert(newStageLogPayload);

    if (insertLogErr) {
      await adminSupabase.from("stage_logs").insert(newStageLogPayload);
    }

    // Panggil mesin kalkulasi SLA (recalculate_submission_sla) agar durasi aktual & status SLA selalu sinkron
    const recalculatedSla = await recalculateSubmissionSlaServer(
      submission.id,
      nowIso
    );
    const finalSubmission =
      recalculatedSla.submission ?? (updatedSubmission as BillingSubmission);

    // 1. Buat notifikasi In-App di tabel `notifications`
    if (notificationTitle && submission.submitted_by) {
      await adminSupabase.from("notifications").insert({
        recipient_id: submission.submitted_by,
        submission_id: submission.id,
        title: notificationTitle,
        message: notificationMessage,
        channel: "IN_APP",
        is_read: false,
        sent_at: nowIso,
      });
    }

    // Bila transisi menuju PIC Usaha / Akuntansi / SPP / Admin, kirim juga In-App Notification ke petugas terkait
    if (
      nextStage === "PIC_APPROVAL" ||
      nextStage === "ACCOUNTING_APPROVAL" ||
      nextStage === "SPP_PROCESSING" ||
      action === "mitra_resubmit"
    ) {
      const targetRoles =
        nextStage === "PIC_APPROVAL"
          ? ["pic_usaha"]
          : nextStage === "ACCOUNTING_APPROVAL"
          ? ["akuntansi"]
          : nextStage === "SPP_PROCESSING"
          ? ["divisi_usaha", "akuntansi"]
          : ["admin_accelera"];

      const { data: internalRecipients } = await adminSupabase
        .from("profiles")
        .select("id")
        .in("role", targetRoles as Array<"pic_usaha" | "akuntansi" | "divisi_usaha" | "admin_accelera">)
        .eq("is_active", true);

      if (internalRecipients && internalRecipients.length > 0) {
        const internalNotifRows = internalRecipients
          .filter((r) => r.id !== user.id)
          .map((r) => ({
            recipient_id: r.id,
            submission_id: submission.id,
            title: notificationTitle || `Antrean Baru: ${finalSubmission.agenda_no}`,
            message:
              notificationMessage ||
              `Pengajuan ${finalSubmission.agenda_no} masuk ke tahap ${STAGE_LABELS[nextStage]}.`,
            channel: "IN_APP",
            is_read: false,
            sent_at: nowIso,
          }));

        if (internalNotifRows.length > 0) {
          await adminSupabase.from("notifications").insert(internalNotifRows);
        }
      }
    }

    const vendorName = vendorRow?.name ?? "Mitra / Vendor";

    // 2. Kirim Notifikasi Telegram ke Grup Internal pada setiap perpindahan tahap
    const telegramMessage = buildTelegramStageTransitionMessage({
      submission: finalSubmission,
      vendorName,
      fromStage: currentStage,
      toStage: nextStage,
      decisionLabel,
      actorName: profile.full_name,
      findings: nextFindings,
    });
    await sendTelegramMessage(telegramMessage);

    // 3. Kirim Email Otomatis (Resend REST API via fetch) ke Mitra saat Pre-Check Pass atau Diminta Revisi
    const mitraEmails = Array.from(
      new Set(
        [vendorRow?.email, submitterProfile?.email]
          .map((e) => e?.trim())
          .filter((e): e is string => Boolean(e))
      )
    );

    const isRevisionRequestedAction =
      action === "precheck_revision" ||
      action === "physical_revision" ||
      action === "coord_forward_mitra" ||
      action === "pic_reject" ||
      (action === "akuntansi_reject" && body.reject_target !== "return_pic");

    if (mitraEmails.length > 0) {
      if (action === "precheck_pass") {
        const tpl = buildMitraEmailTemplate({
          eventType: "precheck_pass",
          submission: finalSubmission,
          vendorName,
          appUrl: request.nextUrl.origin,
        });
        await sendResendEmail({
          to: mitraEmails,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        });
      } else if (isRevisionRequestedAction) {
        const tpl = buildMitraEmailTemplate({
          eventType: "revision_requested",
          submission: finalSubmission,
          vendorName,
          findings: nextFindings,
          appUrl: request.nextUrl.origin,
        });
        await sendResendEmail({
          to: mitraEmails,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      submission: finalSubmission,
      sla: {
        is_paused: recalculatedSla.isPaused,
        is_internal_sla: !recalculatedSla.isPaused,
        actual_working_days: recalculatedSla.actualWorkingDays,
        sla_status: recalculatedSla.slaStatus,
        sla_target_days:
          finalSubmission.sla_target_days || SLA_TOTAL_TARGET_DAYS,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat memproses transisi status.",
      },
      { status: 500 }
    );
  }
}

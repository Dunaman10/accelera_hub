import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { ensureSubmissionDriveFolder } from "@/lib/google-drive";
import { SLA_TOTAL_TARGET_DAYS } from "@/lib/sla";
import type { BillingSubmission } from "@/types";

const DUPLICATE_INVOICE_MESSAGE =
  "Nomor invoice ini sudah pernah diajukan oleh perusahaan Anda.";

interface CreateSubmissionBody {
  invoice_no?: string;
  work_type?: string;
  contract_po_no?: string | null;
  amount?: number;
  notes?: string | null;
  vendor_id?: string | null;
}

/**
 * POST /api/submissions
 * 1. Memvalidasi autentikasi & vendor_id Mitra
 * 2. Mengecek duplikasi kombinasi `vendor_id + LOWER(TRIM(invoice_no))` pada tagihan aktif (`final_status <> 'Dibatalkan'`)
 *    -> Menolak dengan HTTP 409 Conflict: "Nomor invoice ini sudah pernah diajukan oleh perusahaan Anda."
 * 3. Membuat record di `billing_submissions` (auto-generate `agenda_no`, state awal langsung `PRE_CHECK`, `final_status = 'Dalam Proses'`)
 * 4. Membuat log pertama di `stage_logs` (SLA internal aktif, `is_paused = false`)
 * 5. Membuat hierarki folder di Google Drive (`Tahun / Bulan / NoAgenda - NamaMitra`) dan menyimpan `drive_folder_id`
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          ok: false,
          error: "Sesi autentikasi tidak valid. Silakan login kembali.",
        },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.is_active) {
      return NextResponse.json(
        {
          ok: false,
          error: "Profil pengguna tidak aktif atau tidak ditemukan.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as CreateSubmissionBody;
    const invoiceNo = body.invoice_no?.trim() ?? "";
    const normalizedInvoiceNo = invoiceNo.toLowerCase();
    const workType = body.work_type?.trim() ?? "";
    const contractPoNo = body.contract_po_no?.trim() || null;
    const amount = Number(body.amount ?? 0);
    const notes = body.notes?.trim() || null;

    if (!invoiceNo) {
      return NextResponse.json(
        { ok: false, error: "Nomor Invoice wajib diisi." },
        { status: 400 }
      );
    }

    if (!workType) {
      return NextResponse.json(
        { ok: false, error: "Jenis Pekerjaan / Tagihan wajib diisi." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Nilai Tagihan (Rp) harus lebih besar dari Rp 0.",
        },
        { status: 400 }
      );
    }

    // Tentukan vendor_id sesuai role
    const targetVendorId =
      profile.role === "mitra"
        ? profile.vendor_id
        : body.vendor_id?.trim() || profile.vendor_id;

    if (!targetVendorId) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Akun Anda belum terhubung dengan Perusahaan Vendor / Mitra. Hubungi Admin Accelera.",
        },
        { status: 400 }
      );
    }

    const { data: vendorRow } = await supabase
      .from("vendors")
      .select("id, name, is_active")
      .eq("id", targetVendorId)
      .maybeSingle();

    if (!vendorRow || !vendorRow.is_active) {
      return NextResponse.json(
        {
          ok: false,
          error: "Data Perusahaan Mitra tidak ditemukan atau sedang nonaktif.",
        },
        { status: 400 }
      );
    }

    // Validasi cegah duplikasi kombinasi vendor_id + LOWER(TRIM(invoice_no)) pada tagihan aktif (final_status <> 'Dibatalkan')
    const { data: existingActiveInvoices, error: dupError } = await supabase
      .from("billing_submissions")
      .select("id, invoice_no, final_status")
      .eq("vendor_id", targetVendorId)
      .neq("final_status", "Dibatalkan");

    if (dupError) {
      return NextResponse.json(
        { ok: false, error: dupError.message },
        { status: 500 }
      );
    }

    const isDuplicateInvoice = (existingActiveInvoices ?? []).some(
      (row) => row.invoice_no.trim().toLowerCase() === normalizedInvoiceNo
    );

    if (isDuplicateInvoice) {
      return NextResponse.json(
        {
          ok: false,
          error: DUPLICATE_INVOICE_MESSAGE,
        },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();
    const adminSupabase = createAdminClient();

    // 1. Insert ke billing_submissions dengan current_stage = 'PRE_CHECK' (Pre-Check Softcopy).
    // Apabila database belum menjalankan migrasi 002 (RLS lama masih membatasi INSERT Mitra hanya 'SUBMITTED'),
    // fallback insert dengan 'SUBMITTED' lalu segera naikkan ke 'PRE_CHECK'.
    let createdSubmission: BillingSubmission | null = null;

    const { data: directInsert, error: directError } = await supabase
      .from("billing_submissions")
      .insert({
        vendor_id: targetVendorId,
        submitted_by: user.id,
        received_date: nowIso,
        softcopy_date: nowIso,
        invoice_no: invoiceNo,
        work_type: workType,
        contract_po_no: contractPoNo,
        amount,
        current_stage: "PRE_CHECK",
        precheck_status: "Belum Diperiksa",
        physical_status: "Belum Diperiksa",
        verification_status: "Belum Diperiksa",
        validation_status: "Belum Diperiksa",
        followup_action: "Tidak Ada",
        final_status: "Dalam Proses",
        sla_target_days: SLA_TOTAL_TARGET_DAYS,
        actual_working_days: 0,
        sla_status: "Dalam Proses",
        notes,
      })
      .select("*")
      .single();

    if (directError) {
      // Tangkap pelanggaran Partial Unique Index PostgreSQL (23505) saat klik ganda bersamaan
      if (
        directError.code === "23505" &&
        directError.message.includes("uq_billing_submissions_active_vendor_invoice")
      ) {
        return NextResponse.json(
          {
            ok: false,
            error: DUPLICATE_INVOICE_MESSAGE,
          },
          { status: 409 }
        );
      }

      // Fallback kompatibilitas RLS sebelum migrasi 002 dijalankan
      const { data: fallbackInsert, error: fallbackError } = await supabase
        .from("billing_submissions")
        .insert({
          vendor_id: targetVendorId,
          submitted_by: user.id,
          received_date: nowIso,
          softcopy_date: nowIso,
          invoice_no: invoiceNo,
          work_type: workType,
          contract_po_no: contractPoNo,
          amount,
          current_stage: "SUBMITTED",
          precheck_status: "Belum Diperiksa",
          physical_status: "Belum Diperiksa",
          verification_status: "Belum Diperiksa",
          validation_status: "Belum Diperiksa",
          followup_action: "Tidak Ada",
          final_status: "Dalam Proses",
          sla_target_days: SLA_TOTAL_TARGET_DAYS,
          actual_working_days: 0,
          sla_status: "Dalam Proses",
          notes,
        })
        .select("*")
        .single();

      if (fallbackError || !fallbackInsert) {
        if (
          fallbackError?.code === "23505" &&
          fallbackError.message.includes(
            "uq_billing_submissions_active_vendor_invoice"
          )
        ) {
          return NextResponse.json(
            {
              ok: false,
              error: DUPLICATE_INVOICE_MESSAGE,
            },
            { status: 409 }
          );
        }

        return NextResponse.json(
          {
            ok: false,
            error:
              fallbackError?.message ??
              directError.message ??
              "Gagal membuat pengajuan tagihan.",
          },
          { status: 500 }
        );
      }

      createdSubmission = fallbackInsert;
    } else {
      createdSubmission = directInsert;
    }

    // 2. Buat folder terstruktur di Google Drive (Tahun / Bulan / NoAgenda - NamaMitra)
    let driveFolderId: string | null = null;
    let driveFolderPath: string | null = null;

    try {
      const folderHierarchy = await ensureSubmissionDriveFolder({
        agendaNo: createdSubmission.agenda_no,
        vendorName: vendorRow.name,
        referenceDate: createdSubmission.received_date,
      });
      driveFolderId = folderHierarchy.submissionFolderId;
      driveFolderPath = folderHierarchy.folderPath;
    } catch (driveErr) {
      return NextResponse.json(
        {
          ok: false,
          error:
            driveErr instanceof Error
              ? `Gagal menyiapkan folder Google Drive: ${driveErr.message}`
              : "Gagal menyiapkan folder Google Drive.",
        },
        { status: 502 }
      );
    }

    // 3. Simpan drive_folder_id dan pastikan current_stage berada pada 'PRE_CHECK'
    const { data: updatedSubmission } = await adminSupabase
      .from("billing_submissions")
      .update({
        drive_folder_id: driveFolderId,
        current_stage: "PRE_CHECK",
      })
      .eq("id", createdSubmission.id)
      .select("*")
      .maybeSingle();

    const finalSubmission: BillingSubmission = updatedSubmission ?? {
      ...createdSubmission,
      drive_folder_id: driveFolderId,
      current_stage: "PRE_CHECK",
    };

    // 4. Buat log pertama di stage_logs (SLA internal aktif pada tahap PRE_CHECK)
    const { error: stageLogError } = await supabase.from("stage_logs").insert({
      submission_id: createdSubmission.id,
      from_stage: "SUBMITTED",
      to_stage: "PRE_CHECK",
      entered_at: nowIso,
      is_paused: false,
      working_days_spent: 0,
      action_by: user.id,
      decision: "Pengajuan Softcopy Dikirim",
      notes: `Pengajuan tagihan ${createdSubmission.agenda_no} dibuat dan langsung masuk tahap Pre-Check Softcopy.`,
    });

    if (stageLogError) {
      console.error("Failed inserting initial stage_log:", stageLogError.message);
    }

    return NextResponse.json(
      {
        ok: true,
        submission: finalSubmission,
        drive_folder_id: driveFolderId,
        drive_folder_path: driveFolderPath,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Terjadi kesalahan server.",
      },
      { status: 500 }
    );
  }
}

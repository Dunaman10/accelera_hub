import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { DocCategory } from "@/types";

const SaveDocumentSchema = z.object({
  category: z.enum(
    ["INVOICE", "FAKTUR_PAJAK", "BAST", "PO_KONTRAK", "LAINNYA"],
    { error: "Kategori dokumen tidak valid." }
  ),
  file_name: z
    .string({ error: "file_name wajib disertakan." })
    .trim()
    .min(1, "file_name wajib disertakan."),
  mime_type: z.string().trim().min(1).default("application/octet-stream"),
  file_size_bytes: z.coerce.number().min(0).default(0),
  drive_file_id: z
    .string({ error: "drive_file_id wajib disertakan." })
    .trim()
    .min(1, "drive_file_id wajib disertakan."),
  replace_latest: z.boolean().optional(),
});

/**
 * POST /api/submissions/[id]/documents
 * Menyimpan metadata dokumen & `drive_file_id` ke tabel `submission_documents`
 * setelah browser menyelesaikan upload biner langsung ke Google Drive.
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
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role, vendor_id, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.is_active) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: Profil pengguna tidak aktif." },
        { status: 403 }
      );
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = SaveDocumentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error:
            parsed.error.issues[0]?.message ??
            "Payload metadata dokumen tidak valid.",
        },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const category: DocCategory = body.category;
    const fileName = body.file_name;
    const mimeType = body.mime_type;
    const fileSizeBytes = body.file_size_bytes;
    const driveFileId = body.drive_file_id;

    // Verifikasi kepemilikan submission lewat query RLS
    const { data: submission, error: subError } = await supabase
      .from("billing_submissions")
      .select("id, vendor_id, current_stage, final_status")
      .eq("id", submissionId)
      .maybeSingle();

    if (subError || !submission) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Pengajuan tagihan tidak ditemukan atau akses ditolak oleh kebijakan RLS.",
        },
        { status: 404 }
      );
    }

    // Validasi eksplisit isolasi vendor_id untuk role mitra
    if (profile.role === "mitra") {
      if (!profile.vendor_id || submission.vendor_id !== profile.vendor_id) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "403 Forbidden: Anda tidak berhak mengunggah dokumen ke pengajuan milik perusahaan Mitra lain.",
          },
          { status: 403 }
        );
      }
    }

    // Validasi bahwa pengajuan masih dalam tahap awal atau tahap revisi / menunggu mitra
    const allowedUploadStages = new Set([
      "SUBMITTED",
      "PRE_CHECK",
      "REVISION_SOFTCOPY",
      "REVISION_HARDCOPY",
      "REVISION_PIC",
      "REVISION_ACCOUNTING",
    ]);

    if (
      !allowedUploadStages.has(submission.current_stage) &&
      submission.final_status !== "Menunggu Mitra"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Unggah dokumen hanya diizinkan pada saat pengajuan awal atau ketika tagihan berstatus Revisi / Menunggu Mitra.",
        },
        { status: 400 }
      );
    }

    // Cek versi dokumen sebelumnya pada kategori yang sama
    const { data: existingDocs } = await supabase
      .from("submission_documents")
      .select("id, version, is_latest")
      .eq("submission_id", submissionId)
      .eq("category", category)
      .order("version", { ascending: false })
      .limit(1);

    const isRevisionStage =
      submission.current_stage === "REVISION_SOFTCOPY" ||
      submission.current_stage === "REVISION_HARDCOPY" ||
      submission.current_stage === "REVISION_PIC" ||
      submission.current_stage === "REVISION_ACCOUNTING";

    // Explicit replaceLatest flag atau otomatis saat tahap revisi
    const shouldReplaceOldLatest =
      Boolean((body as { replace_latest?: boolean }).replace_latest) ||
      isRevisionStage;

    const nextVersion =
      existingDocs && existingDocs.length > 0
        ? existingDocs[0].version + 1
        : 1;

    // Jika sedang mengunggah revisi untuk kategori yang sudah memiliki dokumen sebelumnya:
    // set dokumen lama pada kategori tersebut menjadi is_latest = false (tanpa menghapus file di Drive demi audit)
    if (shouldReplaceOldLatest && existingDocs && existingDocs.length > 0) {
      const { error: markOldErr } = await supabase
        .from("submission_documents")
        .update({ is_latest: false })
        .eq("submission_id", submissionId)
        .eq("category", category)
        .eq("is_latest", true);

      if (markOldErr) {
        const adminSupabase = createAdminClient();
        await adminSupabase
          .from("submission_documents")
          .update({ is_latest: false })
          .eq("submission_id", submissionId)
          .eq("category", category)
          .eq("is_latest", true);
      }
    }

    const insertPayload = {
      submission_id: submissionId,
      category,
      file_name: fileName,
      mime_type: mimeType,
      file_size_bytes: Math.max(0, Math.round(fileSizeBytes)),
      drive_file_id: driveFileId,
      version: nextVersion,
      is_latest: true,
      uploaded_by: user.id,
    };

    let { data: docRow, error: insertError } = await supabase
      .from("submission_documents")
      .insert(insertPayload)
      .select("*")
      .single();

    // Fallback ke adminClient bila database belum menerapkan migrasi 002 untuk stage PRE_CHECK
    // (setelah di atas terverifikasi bahwa submission milik vendor user ini)
    if (insertError) {
      const adminSupabase = createAdminClient();
      const adminRes = await adminSupabase
        .from("submission_documents")
        .insert(insertPayload)
        .select("*")
        .single();
      docRow = adminRes.data;
      insertError = adminRes.error;
    }

    if (insertError || !docRow) {
      return NextResponse.json(
        {
          ok: false,
          error:
            insertError?.message ??
            "Gagal menyimpan metadata dokumen ke database.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        document: docRow,
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat menyimpan dokumen.",
      },
      { status: 500 }
    );
  }
}

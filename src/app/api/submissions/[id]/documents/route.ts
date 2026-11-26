import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { DocCategory } from "@/types";

const VALID_CATEGORIES = new Set<DocCategory>([
  "INVOICE",
  "FAKTUR_PAJAK",
  "BAST",
  "PO_KONTRAK",
  "LAINNYA",
]);

interface SaveDocumentBody {
  category?: DocCategory;
  file_name?: string;
  mime_type?: string;
  file_size_bytes?: number;
  drive_file_id?: string;
}

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

    const body = (await request.json()) as SaveDocumentBody;
    const category = body.category;
    const fileName = body.file_name?.trim() ?? "";
    const mimeType = body.mime_type?.trim() ?? "application/octet-stream";
    const fileSizeBytes = Number(body.file_size_bytes ?? 0);
    const driveFileId = body.drive_file_id?.trim() ?? "";

    if (!category || !VALID_CATEGORIES.has(category)) {
      return NextResponse.json(
        { ok: false, error: "Kategori dokumen tidak valid." },
        { status: 400 }
      );
    }

    if (!fileName || !driveFileId) {
      return NextResponse.json(
        {
          ok: false,
          error: "file_name dan drive_file_id wajib disertakan.",
        },
        { status: 400 }
      );
    }

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

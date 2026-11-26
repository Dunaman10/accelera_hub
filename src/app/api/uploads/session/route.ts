import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  createResumableUploadSession,
  ensureSubmissionDriveFolder,
} from "@/lib/google-drive";
import type { DocCategory } from "@/types";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

interface UploadSessionRequestBody {
  submission_id?: string;
  category?: DocCategory;
  file_name?: string;
  mime_type?: string;
  file_size_bytes?: number;
}

/**
 * POST /api/uploads/session
 * Menerbitkan Google Drive Resumable Upload URL (`uploadUrl`) per file.
 * Memverifikasi kepemilikan `submission_id` (isolasi RLS Mitra) serta format & ukuran file (<= 5 MB).
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
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as UploadSessionRequestBody;
    const submissionId = body.submission_id?.trim() ?? "";
    const category = body.category;
    const fileName = body.file_name?.trim() ?? "";
    const mimeType = body.mime_type?.trim().toLowerCase() ?? "";
    const fileSizeBytes = Number(body.file_size_bytes ?? 0);

    if (!submissionId || !fileName || !mimeType) {
      return NextResponse.json(
        {
          ok: false,
          error: "Parameter submission_id, file_name, dan mime_type wajib diisi.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Format file tidak didukung. Hanya file .pdf, .jpg, .jpeg, dan .png yang diizinkan.",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
      return NextResponse.json(
        { ok: false, error: "Ukuran file tidak valid." },
        { status: 400 }
      );
    }

    if (fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: "Ukuran file melebihi batas maksimal 5 MB per file.",
        },
        { status: 400 }
      );
    }

    // Ambil pengajuan menggunakan client ber-RLS (Mitra A tidak akan pernah menemukan pengajuan Mitra B)
    const { data: submission, error: subError } = await supabase
      .from("billing_submissions")
      .select("id, agenda_no, vendor_id, drive_folder_id, received_date")
      .eq("id", submissionId)
      .maybeSingle();

    if (subError || !submission) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Pengajuan tagihan tidak ditemukan atau Anda tidak memiliki akses ke pengajuan ini.",
        },
        { status: 404 }
      );
    }

    let folderId = submission.drive_folder_id;

    // Jika drive_folder_id belum terisi, buat otomatis sekarang
    if (!folderId) {
      const { data: vendor } = await supabase
        .from("vendors")
        .select("name")
        .eq("id", submission.vendor_id)
        .maybeSingle();

      const hierarchy = await ensureSubmissionDriveFolder({
        agendaNo: submission.agenda_no,
        vendorName: vendor?.name ?? "Mitra",
        referenceDate: submission.received_date,
      });

      folderId = hierarchy.submissionFolderId;

      const adminSupabase = createAdminClient();
      await adminSupabase
        .from("billing_submissions")
        .update({ drive_folder_id: folderId })
        .eq("id", submission.id);
    }

    const originHeader =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_APP_URL ||
      undefined;

    const prefixedFileName = category
      ? `[${category}] ${fileName}`
      : fileName;

    const session = await createResumableUploadSession({
      fileName: prefixedFileName,
      mimeType,
      folderId,
      fileSizeBytes,
      origin: originHeader,
      description: `Dokumen ${category ?? "TAGIHAN"} — ${submission.agenda_no}`,
    });

    return NextResponse.json({
      ok: true,
      uploadUrl: session.uploadUrl,
      folderId: session.folderId,
      fileName: session.fileName,
      mimeType: session.mimeType,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Gagal membuat sesi Google Drive Resumable Upload.",
      },
      { status: 500 }
    );
  }
}

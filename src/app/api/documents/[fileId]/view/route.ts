import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDriveFileStream } from "@/lib/google-drive";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/documents/[fileId]/view
 * (Mendukung parameter `[documentId]` berupa UUID `submission_documents.id`
 * maupun `drive_file_id` secara langsung).
 *
 * 1. Verifikasi sesi user dari Supabase Auth.
 * 2. Query `submission_documents` + `billing_submissions` (serta `profiles`).
 *    Jika `profile.role === 'mitra'`, wajib pastikan `submission.vendor_id === profile.vendor_id`;
 *    jika bukan, kembalikan `403 Forbidden`.
 * 3. Stream biner langsung dari Google Drive API (`alt=media`) menggunakan `getDriveFileStream(drive_file_id)`.
 * 4. Kembalikan response dengan `Content-Type` asli, `Content-Disposition: inline`, dan `Cache-Control: private, max-age=300`.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId: paramId } = await context.params;
    const cleanParamId = paramId?.trim();

    if (!cleanParamId) {
      return NextResponse.json(
        { ok: false, error: "Document ID tidak valid." },
        { status: 400 }
      );
    }

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

    const isUuid = UUID_REGEX.test(cleanParamId);

    // Cari di submission_documents berdasarkan id (jika UUID) atau drive_file_id
    let subDocQuery = supabase
      .from("submission_documents")
      .select("id, submission_id, file_name, mime_type, drive_file_id")
      .limit(1);

    subDocQuery = isUuid
      ? subDocQuery.or(`id.eq.${cleanParamId},drive_file_id.eq.${cleanParamId}`)
      : subDocQuery.eq("drive_file_id", cleanParamId);

    let sppDocQuery = supabase
      .from("spp_documents")
      .select("id, submission_id, spp_no, drive_file_id")
      .limit(1);

    sppDocQuery = isUuid
      ? sppDocQuery.or(`id.eq.${cleanParamId},drive_file_id.eq.${cleanParamId}`)
      : sppDocQuery.eq("drive_file_id", cleanParamId);

    const [{ data: subDoc }, { data: sppDoc }] = await Promise.all([
      subDocQuery.maybeSingle(),
      sppDocQuery.maybeSingle(),
    ]);

    if (!subDoc && !sppDoc) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dokumen tidak ditemukan atau Anda tidak memiliki hak akses (403 Forbidden).",
        },
        { status: 403 }
      );
    }

    const targetSubmissionId =
      subDoc?.submission_id ?? sppDoc?.submission_id ?? null;

    if (!targetSubmissionId) {
      return NextResponse.json(
        { ok: false, error: "Relasi pengajuan dokumen tidak ditemukan." },
        { status: 403 }
      );
    }

    const { data: submission } = await supabase
      .from("billing_submissions")
      .select("id, vendor_id")
      .eq("id", targetSubmissionId)
      .maybeSingle();

    if (!submission) {
      return NextResponse.json(
        {
          ok: false,
          error: "Akses ditolak: Pengajuan tagihan tidak dapat diakses.",
        },
        { status: 403 }
      );
    }

    // Aturan Isolasi Ketat Mitra: wajib submission.vendor_id === profile.vendor_id
    if (profile.role === "mitra") {
      if (!profile.vendor_id || submission.vendor_id !== profile.vendor_id) {
        return NextResponse.json(
          {
            ok: false,
            error:
              "403 Forbidden: Anda tidak berhak mengakses dokumen milik perusahaan Mitra lain.",
          },
          { status: 403 }
        );
      }
    }

    const targetDriveFileId = subDoc?.drive_file_id ?? sppDoc?.drive_file_id;
    if (!targetDriveFileId) {
      return NextResponse.json(
        { ok: false, error: "File Google Drive belum tersedia." },
        { status: 404 }
      );
    }

    const rangeHeader = request.headers.get("range");
    const streamResult = await getDriveFileStream(
      targetDriveFileId,
      rangeHeader
    );

    const headers = new Headers();
    headers.set(
      "Content-Type",
      subDoc?.mime_type || streamResult.contentType || "application/octet-stream"
    );
    headers.set(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(
        subDoc?.file_name ?? `${sppDoc?.spp_no ?? targetDriveFileId}.pdf`
      )}"`
    );
    headers.set("Cache-Control", "private, max-age=300");

    if (streamResult.contentLength) {
      headers.set("Content-Length", streamResult.contentLength);
    }
    if (streamResult.contentRange) {
      headers.set("Content-Range", streamResult.contentRange);
    }
    if (streamResult.acceptRanges) {
      headers.set("Accept-Ranges", streamResult.acceptRanges);
    }

    return new NextResponse(streamResult.stream, {
      status: streamResult.status,
      headers,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Gagal memuat stream dokumen dari Google Drive.",
      },
      { status: 500 }
    );
  }
}

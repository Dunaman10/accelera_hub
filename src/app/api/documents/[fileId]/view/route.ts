import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDriveFileStream } from "@/lib/google-drive";

/**
 * GET /api/documents/[fileId]/view
 * Proxy streaming terautentikasi untuk menampilkan dokumen private dari Google Drive.
 * Memastikan `fileId` terdaftar di `submission_documents` (atau `spp_documents`) yang
 * berhak diakses oleh pengguna saat ini berdasarkan kebijakan Row Level Security (RLS).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await context.params;
    const cleanFileId = fileId?.trim();

    if (!cleanFileId) {
      return NextResponse.json(
        { ok: false, error: "File ID tidak valid." },
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

    // Cek otorisasi dokumen melalui RLS pada submission_documents atau spp_documents
    const [{ data: subDoc }, { data: sppDoc }] = await Promise.all([
      supabase
        .from("submission_documents")
        .select("id, file_name, mime_type, drive_file_id")
        .eq("drive_file_id", cleanFileId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("spp_documents")
        .select("id, spp_no, drive_file_id")
        .eq("drive_file_id", cleanFileId)
        .limit(1)
        .maybeSingle(),
    ]);

    if (!subDoc && !sppDoc) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Dokumen tidak ditemukan atau Anda tidak memiliki hak akses (Isolasi RLS).",
        },
        { status: 403 }
      );
    }

    const rangeHeader = request.headers.get("range");
    const streamResult = await getDriveFileStream(cleanFileId, rangeHeader);

    const headers = new Headers();
    headers.set(
      "Content-Type",
      subDoc?.mime_type || streamResult.contentType || "application/octet-stream"
    );
    headers.set(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(
        subDoc?.file_name ?? `${sppDoc?.spp_no ?? cleanFileId}.pdf`
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

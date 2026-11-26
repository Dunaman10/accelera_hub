import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  generateCheckSheetPdf,
  generateSppPdf,
  type StageLogWithActor,
} from "@/lib/pdf/spp-pdf";
import { ROLE_LABELS } from "@/lib/constants";
import type { Profile } from "@/types";

const PdfQuerySchema = z.object({
  type: z.enum(["checksheet", "spp"]).default("checksheet"),
  download: z.enum(["0", "1", "true", "false"]).optional(),
});

/**
 * GET /api/submissions/[id]/pdf?type=checksheet|spp&download=1
 * Menghasilkan & mengunduh 2 PDF Resmi on-the-fly (`pdf-lib` + `qrcode`):
 * 1. `type=checksheet` -> PDF Lembar Hasil Cek & Approval
 * 2. `type=spp`        -> PDF Surat Pengajuan Pembayaran (SPP)
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: submissionId } = await context.params;
    const rawType = request.nextUrl.searchParams.get("type")?.toLowerCase();
    const rawDownload = request.nextUrl.searchParams
      .get("download")
      ?.toLowerCase();
    const parsedQuery = PdfQuerySchema.safeParse({
      type: rawType || "checksheet",
      download: rawDownload || undefined,
    });

    const pdfType = parsedQuery.success ? parsedQuery.data.type : "checksheet";
    const isDownload =
      parsedQuery.success &&
      (parsedQuery.data.download === "1" ||
        parsedQuery.data.download === "true");

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

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, role, vendor_id, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      return NextResponse.json(
        { ok: false, error: "Forbidden" },
        { status: 403 }
      );
    }

    const adminSupabase = createAdminClient();
    const { data: submission } = await adminSupabase
      .from("billing_submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();

    if (!submission) {
      return NextResponse.json(
        { ok: false, error: "Pengajuan tidak ditemukan." },
        { status: 404 }
      );
    }

    // Isolasi Mitra: hanya boleh mengunduh PDF milik perusahaannya sendiri
    if (profile.role === "mitra") {
      if (!profile.vendor_id || submission.vendor_id !== profile.vendor_id) {
        return NextResponse.json(
          { ok: false, error: "403 Forbidden" },
          { status: 403 }
        );
      }
    }

    const [{ data: vendor }, { data: stageLogs }, { data: sppDoc }] =
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
        adminSupabase
          .from("spp_documents")
          .select("*")
          .eq("submission_id", submission.id)
          .maybeSingle(),
      ]);

    const logs = stageLogs ?? [];
    const actorIds = Array.from(
      new Set(
        [
          ...logs.map((l) => l.action_by),
          sppDoc?.generated_by ?? null,
          user.id,
        ].filter((id): id is string => Boolean(id))
      )
    );

    const { data: profilesList } =
      actorIds.length > 0
        ? await adminSupabase
            .from("profiles")
            .select("id, full_name, role")
            .in("id", actorIds)
        : { data: [] as Array<Pick<Profile, "id" | "full_name" | "role">> };

    const profileMap = new Map(
      (profilesList ?? []).map((p) => [p.id, p])
    );

    const origin =
      request.nextUrl.origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "https://accelera-hub.pages.dev";

    const qrToken =
      sppDoc?.qr_verification_hash ??
      `CHK-${submission.id.replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    const qrVerificationUrl = `${origin}/verify/${encodeURIComponent(qrToken)}`;

    if (pdfType === "checksheet") {
      const enrichedLogs: StageLogWithActor[] = logs.map((l) => {
        const actor = l.action_by ? profileMap.get(l.action_by) : null;
        return {
          ...l,
          actor_name: actor?.full_name ?? "Pejabat / Sistem",
          actor_role: actor?.role ? ROLE_LABELS[actor.role] : "-",
        };
      });

      const pdfBytes = await generateCheckSheetPdf({
        submission,
        vendor: vendor ?? null,
        stageLogs: enrichedLogs,
        qrVerificationUrl,
        qrToken,
        sppNo: sppDoc?.spp_no ?? null,
      });

      const safeAgenda = submission.agenda_no.replace(/\//g, "-");
      const filename = `Lembar-Hasil-Cek-Approval_${safeAgenda}.pdf`;

      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${
            isDownload ? "attachment" : "inline"
          }; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    // Jika type === "spp"
    // Cari pejabat PIC Usaha & Akuntansi dari stage_logs
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

    const nowDate = new Date();
    const previewYear = nowDate.getFullYear();
    const previewMonth = String(nowDate.getMonth() + 1).padStart(2, "0");
    const effectiveSppNo =
      sppDoc?.spp_no ?? `SPP/${previewYear}/${previewMonth}/DRAFT`;

    const createdByProfile = sppDoc?.generated_by
      ? profileMap.get(sppDoc.generated_by) ?? null
      : profileMap.get(user.id) ?? null;

    const pdfBytes = await generateSppPdf({
      submission,
      vendor: vendor ?? null,
      sppNo: effectiveSppNo,
      qrVerificationUrl,
      qrToken,
      issuedAt: sppDoc?.created_at ?? nowDate.toISOString(),
      sentToFinanceAt: sppDoc?.sent_to_finance_at ?? null,
      createdByProfile,
      approvedPicProfile: approvedPicId
        ? profileMap.get(approvedPicId) ?? null
        : null,
      approvedAccProfile: approvedAccId
        ? profileMap.get(approvedAccId) ?? null
        : null,
      notes: sppDoc?.notes ?? null,
    });

    const safeSpp = effectiveSppNo.replace(/\//g, "-");
    const filename = `${safeSpp}_${submission.agenda_no.replace(/\//g, "-")}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${
          isDownload ? "attachment" : "inline"
        }; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Gagal men-generate dokumen PDF.",
      },
      { status: 500 }
    );
  }
}

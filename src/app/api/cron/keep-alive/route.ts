import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/cron/keep-alive
 * Endpoint Anti-Pause Supabase Free Tier.
 * Memverifikasi `Authorization: Bearer ${CRON_SECRET}` lalu menjalankan query ringan `SELECT 1`
 * ke PostgreSQL Supabase via RPC `keep_alive()`.
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
    const supabase = createAdminClient();

    // Eksekusi `SELECT 1` di PostgreSQL lewat fungsi RPC `public.keep_alive()`
    const { data, error } = await supabase.rpc("keep_alive");

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        result: data ?? 1,
        latencyMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 }
    );
  }
}

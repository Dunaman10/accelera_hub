import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/notifications
 * Mengambil 20 notifikasi terbaru milik pengguna yang sedang login beserta jumlah unread.
 */
export async function GET() {
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

    const [{ data: notifications, error }, { count: unreadCount }] =
      await Promise.all([
        supabase
          .from("notifications")
          .select("*")
          .eq("recipient_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("notifications")
          .select("*", { count: "exact", head: true })
          .eq("recipient_id", user.id)
          .eq("is_read", false),
      ]);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      notifications: notifications ?? [],
      unreadCount: unreadCount ?? 0,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed loading notifications",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Menandai satu notifikasi (`id`) atau seluruh notifikasi (`markAll = true`) sebagai sudah dibaca (`is_read = true`).
 */
export async function PATCH(request: NextRequest) {
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

    const body = (await request.json()) as {
      id?: string;
      markAll?: boolean;
    };

    if (body.markAll) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_id", user.id)
        .eq("is_read", false);

      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ ok: true });
    }

    if (!body.id) {
      return NextResponse.json(
        { ok: false, error: "Parameter id atau markAll wajib diisi." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", body.id)
      .eq("recipient_id", user.id);

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Failed updating notification",
      },
      { status: 500 }
    );
  }
}

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_INDONESIA_HOLIDAYS_2026_2027 } from "@/lib/sla";
import { HolidaysClient } from "./holidays-client";

async function AdminHolidaysContent() {
  await requireRole(["admin_accelera", "super_admin"]);
  const adminSupabase = createAdminClient();

  let { data: holidays } = await adminSupabase
    .from("national_holidays")
    .select("*")
    .order("holiday_date", { ascending: true });

  // Auto-seed Hari Libur Nasional Indonesia 2026-2027 jika tabel masih kosong
  if (!holidays || holidays.length === 0) {
    const fullRows = DEFAULT_INDONESIA_HOLIDAYS_2026_2027.map((item) => ({
      holiday_date: item.holiday_date,
      description: item.description,
      year: item.year,
      is_joint_leave: item.is_joint_leave,
      is_cuti_bersama: item.is_joint_leave,
    }));

    const { error: seedErr } = await adminSupabase
      .from("national_holidays")
      .upsert(fullRows, { onConflict: "holiday_date" });

    if (seedErr) {
      const fallbackRows = DEFAULT_INDONESIA_HOLIDAYS_2026_2027.map((item) => ({
        holiday_date: item.holiday_date,
        description: item.description,
        is_cuti_bersama: item.is_joint_leave,
      }));
      await adminSupabase
        .from("national_holidays")
        .upsert(fallbackRows, { onConflict: "holiday_date" });
    }

    const refreshed = await adminSupabase
      .from("national_holidays")
      .select("*")
      .order("holiday_date", { ascending: true });
    holidays = refreshed.data ?? [];
  }

  const normalized = (holidays ?? []).map((h) => ({
    ...h,
    year: h.year ?? Number(h.holiday_date.slice(0, 4)),
    is_joint_leave: h.is_joint_leave ?? h.is_cuti_bersama,
  }));

  return <HolidaysClient initialHolidays={normalized} />;
}

export default function AdminHolidaysPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" />
          Memuat Master Hari Libur Nasional...
        </div>
      }
    >
      <AdminHolidaysContent />
    </Suspense>
  );
}

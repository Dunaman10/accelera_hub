"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { DEFAULT_INDONESIA_HOLIDAYS_2026_2027 } from "@/lib/sla";
import type { NationalHoliday, UserRole } from "@/types";

export interface HolidayActionResult<T = null> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface HolidayPayload {
  id?: string;
  holiday_date: string;
  description: string;
  year?: number;
  is_joint_leave?: boolean;
}

async function assertAdminOrSuperAdmin(): Promise<
  | { ok: true; userId: string; role: UserRole }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Sesi autentikasi tidak ditemukan." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile ||
    !profile.is_active ||
    (profile.role !== "admin_accelera" && profile.role !== "super_admin")
  ) {
    return {
      ok: false,
      error: "Akses ditolak. Hanya Admin Accelera & Super Admin yang diizinkan.",
    };
  }

  return { ok: true, userId: user.id, role: profile.role };
}

export async function saveHolidayAction(
  payload: HolidayPayload
): Promise<HolidayActionResult<NationalHoliday>> {
  const auth = await assertAdminOrSuperAdmin();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const cleanDate = payload.holiday_date?.trim();
  const cleanDescription = payload.description?.trim();

  if (!cleanDate || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    return {
      ok: false,
      error: "Format tanggal hari libur harus YYYY-MM-DD.",
    };
  }

  if (!cleanDescription) {
    return {
      ok: false,
      error: "Keterangan / nama hari libur nasional wajib diisi.",
    };
  }

  const parsedYear = payload.year || Number(cleanDate.slice(0, 4));
  const isJointLeave = Boolean(payload.is_joint_leave);
  const adminSupabase = createAdminClient();

  // Upsert kompatibel sebelum maupun sesudah migrasi 002_sla_engine.sql dijalankan
  const fullValues = {
    holiday_date: cleanDate,
    description: cleanDescription,
    year: parsedYear,
    is_joint_leave: isJointLeave,
    is_cuti_bersama: isJointLeave,
  };

  const fallbackValues = {
    holiday_date: cleanDate,
    description: cleanDescription,
    is_cuti_bersama: isJointLeave,
  };

  if (payload.id) {
    let { data, error } = await adminSupabase
      .from("national_holidays")
      .update(fullValues)
      .eq("id", payload.id)
      .select("*")
      .single();

    if (error) {
      const retry = await adminSupabase
        .from("national_holidays")
        .update(fallbackValues)
        .eq("id", payload.id)
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      return { ok: false, error: error?.message ?? "Gagal memperbarui hari libur." };
    }

    revalidatePath("/admin/holidays");
    revalidatePath("/dashboard");
    revalidatePath("/monitoring");
    return {
      ok: true,
      data: {
        ...data,
        year: data.year ?? Number(data.holiday_date.slice(0, 4)),
        is_joint_leave: data.is_joint_leave ?? data.is_cuti_bersama,
      },
    };
  } else {
    let { data, error } = await adminSupabase
      .from("national_holidays")
      .insert(fullValues)
      .select("*")
      .single();

    if (error) {
      const retry = await adminSupabase
        .from("national_holidays")
        .insert(fallbackValues)
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error || !data) {
      return {
        ok: false,
        error:
          error?.code === "23505"
            ? `Tanggal ${cleanDate} sudah terdaftar sebagai hari libur.`
            : error?.message ?? "Gagal menambahkan hari libur.",
      };
    }

    revalidatePath("/admin/holidays");
    revalidatePath("/dashboard");
    revalidatePath("/monitoring");
    return {
      ok: true,
      data: {
        ...data,
        year: data.year ?? Number(data.holiday_date.slice(0, 4)),
        is_joint_leave: data.is_joint_leave ?? data.is_cuti_bersama,
      },
    };
  }
}

export async function deleteHolidayAction(
  holidayId: string
): Promise<HolidayActionResult> {
  const auth = await assertAdminOrSuperAdmin();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("national_holidays")
    .delete()
    .eq("id", holidayId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/holidays");
  revalidatePath("/dashboard");
  revalidatePath("/monitoring");
  return { ok: true };
}

export async function seedDefaultHolidaysAction(): Promise<
  HolidayActionResult<NationalHoliday[]>
> {
  const auth = await assertAdminOrSuperAdmin();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const adminSupabase = createAdminClient();

  const fullRows = DEFAULT_INDONESIA_HOLIDAYS_2026_2027.map((item) => ({
    holiday_date: item.holiday_date,
    description: item.description,
    year: item.year,
    is_joint_leave: item.is_joint_leave,
    is_cuti_bersama: item.is_joint_leave,
  }));

  let { error } = await adminSupabase
    .from("national_holidays")
    .upsert(fullRows, { onConflict: "holiday_date" });

  if (error) {
    const fallbackRows = DEFAULT_INDONESIA_HOLIDAYS_2026_2027.map((item) => ({
      holiday_date: item.holiday_date,
      description: item.description,
      is_cuti_bersama: item.is_joint_leave,
    }));
    const retry = await adminSupabase
      .from("national_holidays")
      .upsert(fallbackRows, { onConflict: "holiday_date" });
    error = retry.error;
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  const { data: allHolidays } = await adminSupabase
    .from("national_holidays")
    .select("*")
    .order("holiday_date", { ascending: true });

  revalidatePath("/admin/holidays");
  revalidatePath("/dashboard");
  revalidatePath("/monitoring");

  const normalized = (allHolidays ?? []).map((h) => ({
    ...h,
    year: h.year ?? Number(h.holiday_date.slice(0, 4)),
    is_joint_leave: h.is_joint_leave ?? h.is_cuti_bersama,
  }));

  return { ok: true, data: normalized };
}

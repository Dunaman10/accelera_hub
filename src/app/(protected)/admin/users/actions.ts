"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import type { Profile, UserRole } from "@/types";

export interface UserActionResult<T = null> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface CreateUserAccountPayload {
  full_name: string;
  email: string;
  role: UserRole;
  vendor_id?: string | null;
  provisioning_mode: "invite" | "create";
  password?: string;
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

function assertServiceRoleKeyConfigured(): { ok: boolean; error?: string } {
  const raw = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!raw || raw === "your-supabase-service-role-key") {
    return {
      ok: false,
      error:
        "SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi pada environment variables (.env.local).",
    };
  }
  return { ok: true };
}

export async function createOrInviteUserAction(
  payload: CreateUserAccountPayload
): Promise<UserActionResult<Profile>> {
  const auth = await assertAdminOrSuperAdmin();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const keyCheck = assertServiceRoleKeyConfigured();
  if (!keyCheck.ok) {
    return { ok: false, error: keyCheck.error };
  }

  const cleanName = payload.full_name?.trim();
  const cleanEmail = payload.email?.trim().toLowerCase();
  const role = payload.role;
  const vendorId =
    role === "mitra" ? payload.vendor_id?.trim() || null : null;

  if (!cleanName) {
    return { ok: false, error: "Nama lengkap pengguna wajib diisi." };
  }

  if (!cleanEmail) {
    return { ok: false, error: "Alamat email wajib diisi." };
  }

  if (role === "mitra" && !vendorId) {
    return {
      ok: false,
      error: "Role Mitra wajib dikaitkan dengan Perusahaan Vendor / Mitra.",
    };
  }

  const adminSupabase = createAdminClient();
  let newUserId: string | null = null;

  if (payload.provisioning_mode === "invite") {
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

    const { data, error } = await adminSupabase.auth.admin.inviteUserByEmail(
      cleanEmail,
      {
        data: {
          full_name: cleanName,
          role,
          vendor_id: vendorId ?? "",
        },
        redirectTo: `${appUrl}/auth/callback?next=/reset-password`,
      }
    );

    if (error || !data.user) {
      return {
        ok: false,
        error: error?.message ?? "Gagal mengirim undangan email user.",
      };
    }

    newUserId = data.user.id;
  } else {
    const cleanPassword = payload.password?.trim() || "";
    if (cleanPassword.length < 8) {
      return {
        ok: false,
        error: "Password awal minimal harus terdiri dari 8 karakter.",
      };
    }

    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: cleanEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: {
        full_name: cleanName,
        role,
        vendor_id: vendorId ?? "",
      },
    });

    if (error || !data.user) {
      return {
        ok: false,
        error: error?.message ?? "Gagal membuat akun pengguna baru.",
      };
    }

    newUserId = data.user.id;
  }

  // Upsert ke tabel public.profiles menggunakan service_role untuk memastikan role & vendor_id tersimpan
  const { data: profileRow, error: profileError } = await adminSupabase
    .from("profiles")
    .upsert(
      {
        id: newUserId,
        full_name: cleanName,
        email: cleanEmail,
        role,
        vendor_id: vendorId,
        is_active: true,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (profileError || !profileRow) {
    return {
      ok: false,
      error:
        profileError?.message ??
        "User Auth terbuat namun gagal memperbarui tabel profiles.",
    };
  }

  revalidatePath("/admin/users");
  return { ok: true, data: profileRow };
}

export async function updateUserProfileAction(params: {
  id: string;
  full_name: string;
  role: UserRole;
  vendor_id: string | null;
  is_active: boolean;
}): Promise<UserActionResult<Profile>> {
  const auth = await assertAdminOrSuperAdmin();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const keyCheck = assertServiceRoleKeyConfigured();
  if (!keyCheck.ok) {
    return { ok: false, error: keyCheck.error };
  }

  const vendorId =
    params.role === "mitra" ? params.vendor_id?.trim() || null : null;

  if (params.role === "mitra" && !vendorId) {
    return {
      ok: false,
      error: "Role Mitra wajib memiliki relasi Perusahaan Vendor.",
    };
  }

  const adminSupabase = createAdminClient();
  const { data, error } = await adminSupabase
    .from("profiles")
    .update({
      full_name: params.full_name.trim(),
      role: params.role,
      vendor_id: vendorId,
      is_active: params.is_active,
    })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Gagal memperbarui profil pengguna.",
    };
  }

  revalidatePath("/admin/users");
  return { ok: true, data };
}

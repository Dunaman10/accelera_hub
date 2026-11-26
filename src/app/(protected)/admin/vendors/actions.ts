"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole, Vendor } from "@/types";

export interface ActionResult<T = null> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface VendorPayload {
  id?: string;
  name: string;
  npwp?: string | null;
  address?: string | null;
  pic_name?: string | null;
  whatsapp_number?: string | null;
  email?: string | null;
  is_active?: boolean;
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

export async function saveVendorAction(
  payload: VendorPayload
): Promise<ActionResult<Vendor>> {
  const auth = await assertAdminOrSuperAdmin();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const cleanName = payload.name?.trim();
  if (!cleanName) {
    return { ok: false, error: "Nama perusahaan Mitra wajib diisi." };
  }

  const supabase = await createClient();

  const rowValues = {
    name: cleanName,
    npwp: payload.npwp?.trim() || null,
    address: payload.address?.trim() || null,
    pic_name: payload.pic_name?.trim() || null,
    whatsapp_number: payload.whatsapp_number?.trim() || null,
    email: payload.email?.trim().toLowerCase() || null,
    is_active: payload.is_active ?? true,
  };

  if (payload.id) {
    const { data, error } = await supabase
      .from("vendors")
      .update(rowValues)
      .eq("id", payload.id)
      .select("*")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/admin/vendors");
    revalidatePath("/admin/users");
    return { ok: true, data };
  } else {
    const { data, error } = await supabase
      .from("vendors")
      .insert(rowValues)
      .select("*")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/admin/vendors");
    revalidatePath("/admin/users");
    return { ok: true, data };
  }
}

export async function toggleVendorActiveAction(
  vendorId: string,
  nextActiveState: boolean
): Promise<ActionResult<Vendor>> {
  const auth = await assertAdminOrSuperAdmin();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendors")
    .update({ is_active: nextActiveState })
    .eq("id", vendorId)
    .select("*")
    .single();

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/vendors");
  revalidatePath("/admin/users");
  return { ok: true, data };
}

export async function deleteVendorAction(
  vendorId: string
): Promise<ActionResult> {
  const auth = await assertAdminOrSuperAdmin();
  if (!auth.ok) {
    return { ok: false, error: auth.error };
  }

  if (auth.role !== "super_admin") {
    return {
      ok: false,
      error:
        "Sesuai kebijakan RLS, penghapusan permanen Mitra hanya dapat dilakukan oleh Super Admin. Gunakan tombol Nonaktifkan.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("vendors").delete().eq("id", vendorId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/vendors");
  revalidatePath("/admin/users");
  return { ok: true };
}

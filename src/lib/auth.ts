import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile, UserRole, Vendor } from "@/types";
import { getHomeRouteForRole } from "@/lib/constants";

export interface AuthenticatedContext {
  user: {
    id: string;
    email?: string;
  };
  profile: Profile;
  vendor: Vendor | null;
}

export async function getAuthenticatedContext(): Promise<AuthenticatedContext | null> {
  await connection();
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return null;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || !profile.is_active) {
      return null;
    }

    let vendor: Vendor | null = null;
    if (profile.vendor_id) {
      const { data: vendorRow } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", profile.vendor_id)
        .maybeSingle();
      vendor = vendorRow ?? null;
    }

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      profile,
      vendor,
    };
  } catch {
    return null;
  }
}

export async function requireRole(
  allowedRoles: UserRole[]
): Promise<AuthenticatedContext> {
  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    redirect("/login");
  }

  if (
    ctx.profile.role !== "super_admin" &&
    !allowedRoles.includes(ctx.profile.role)
  ) {
    redirect(getHomeRouteForRole(ctx.profile.role));
  }

  return ctx;
}

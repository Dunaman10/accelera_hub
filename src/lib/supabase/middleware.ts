import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database, UserRole } from "@/types/database";
import { getHomeRouteForRole, isRouteAllowedForRole } from "@/lib/constants";

const PROTECTED_PREFIXES = [
  "/mitra",
  "/admin",
  "/pic",
  "/akuntansi",
  "/spp",
  "/dashboard",
  "/monitoring",
];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Menyegarkan sesi autentikasi Supabase pada setiap request, memvalidasi `profiles.is_active === true`,
 * dan menerapkan proteksi RBAC otomatis sesuai `profiles.role`.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        }
      },
    },
  });

  const { pathname } = request.nextUrl;

  // Jangan intervensi route callback auth atau endpoint API
  if (pathname.startsWith("/auth/callback") || pathname.startsWith("/api/")) {
    await supabase.auth.getUser();
    return supabaseResponse;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const copyCookiesToRedirect = (redirectResp: NextResponse) => {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResp.cookies.set(cookie);
    });
    return redirectResp;
  };

  if (!user) {
    if (isProtectedRoute(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      return copyCookiesToRedirect(NextResponse.redirect(loginUrl));
    }
    return supabaseResponse;
  }

  // Ambil data profil pengguna untuk memeriksa role dan status aktif
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, vendor_id")
    .eq("id", user.id)
    .maybeSingle();

  const isActive = profile?.is_active === true;
  const role: UserRole | null = profile?.role ?? null;

  if (!profile || !isActive || !role) {
    await supabase.auth.signOut();
    if (pathname !== "/login") {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set(
        "error",
        !profile
          ? "profile_not_found"
          : !isActive
          ? "account_inactive"
          : "invalid_role"
      );
      return copyCookiesToRedirect(NextResponse.redirect(loginUrl));
    }
    return supabaseResponse;
  }

  const homeRoute = getHomeRouteForRole(role);

  // Bila user sudah login dan membuka halaman `/login`, arahkan otomatis ke dashboard sesuai role
  if (pathname === "/login") {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = homeRoute;
    targetUrl.search = "";
    return copyCookiesToRedirect(NextResponse.redirect(targetUrl));
  }

  // Proteksi silang antar-role pada route dashboard
  if (isProtectedRoute(pathname) && !isRouteAllowedForRole(pathname, role)) {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = homeRoute;
    targetUrl.search = "";
    return copyCookiesToRedirect(NextResponse.redirect(targetUrl));
  }

  return supabaseResponse;
}

export const createClient = updateSession;

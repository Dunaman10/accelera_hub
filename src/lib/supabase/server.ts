import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "@/types/database";
import { getSupabasePublicConfig } from "./client";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Server-side Supabase client menggunakan `@supabase/ssr` yang menghormati
 * session user pada cookies dan kebijakan Row Level Security (RLS).
 * Mendukung pemanggilan `await createClient()` maupun `createClient(cookieStore)`.
 */
export async function createClient(passedCookieStore?: CookieStore) {
  await connection();
  const cookieStore = passedCookieStore ?? (await cookies());
  const { supabaseUrl, supabaseKey } = getSupabasePublicConfig();

  return createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Pemanggilan `setAll` dari Server Component murni dapat diabaikan
          // karena penyegaran sesi ditangani oleh `src/proxy.ts`.
        }
      },
    },
  });
}

/**
 * Supabase Admin Client menggunakan `SUPABASE_SERVICE_ROLE_KEY` (melewati RLS).
 * Bila `SUPABASE_SERVICE_ROLE_KEY` belum diisi (masih placeholder), otomatis fallback
 * ke publishable/anon key untuk operasi publik seperti RPC `keep_alive()`.
 */
export function createAdminClient() {
  const { supabaseUrl, supabaseKey } = getSupabasePublicConfig();
  const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const isPlaceholder =
    !rawServiceKey || rawServiceKey === "your-supabase-service-role-key";
  const effectiveKey = isPlaceholder ? supabaseKey : rawServiceKey;

  return createSupabaseJsClient<Database>(supabaseUrl, effectiveKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

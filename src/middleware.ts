import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export default middleware;

export const config = {
  matcher: [
    /*
     * Jalankan middleware pada semua rute kecuali:
     * - /api/cron/* (menggunakan Bearer CRON_SECRET, bukan sesi cookie)
     * - _next/static & _next/image (aset statis)
     * - favicon.ico & aset gambar/ikon publik
     */
    "/((?!api/cron|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

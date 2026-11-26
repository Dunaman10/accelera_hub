/**
 * ACCELERA HUB — FINANCIAL-GRADE SECURE SERVICE WORKER
 * ---------------------------------------------------------------------------
 * KEBIJAKAN KEAMANAN DATA FINANSIAL (WAJIB):
 * 1. HANYA men-cache aset statis publik (`/_next/static/`, `/icons/`, `/brand/`, font, dan `/offline`).
 * 2. DILARANG KERAS men-cache atau menyimpan respons `/api/*`, `/auth/*`,
 *    stream dokumen `/api/documents/*`, maupun halaman HTML terautentikasi.
 */

const CACHE_VERSION = "accelera-hub-static-v1";
const OFFLINE_URL = "/offline";

const PRECACHE_STATIC_ASSETS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/icon-maskable-512x512.png",
  "/icons/apple-touch-icon.png",
  "/brand/logo-full-light.png",
  "/brand/logo-full-dark.png",
  "/brand/logo-mark-light.png",
  "/brand/logo-mark-dark.png",
];

/**
 * Mengecek apakah URL termasuk endpoint sensitif yang DILARANG di-cache.
 */
function isForbiddenCachePath(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname.startsWith("/auth/") ||
    pathname === "/auth" ||
    pathname.startsWith("/api/documents/")
  );
}

/**
 * Mengecek apakah URL adalah aset statis murni yang aman di-cache.
 */
function isAllowedStaticAsset(pathname) {
  if (isForbiddenCachePath(pathname)) {
    return false;
  }

  return (
    pathname === OFFLINE_URL ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico" ||
    pathname === "/apple-touch-icon.png" ||
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/brand/") ||
    /\.(?:woff2?|ttf|otf|png|svg|ico)$/i.test(pathname)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((oldKey) => caches.delete(oldKey))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Hanya tangani method GET
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Hanya tangani request pada origin yang sama
  if (url.origin !== self.location.origin) {
    return;
  }

  // ATURAN KERAS KEAMANAN FINANSIAL:
  // Jangan pernah menyentuh atau men-cache /api/*, /auth/*, atau /api/documents/*
  if (isForbiddenCachePath(url.pathname)) {
    return;
  }

  // Jangan men-cache RSC payload (_rsc) agar state aplikasi selalu real-time
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") {
    return;
  }

  // Navigasi Halaman (HTML): Selalu ambil langsung dari jaringan (Network-Only),
  // dan tampilkan halaman /offline jika perangkat kehilangan koneksi internet.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_VERSION);
        const cachedOffline = await cache.match(OFFLINE_URL);
        if (cachedOffline) {
          return cachedOffline;
        }
        return new Response(
          "Perangkat Anda sedang offline. Silakan periksa koneksi internet dan coba lagi.",
          {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }
        );
      })
    );
    return;
  }

  // Aset Statis yang Diizinkan (/_next/static/, ikon, font, /offline):
  // Gunakan strategi Stale-While-Revalidate / Cache-First yang aman.
  if (isAllowedStaticAsset(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        try {
          const networkResponse = await fetch(request);
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          throw err;
        }
      })
    );
  }
});

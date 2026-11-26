"use client";

import * as React from "react";

/**
 * Mendaftarkan Service Worker (`/` -> `/sw.js`) secara ringan di sisi klien
 * setelah halaman selesai dimuat tanpa memblokir main thread.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const registerSw = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
      } catch (err) {
        // Kegagalan registrasi SW di dev/browser terbatas tidak boleh mengganggu aplikasi
        console.warn("[Accelera HUB PWA] Service Worker registration skipped:", err);
      }
    };

    if (document.readyState === "complete") {
      void registerSw();
    } else {
      window.addEventListener("load", registerSw, { once: true });
      return () => window.removeEventListener("load", registerSw);
    }
  }, []);

  return null;
}

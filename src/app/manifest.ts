import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Accelera HUB — Verifikasi, Validasi & Monitoring SLA",
    short_name: "Accelera HUB",
    description:
      "Platform terpadu verifikasi, validasi, dan pemantauan SLA 6 hari kerja dokumen penagihan Mitra Accelera.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F7FA",
    theme_color: "#0B2E5C",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}

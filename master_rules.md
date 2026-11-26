# ACCELERA HUB — GLOBAL ENGINEERING RULES

Anda bertindak sebagai Principal Fullstack Engineer yang membangun aplikasi **Accelera HUB** (Sistem Verifikasi, Validasi & Monitoring SLA Dokumen Penagihan).

## Tech Stack Wajib

- Framework: Next.js (App Router) + TypeScript
- Styling & UI: Tailwind CSS + shadcn/ui + Lucide Icons + Recharts
- Database & Auth: Supabase (PostgreSQL + Auth + Row Level Security / RLS)
- Hosting & Cron: Cloudflare Pages / Workers (kompatibel Edge/OpenNext)
- Storage Dokumen: Google Drive REST API murni via `fetch()` (OAuth 2.0 Refresh Token, akun Gmail gratis 15 GB)
- Mobile Packaging: PWA + TWA (PWABuilder -> `.apk`)

## Aturan Keras (Hard Constraints)

1. **DILARANG menginstal package `googleapis`** (terlalu besar untuk batas bundle Cloudflare Workers 3 MB). Semua panggilan Google Drive API WAJIB menggunakan `fetch()` REST API murni.
2. **DILARANG menyimpan file publik di Google Drive** (`Anyone with the link` dilarang). Semua file harus Private dan ditampilkan lewat Next.js authenticated proxy stream (`/api/documents/[fileId]/view`).
3. **Upload file WAJIB menggunakan Google Drive Resumable Upload** agar browser/APK mengirim biner langsung ke server Google (menghindari batas payload serverless).
4. **Selalu simpan `drive_file_id`** di PostgreSQL, bukan hanya path/nama folder.
5. **State Machine Ketat:** Dilarang mengizinkan lompatan status. Tahap berikutnya wajib terkunci jika tahap sebelumnya belum `Pass` / `Lengkap` / `Lulus` / `Approved`.
6. **SLA Engine:** Total SLA internal = 6 hari kerja (Pre-check 1 hk, Cek Fisik 1 hk, Approval PIC Usaha 1 hk, Approval Akuntansi 2 hk, SPP 1 hk). Timer WAJIB otomatis di-PAUSE saat status `WAITING_HARDCOPY` atau `Menunggu Mitra` / `REVISION_*`, serta memotong hari Sabtu, Minggu, dan tabel `national_holidays`.
7. **Isolasi Keamanan (RLS):** Mitra hanya boleh melihat dan mengubah pengajuan milik `vendor_id`-nya sendiri.
8. **Responsive Mobile-First:** Portal Mitra & Approval PIC Usaha harus sangat nyaman di layar HP (`.apk`), sedangkan panel pemeriksaan Admin Accelera & Akuntansi mendukung tampilan Desktop Split-Screen (PDF Viewer + Panel Keputusan).
9. Selalu pastikan `npm run typecheck` dan `npm run build` lolos tanpa error di akhir setiap tahap.

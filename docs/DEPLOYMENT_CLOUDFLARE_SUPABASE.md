# Panduan Deployment Produksi: Cloudflare Workers/Pages & Supabase

Dokumen ini berisi panduan langkah demi langkah bagi Tim IT untuk melakukan deployment produksi **Accelera HUB** ke **Cloudflare** (`@opennextjs/cloudflare` / Wrangler) yang terhubung dengan **Supabase PostgreSQL & Auth**.

---

## 1. Daftar Lengkap Environment Variables Produksi

Konfigurasikan variabel lingkungan berikut pada **Cloudflare Dashboard** (**Workers & Pages** → pilih proyek `accelera-hub` → **Settings** → **Variables and Secrets**):

| Nama Variabel | Tipe di Cloudflare | Deskripsi & Contoh Nilai Produksi |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Plaintext | URL domain utama produksi tanpa garis miring di akhir (contoh: `https://hub.accelera.co.id` atau `https://accelera-hub.workers.dev`). Digunakan untuk Origin CORS Resumable Upload & URL QR Code SPP. |
| `NEXT_PUBLIC_SUPABASE_URL` | Plaintext | URL proyek Supabase produksi (`https://<project-ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Plaintext | Supabase Publishable Key (`sb_publishable_...`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Plaintext | Supabase `anon` public key (JWT). |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret (Encrypted)** | Supabase `service_role` secret key. **Jangan pernah diekspos ke client (`NEXT_PUBLIC_*`)**. Digunakan oleh Admin API, verifikasi QR publik terbatas, dan Cron SLA. |
| `GOOGLE_CLIENT_ID` | Plaintext / Secret | OAuth 2.0 Client ID dari Google Cloud Console (`....apps.googleusercontent.com`). |
| `GOOGLE_CLIENT_SECRET` | **Secret (Encrypted)** | OAuth 2.0 Client Secret dari Google Cloud Console (`GOCSPX-...`). |
| `GOOGLE_REFRESH_TOKEN` | **Secret (Encrypted)** | OAuth 2.0 Refresh Token permanen akun Gmail arsip 15 GB (`1//04...`). |
| `GOOGLE_ROOT_FOLDER_ID` | Plaintext | ID folder utama `Accelera_HUB_Arsip` di Google Drive. |
| `RESEND_API_KEY` | **Secret (Encrypted)** | API Key Resend (`re_...`) untuk pengiriman email OTP/Magic Link, notifikasi Pre-Check Pass, Revisi, dan SPP Selesai. |
| `TELEGRAM_BOT_TOKEN` | **Secret (Encrypted)** | Token Bot Telegram dari `@BotFather` (`123456789:ABC...`) untuk notifikasi grup internal. |
| `TELEGRAM_CHAT_ID` | Plaintext | ID Grup / Supergroup Telegram internal (contoh: `-1001234567890`). |
| `CRON_SECRET` | **Secret (Encrypted)** | Token rahasia khusus produksi untuk mengamankan endpoint `/api/cron/keep-alive` dan `/api/cron/sla-reminder` (`Authorization: Bearer <CRON_SECRET>`). |

### Cara Generate `CRON_SECRET` Baru Khusus Produksi
Jangan menggunakan nilai contoh dari `.env.example`. Jalankan salah satu perintah berikut di terminal untuk membuat `CRON_SECRET` kriptografis 64 karakter baru:

**Menggunakan Node.js (Windows / macOS / Linux):**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Menggunakan OpenSSL:**
```bash
openssl rand -hex 32
```

Simpan hasil string 64 karakter tersebut ke variabel **`CRON_SECRET`** di Cloudflare (sebagai *Secret*) dan pada konfigurasi header job penjadwal Cron Anda.

---

## 2. Konfigurasi Redirect URLs Produksi di Supabase Auth

Agar fitur **Magic Link / OTP**, **Undangan Akun Baru (Invite-Only)**, dan **Reset Password (`/reset-password`)** berjalan tanpa error di domain produksi:

1. Masuk ke **Supabase Dashboard** → pilih proyek produksi → menu **Authentication** → **URL Configuration**.
2. Pada kolom **Site URL**, isi dengan URL utama produksi Anda:
   ```text
   https://hub.accelera.co.id
   ```
   *(Ganti dengan domain Cloudflare produksi aktual Anda).*
3. Pada bagian **Redirect URLs**, tambahkan daftar URL berikut:
   ```text
   https://hub.accelera.co.id/auth/callback
   https://hub.accelera.co.id/auth/callback?**
   https://hub.accelera.co.id/reset-password
   https://hub.accelera.co.id/**
   ```
4. Klik **Save**.

---

## 3. Langkah Build & Deploy ke Cloudflare

Pastikan seluruh migrasi database (`supabase/migrations/001_initial_schema.sql`, `002_sla_engine.sql`, `002_hotfix_sprint2.sql`) telah dijalankan pada SQL Editor Supabase produksi.

1. **Verifikasi Typecheck, Lint & Build Lokal:**
   ```bash
   npm run typecheck
   npm run lint
   npm run build
   ```
2. **Login ke Akun Cloudflare via Wrangler:**
   ```bash
   npx wrangler login
   ```
3. **Build & Deploy dengan OpenNext Cloudflare:**
   ```bash
   npm run deploy
   ```
   *(Script `npm run deploy` otomatis menjalankan `opennextjs-cloudflare build && opennextjs-cloudflare deploy`).*

> **Catatan Ukuran Bundle:** Seluruh integrasi Google Drive, Resend, dan Telegram dibangun menggunakan `fetch()` REST API murni tanpa library berat (`googleapis`, `puppeteer`, `chromium`), sehingga ukuran bundle Worker terkompresi tetap ringan dan di bawah batas 3 MB Cloudflare Workers Free Tier.

---

## 4. Konfigurasi Cron Trigger Produksi (`/api/cron/*`)

Accelera HUB memiliki 2 endpoint Cron yang dilindungi header `Authorization: Bearer <CRON_SECRET>`:

1. **`GET /api/cron/keep-alive`**
   - **Fungsi:** Menjalankan RPC `SELECT 1` (`public.keep_alive()`) ke PostgreSQL agar database **Supabase Free Tier tidak terkena auto-pause** (Supabase mem-pause proyek gratis jika tidak ada aktivitas selama 7 hari).
   - **Jadwal Rekomendasi:** Setiap **3 hari sekali** pukul 00:00 UTC (`0 0 */3 * *`).
2. **`GET /api/cron/sla-reminder`**
   - **Fungsi:** Menghitung ulang durasi hari kerja seluruh pengajuan aktif (`recalculateSubmissionSlaServer`) dan mengirimkan laporan **Daily SLA Digest** (daftar tagihan `Perlu Perhatian` dan `Terlambat`) ke Grup Telegram Internal.
   - **Jadwal Rekomendasi:** Setiap **Senin–Jumat pukul 08.30 WIB** (`30 1 * * 1-5` dalam waktu UTC, karena `WIB = UTC+7`).

### Opsi A: Menggunakan Cloudflare Cron Triggers + Cron Worker / Scheduled Handler
Pada `wrangler.toml`, tambahkan kedua ekspresi cron (dalam zona waktu **UTC**):

```toml
[triggers]
# 1) "0 0 */3 * *"   -> Tiap 3 hari pukul 07:00 WIB (00:00 UTC) untuk /api/cron/keep-alive
# 2) "30 1 * * 1-5"  -> Senin-Jumat pukul 08:30 WIB (01:30 UTC) untuk /api/cron/sla-reminder
crons = ["0 0 */3 * *", "30 1 * * 1-5"]
```

Apabila menggunakan Cloudflare Worker penggerak Cron atau layanan Cron HTTP gratis seperti **cron-job.org** / **GitHub Actions Scheduled Workflow** / **Cloudflare Queues & Triggers**:

- **Job 1 — Anti-Pause Supabase (Tiap 3 Hari):**
  - **Method & URL:** `GET https://hub.accelera.co.id/api/cron/keep-alive`
  - **Cron Expression (UTC):** `0 0 */3 * *`
  - **HTTP Header:**
    ```text
    Authorization: Bearer <ISI_DENGAN_CRON_SECRET_PRODUKSI>
    ```

- **Job 2 — Pengingat Harian SLA Telegram (Senin–Jumat 08.30 WIB):**
  - **Method & URL:** `GET https://hub.accelera.co.id/api/cron/sla-reminder`
  - **Cron Expression (UTC):** `30 1 * * 1-5` *(01:30 UTC = 08:30 WIB)*
  - **HTTP Header:**
    ```text
    Authorization: Bearer <ISI_DENGAN_CRON_SECRET_PRODUKSI>
    ```

### Cara Uji Coba Endpoint Cron Secara Manual
Gunakan `curl` dari terminal untuk memastikan kedua endpoint mengembalikan `HTTP 200 OK` dengan `{"ok": true}`:

```bash
curl -i -H "Authorization: Bearer <CRON_SECRET_PRODUKSI>" https://hub.accelera.co.id/api/cron/keep-alive
curl -i -H "Authorization: Bearer <CRON_SECRET_PRODUKSI>" https://hub.accelera.co.id/api/cron/sla-reminder
```

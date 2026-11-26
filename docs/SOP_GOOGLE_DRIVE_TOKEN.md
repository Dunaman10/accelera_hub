# SOP Pengelolaan Akun Google Drive Arsip & Pembaruan `GOOGLE_REFRESH_TOKEN`

Dokumen ini merupakan Prosedur Standar Operasional (SOP) bagi Administrator IT dalam mengelola akun Gmail khusus penyimpanan arsip **Accelera HUB** (15 GB Private Vault) serta langkah cepat pemulihan token OAuth 2.0 apabila terjadi pergantian kata sandi.

---

## 1. Aturan Pengelolaan Akun Gmail Khusus Arsip (PENTING)

Sistem **Accelera HUB** menggunakan akun Gmail/Google khusus sebagai brankas dokumen penagihan (`Invoice`, `Faktur Pajak`, `BAST`, `PO/Kontrak`, dan `PDF SPP`) melalui **Google Drive REST API v3 (OAuth 2.0 Refresh Token)**.

### Peringatan Kritis:
1. **DILARANG Mengganti Password Akun Gmail Arsip Secara Sembarangan:**
   Berdasarkan kebijakan keamanan Google OAuth 2.0, **setiap kali password akun Google diganti, seluruh `GOOGLE_REFRESH_TOKEN` yang sedang aktif akan dicabut (revoked) secara otomatis oleh Google**. Jika hal ini terjadi tanpa memperbarui `GOOGLE_REFRESH_TOKEN` di Cloudflare, fitur unggah dokumen Mitra dan pratinjau PDF akan berhenti berfungsi (`invalid_grant`).
2. **Pastikan Status OAuth Consent Screen = `In Production`:**
   Pada **Google Cloud Console** → **APIs & Services** → **OAuth consent screen**, pastikan *Publishing status* sudah diubah dari **Testing** menjadi **In Production**.
   *(Jika masih berstatus `Testing`, Google akan membatalkan Refresh Token secara otomatis setiap 7 hari sekali!).*
3. **Jaga Status File Tetap Private:**
   Jangan pernah mengubah izin folder atau file di dalam `Accelera_HUB_Arsip` menjadi publik (*"Anyone with the link"*). Seluruh pembacaan dokumen di aplikasi dilakukan melalui proxy terautentikasi `/api/documents/[fileId]/view`.

---

## 2. Cara Membagikan Folder `Accelera_HUB_Arsip` ke Staf Internal (Izin Ketat `Viewer`)

Apabila tim Audit Internal, Keuangan, atau Manajemen memerlukan akses melihat struktur folder arsip langsung di antarmuka Google Drive (`Tahun / Bulan / NoAgenda - NamaMitra`):

1. Login ke [Google Drive](https://drive.google.com) menggunakan **Akun Gmail Khusus Arsip**.
2. Klik kanan pada folder utama **`Accelera_HUB_Arsip`** (atau subfolder Tahun/Bulan tertentu) → pilih **Bagikan (Share)** → **Bagikan (Share)**.
3. Masukkan alamat email Google milik staf internal yang berwenang.
4. **WAJIB:** Ubah peran hak akses di sebelah kanan nama staf menjadi **Pelihat (`Viewer`)** — **JANGAN** memberikan izin *Editor* agar staf tidak sengaja menghapus, memindahkan, atau mengubah nama file yang terhubung dengan `drive_file_id` di database PostgreSQL.
5. Klik ikon gerigi (**Setelan / Settings**) di pojok kanan atas dialog Share, lalu **hapus centang** pada opsi *"Pelihat dan pengomentar dapat melihat opsi untuk mendownload, mencetak, dan menyalin"* jika diperlukan pembatasan ekstra.
6. Klik **Kirim (Send)**.

---

## 3. Langkah 2 Menit Memperbarui `GOOGLE_REFRESH_TOKEN` via OAuth Playground

Jika suatu saat password akun Gmail arsip terpaksa diganti (misalnya karena rotasi keamanan berkala), lakukan langkah 2 menit berikut untuk menerbitkan `GOOGLE_REFRESH_TOKEN` baru:

### Langkah 1 — Buka Google OAuth 2.0 Playground & Masukkan Credentials
1. Buka **[https://developers.google.com/oauthplayground](https://developers.google.com/oauthplayground)**.
2. Klik ikon **Gerigi (OAuth 2.0 Configuration)** di pojok kanan atas.
3. Centang kotak **"Use your own OAuth credentials"**.
4. Isi:
   - **OAuth Client ID:** Nilai `GOOGLE_CLIENT_ID` proyek Anda.
   - **OAuth Client secret:** Nilai `GOOGLE_CLIENT_SECRET` proyek Anda.
   *(Pastikan pada Google Cloud Console, URI `https://developers.google.com/oauthplayground` sudah terdaftar di bagian **Authorized redirect URIs** pada OAuth Client ID tersebut).*

### Langkah 2 — Otorisasi Scope Google Drive API v3
1. Pada panel kiri (*Step 1: Select & authorize APIs*), cari **Drive API v3** atau ketik langsung di kotak *Input your own scopes*:
   ```text
   https://www.googleapis.com/auth/drive
   ```
2. Klik tombol **Authorize APIs**.
3. Login menggunakan **Akun Gmail Khusus Arsip** dan klik **Allow / Izinkan**.

### Langkah 3 — Tukar Authorization Code & Simpan Refresh Token Baru
1. Pada panel *Step 2: Exchange authorization code for tokens*, klik tombol **Exchange authorization code for tokens**.
2. Salin nilai **`Refresh token`** yang muncul (diawali dengan `1//04...`).
3. Masuk ke **Cloudflare Dashboard** → **Workers & Pages** → proyek `accelera-hub` → **Settings** → **Variables and Secrets**.
4. Edit variabel **`GOOGLE_REFRESH_TOKEN`**, tempelkan token baru tersebut, lalu klik **Save and Deploy**.
5. Penyimpanan dan pratinjau Google Drive di Accelera HUB akan langsung aktif kembali tanpa perlu mengubah kode maupun database.

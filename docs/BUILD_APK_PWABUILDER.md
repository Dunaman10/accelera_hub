# Panduan Packaging Android `.apk` (TWA) via PWABuilder & Instalasi Mitra

Dokumen ini menjelaskan cara membungkus URL produksi **Accelera HUB** menjadi aplikasi Android `.apk` (*Trusted Web Activity* / TWA) menggunakan **PWABuilder**, mengaktifkan tampilan *full-screen* tanpa address bar Chrome via Digital Asset Links, serta panduan instalasi untuk Mitra.

---

## 1. Prasyarat Sebelum Membuka PWABuilder

Pastikan aplikasi produksi Anda sudah *live* dengan HTTPS dan file-file PWA berikut sudah aktif saat diakses lewat browser:
- `https://<domain-produksi-anda>/manifest.json`
- `https://<domain-produksi-anda>/sw.js`
- `https://<domain-produksi-anda>/offline`
- `https://<domain-produksi-anda>/.well-known/assetlinks.json`
- `https://<domain-produksi-anda>/icons/icon-192x192.png`
- `https://<domain-produksi-anda>/icons/icon-512x512.png`
- `https://<domain-produksi-anda>/icons/icon-maskable-512x512.png`

---

## 2. Langkah Packaging `.apk` di `pwabuilder.com`

1. Buka **[https://www.pwabuilder.com](https://www.pwabuilder.com)** melalui browser desktop.
2. Masukkan URL produksi Accelera HUB (contoh: `https://hub.accelera.co.id`) lalu klik **Start**.
3. Tunggu PWABuilder selesai memvalidasi **Manifest**, **Service Worker**, dan **Security (HTTPS)**, lalu klik tombol **Package for stores**.
4. Pada kartu **Android**, klik **Generate Package** dan sesuaikan konfigurasi berikut:
   - **Package ID:** `id.accelera.hub.twa` *(atau sesuai domain perusahaan Anda, catat nilai ini!)*.
   - **App name & Short name:** `Accelera HUB`
   - **Start URL:** `/login`
   - **Display mode:** `Standalone`
   - **Status bar color & Navigation bar color:** `#1F4E78`
   - **Splash screen color:** `#FFFFFF`
   - **Fallback behavior:** `Custom Tabs`
   - **Signing Key:** Pilih **Create new** (PWABuilder akan membuatkan file keystore `.keystore` beserta *password* dan `assetlinks.json` otomatis).
5. Klik **Download Package**. Anda akan mendapatkan file `.zip` yang berisi:
   - File **`Accelera HUB.apk`** (siap dibagikan ke Mitra & PIC Usaha).
   - File **`signing.keystore`** & **`signing-key-info.txt`** (**WAJIB DISIMPAN AMAN** oleh Tim IT untuk pembaruan versi `.apk` berikutnya).
   - File **`assetlinks.json`** yang berisi `sha256_cert_fingerprints` asli dari signing key Anda.

---

## 3. Memasang `SHA-256 Fingerprint` ke `assetlinks.json` (Agar Full-Screen Tanpa Address Bar)

Agar Android mengenali bahwa aplikasi `.apk` (TWA) adalah pemilik sah domain web Anda dan menyembunyikan *address bar* browser Chrome:

1. Buka file **`assetlinks.json`** yang ada di dalam folder `.zip` hasil unduhan PWABuilder (atau gunakan aplikasi Android *Asset Links Tool* untuk melihat SHA-256 fingerprint).
2. Salin nilai `package_name` dan `sha256_cert_fingerprints` (format 32 pasang heksadesimal dipisahkan titik dua `AA:BB:CC:...`).
3. Buka file [`public/.well-known/assetlinks.json`](../public/.well-known/assetlinks.json) di dalam source code proyek ini, lalu ganti nilai template dengan milik Anda:
   ```json
   [
     {
       "relation": [
         "delegate_permission/common.handle_all_urls"
       ],
       "target": {
         "namespace": "android_app",
         "package_name": "id.accelera.hub.twa",
         "sha256_cert_fingerprints": [
           "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C"
         ]
       }
     }
   ]
   ```
4. Jalankan **re-deploy** ke Cloudflare:
   ```bash
   npm run deploy
   ```
5. Buka `https://<domain-produksi-anda>/.well-known/assetlinks.json` di browser untuk memastikan JSON baru sudah tayang dengan header `Content-Type: application/json`. Setelah itu, buka aplikasi `.apk` di ponsel Android — aplikasi akan tampil **100% Full-Screen (Standalone)** seperti aplikasi native!

---

## 4. Panduan Singkat 3 Langkah Instalasi `.apk` untuk Mitra (Android)

Bagikan file **`Accelera-HUB.apk`** kepada PIC Mitra melalui link unduhan resmi atau grup komunikasi resmi disertai panduan 3 langkah berikut:

1. **Langkah 1 — Unduh File `.apk`:**
   Buka file `Accelera-HUB.apk` yang telah diunduh di ponsel Android Anda melalui aplikasi *Files* / *Unduhan*.
2. **Langkah 2 — Izinkan Instalasi dari Sumber Tepercaya (*Install Unknown Apps*):**
   Jika muncul peringatan keamanan Android *"Demi keamanan, ponsel Anda tidak diizinkan menginstal aplikasi yang tidak dikenal dari sumber ini"*, ketuk **Setelan (Settings)** → aktifkan sakelar **Izinkan dari sumber ini (Allow from this source)**.
3. **Langkah 3 — Instal & Masuk ke Portal:**
   Ketuk **Instal (Install)**, tunggu beberapa detik hingga selesai, lalu buka ikon **Accelera HUB** di layar utama ponsel Anda dan login menggunakan Email Terdaftar (Password atau Kode OTP 6 Digit).

---

## 5. Alternatif Instalasi Tanpa `.apk` (*Add to Home Screen* — iOS / iPhone & Non-Chrome)

Bagi Mitra atau manajemen yang menggunakan **iPhone / iPad (iOS)** atau tidak ingin menginstal file `.apk`, **Accelera HUB** dapat dipasang langsung sebagai aplikasi PWA:

### A. Pengguna iPhone / iPad (Safari iOS)
1. Buka URL portal **Accelera HUB** menggunakan browser **Safari**.
2. Ketuk ikon **Bagikan (Share)** (kotak dengan panah ke atas di bagian bawah layar).
3. Geser ke bawah dan pilih **Tambahkan ke Layar Utama (Add to Home Screen)** → ketuk **Tambah (Add)**. Ikon **Accelera HUB** akan muncul di layar utama iPhone dan berjalan dalam mode layar penuh tanpa bilah navigasi Safari.

### B. Pengguna Android / Desktop tanpa File `.apk`
1. Buka URL portal **Accelera HUB** di Chrome / Microsoft Edge.
2. Ketuk menu titik tiga (`⋮`) di pojok kanan atas browser.
3. Pilih **Instal Aplikasi (Install App)** atau **Tambahkan ke Layar Utama (Add to Home Screen)**.

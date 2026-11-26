export interface MonitoringGuideItem {
  no: number;
  section: string;
  howToUse: string;
  notes: string;
}

/**
 * Panduan resmi penggunaan Monitoring & Dashboard Penagihan Accelera HUB
 * (Versi tersinkronisasi dengan sistem web, State Machine ketat, dan SLA Engine 6 HK)
 */
export const MONITORING_GUIDE_ITEMS: MonitoringGuideItem[] = [
  {
    no: 1,
    section: "Dashboard",
    howToUse:
      "Lihat ringkasan total tagihan, status selesai, dalam proses, keterlambatan/perhatian, akumulasi nilai (Rp), tabel ringkasan, dan grafik.",
    notes:
      "Terhitung otomatis secara real-time dari seluruh data pengajuan di Tabel Monitoring.",
  },
  {
    no: 2,
    section: "Tanggal Terima",
    howToUse:
      "Tercatat otomatis saat Mitra mengirimkan pengajuan tagihan softcopy pertama kali ke sistem.",
    notes:
      "Digunakan sebagai acuan awal periode laporan dan perhitungan durasi SLA.",
  },
  {
    no: 3,
    section: "No. Agenda",
    howToUse:
      "Nomor register unik (format AGP/SSS/...) di-generate otomatis oleh sistem untuk setiap pengajuan tagihan.",
    notes:
      "Klik No. Agenda pada Tabel Monitoring untuk membuka detail dokumen & riwayat tahapan.",
  },
  {
    no: 4,
    section: "Status Pre-check",
    howToUse:
      "Diisi oleh Admin Accelera pada tahap pemeriksaan softcopy: Belum Diperiksa, Pass, atau Revisi.",
    notes:
      "Jika Pass, Mitra diminta mengirim berkas fisik (hardcopy) dan timer SLA otomatis di-PAUSE.",
  },
  {
    no: 5,
    section: "Status Kelengkapan Fisik",
    howToUse:
      "Diisi oleh Admin Accelera saat mencocokkan berkas fisik asli dengan softcopy: Belum Diperiksa, Lengkap, atau Tidak Lengkap.",
    notes:
      "Berkas hanya dapat diteruskan ke PIC Usaha jika Pre-check = Pass, Fisik = Lengkap, dan Verifikasi = Lulus.",
  },
  {
    no: 6,
    section: "Verifikasi",
    howToUse:
      "Pilih Lulus / Tidak Lulus setelah pengecekan kelengkapan, legalitas, administrasi, dan substansi pekerjaan (Admin Accelera & PIC Usaha).",
    notes:
      "Wajib mengisi catatan temuan, tindak lanjut, PIC tindak lanjut, dan target selesai bila Tidak Lulus.",
  },
  {
    no: 7,
    section: "Validasi",
    howToUse:
      "Pilih Lulus / Tidak Lulus oleh Tim Akuntansi setelah konfirmasi nominal, DPP/PPN/PPh, Faktur Pajak, kontrak/PO, dan BAST.",
    notes:
      "Verifikasi (Admin/PIC Usaha) dan Validasi (Akuntansi) merupakan gerbang kontrol yang terpisah.",
  },
  {
    no: 8,
    section: "Temuan / Tindak Lanjut",
    howToUse:
      "Tuliskan kekurangan secara spesifik, tentukan PIC yang menindaklanjuti, dan tetapkan tanggal Target Selesai.",
    notes:
      "Gunakan bahasa ringkas dan jelas agar Mitra atau tim internal segera memahami perbaikan yang diperlukan.",
  },
  {
    no: 9,
    section: "Target SLA (6 Hari Kerja)",
    howToUse:
      "Standar SLA internal yang disahkan adalah 6 Hari Kerja: Pre-check (1 HK), Cek Fisik (1 HK), PIC Usaha (1 HK), Akuntansi (2 HK), dan SPP (1 HK).",
    notes:
      "Seluruh alokasi target tahap berjalan otomatis sesuai SOP internal Accelera.",
  },
  {
    no: 10,
    section: "Status Akhir",
    howToUse:
      "Status otomatis mengikuti progres: Dalam Proses, Menunggu Mitra, Selesai, atau Dibatalkan.",
    notes:
      "Status Selesai hanya terkunci setelah PDF SPP resmi diterbitkan. Pembatalan membuka kembali nomor invoice untuk pengajuan ulang.",
  },
  {
    no: 11,
    section: "Status SLA & Auto-Pause",
    howToUse:
      "Terhitung otomatis (Sesuai SLA, Dalam Proses, Perlu Perhatian, atau Terlambat) berdasarkan akumulasi hari kerja aktif internal.",
    notes:
      "Sudah otomatis memotong Sabtu, Minggu, Hari Libur Nasional/Cuti Bersama (Master Hari Libur) serta Auto-Pause saat status Menunggu Mitra.",
  },
  {
    no: 12,
    section: "Filter & Export Excel (.xlsx)",
    howToUse:
      "Gunakan filter tanggal, Mitra, Status Akhir, Status SLA, atau pencarian bebas lalu klik Export Excel (.xlsx) untuk mengunduh laporan.",
    notes:
      "Tidak ada batasan jumlah baris (dinamis di database); file hasil export sudah menyertakan sheet Data Monitoring dan sheet Panduan.",
  },
];

import type { UserRole, SubmissionStage, DocCategory, FinalStatus, SlaStatus } from "@/types";

export const ROLE_DEFAULT_ROUTES: Record<UserRole, string> = {
  mitra: "/mitra",
  admin_accelera: "/admin",
  pic_usaha: "/pic",
  akuntansi: "/akuntansi",
  divisi_usaha: "/spp",
  super_admin: "/dashboard",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  mitra: "Mitra / Vendor",
  admin_accelera: "Admin Accelera",
  pic_usaha: "PIC Usaha",
  akuntansi: "Akuntansi",
  divisi_usaha: "Divisi Usaha (SPP)",
  super_admin: "Super Admin",
};

export const STAGE_LABELS: Record<SubmissionStage, string> = {
  SUBMITTED: "Input Softcopy",
  PRE_CHECK: "Pre-Check Softcopy",
  REVISION_SOFTCOPY: "Revisi Softcopy",
  WAITING_HARDCOPY: "Menunggu Kirim Fisik",
  PHYSICAL_CHECK: "Cek Fisik Hardcopy",
  REVISION_HARDCOPY: "Revisi Dokumen Fisik",
  PIC_APPROVAL: "Approval PIC Usaha",
  REVISION_PIC: "Revisi Substansi PIC",
  ACCOUNTING_APPROVAL: "Approval Akuntansi",
  REVISION_ACCOUNTING: "Revisi Pajak / Akuntansi",
  SPP_PROCESSING: "Penerbitan SPP",
  COMPLETED: "SPP Selesai",
  CANCELLED: "Dibatalkan",
};

export const DOC_CATEGORY_META: Array<{
  category: DocCategory;
  label: string;
  required: boolean;
  description: string;
}> = [
  {
    category: "INVOICE",
    label: "Invoice / Tagihan Resmi",
    required: true,
    description: "Dokumen invoice resmi bertandatangan & bermeterai (Wajib)",
  },
  {
    category: "BAST",
    label: "Berita Acara Serah Terima (BAST)",
    required: true,
    description: "BAST atau Berita Acara Penyelesaian Pekerjaan (Wajib)",
  },
  {
    category: "FAKTUR_PAJAK",
    label: "Faktur Pajak (e-Faktur)",
    required: false,
    description: "Faktur pajak PPN / bukti potong perpajakan bila berlaku",
  },
  {
    category: "PO_KONTRAK",
    label: "Salinan PO / Kontrak / SPK",
    required: false,
    description: "Dokumen Purchase Order, SPK, atau Perjanjian Kerja Sama",
  },
  {
    category: "LAINNYA",
    label: "Dokumen Pendukung Lainnya",
    required: false,
    description: "Lampiran pendukung tambahan (Timesheet, Kwitansi, Foto, dll.)",
  },
];

export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  INVOICE: "Invoice",
  FAKTUR_PAJAK: "Faktur Pajak",
  BAST: "BAST",
  PO_KONTRAK: "PO / Kontrak",
  LAINNYA: "Dokumen Lainnya",
};

export function getHomeRouteForRole(role?: UserRole | null): string {
  if (!role) return "/login";
  return ROLE_DEFAULT_ROUTES[role] ?? "/login";
}

export function isRouteAllowedForRole(pathname: string, role: UserRole): boolean {
  if (role === "super_admin") {
    return true;
  }

  if (pathname === "/mitra" || pathname.startsWith("/mitra/")) {
    return role === "mitra";
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return role === "admin_accelera";
  }

  if (pathname === "/pic" || pathname.startsWith("/pic/")) {
    return role === "pic_usaha";
  }

  if (pathname === "/akuntansi" || pathname.startsWith("/akuntansi/")) {
    return role === "akuntansi";
  }

  if (pathname === "/spp" || pathname.startsWith("/spp/")) {
    return role === "divisi_usaha" || role === "akuntansi";
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return false;
  }

  return true;
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatNumberInputRupiah(rawDigits: string): string {
  const digits = rawDigits.replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID").format(Number(digits));
}

export function parseRupiahToNumber(formatted: string): number {
  const digits = formatted.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits);
}

export function formatDateTimeWIB(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function formatDateWIB(isoString?: string | null): string {
  if (!isoString) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const idx = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const val = bytes / Math.pow(1024, idx);
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function getFinalStatusBadgeClass(status: FinalStatus): string {
  switch (status) {
    case "Selesai":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "Menunggu Mitra":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "Dibatalkan":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "Dalam Proses":
    default:
      return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
  }
}

export function getSlaStatusBadgeClass(status: SlaStatus): string {
  switch (status) {
    case "Sesuai SLA":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
    case "Perlu Perhatian":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
    case "Terlambat":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "Dalam Proses":
    default:
      return "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30";
  }
}

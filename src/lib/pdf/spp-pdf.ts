/**
 * Official PDF Generator (`pdf-lib` + `qrcode`) — Accelera HUB
 * ----------------------------------------------------------------------------
 * Hard Constraints:
 * - Ringan & kompatibel Cloudflare Workers (< 3 MB bundle, tanpa Puppeteer/Chromium).
 * - Menggambar QR Code menggunakan matriks `QRCode.create()` langsung via `pdf-lib`
 *   vector rectangles (`page.drawRectangle`) sehingga tidak membutuhkan `node-canvas`.
 * - Menghasilkan 2 PDF resmi:
 *   1. PDF Lembar Hasil Cek & Approval (`generateCheckSheetPdf`)
 *   2. PDF Surat Pengajuan Pembayaran / SPP (`generateSppPdf`)
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import type { BillingSubmission, Profile, StageLog, Vendor } from "@/types";
import { formatDateTimeWIB, formatRupiah, ROLE_LABELS, STAGE_LABELS } from "@/lib/constants";
import { formatTerbilangRupiah } from "@/lib/format-terbilang";

export interface StageLogWithActor extends StageLog {
  actor_name?: string | null;
  actor_role?: string | null;
}

export interface GenerateCheckSheetPdfParams {
  submission: BillingSubmission;
  vendor: Vendor | null;
  stageLogs: StageLogWithActor[];
  qrVerificationUrl: string;
  qrToken: string;
  sppNo?: string | null;
}

export interface GenerateSppPdfParams {
  submission: BillingSubmission;
  vendor: Vendor | null;
  sppNo: string;
  qrVerificationUrl: string;
  qrToken: string;
  issuedAt: string;
  sentToFinanceAt?: string | null;
  createdByProfile?: Pick<Profile, "id" | "full_name" | "role"> | null;
  approvedPicProfile?: Pick<Profile, "id" | "full_name" | "role"> | null;
  approvedAccProfile?: Pick<Profile, "id" | "full_name" | "role"> | null;
  notes?: string | null;
}

const COLOR_PRIMARY = rgb(0.08, 0.25, 0.52);
const COLOR_DARK = rgb(0.12, 0.14, 0.18);
const COLOR_MUTED = rgb(0.42, 0.46, 0.52);
const COLOR_BORDER = rgb(0.82, 0.85, 0.89);
const COLOR_BG_LIGHT = rgb(0.96, 0.97, 0.99);
const COLOR_SUCCESS = rgb(0.06, 0.48, 0.28);

function sanitizePdfText(input?: string | null): string {
  if (!input) return "-";
  // Sanitasi karakter non-WinAnsi agar StandardFonts Helvetica tidak melempar error encoding
  return input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, " ")
    .trim();
}

function wrapTextLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const clean = sanitizePdfText(text).replace(/\r\n/g, "\n");
  const paragraphs = clean.split("\n");
  const lines: string[] = [];

  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = `${currentLine} ${words[i]}`;
      if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : ["-"];
}

/**
 * Menggambar matriks QR Code vektor langsung ke halaman PDF menggunakan `QRCode.create()`.
 * Sepenuhnya kompatibel di Edge / Cloudflare Workers tanpa ketergantungan Canvas native.
 */
function drawVectorQrCode(
  page: PDFPage,
  content: string,
  boxX: number,
  boxY: number,
  boxSize: number
) {
  const qr = QRCode.create(content || "ACCELERA-HUB-VERIFY", {
    errorCorrectionLevel: "M",
  });

  const moduleCount = qr.modules.size;
  const quietZone = 2;
  const totalModules = moduleCount + quietZone * 2;
  const cellSize = boxSize / totalModules;

  // Background putih + border kotak QR
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxSize,
    height: boxSize,
    color: rgb(1, 1, 1),
    borderColor: COLOR_BORDER,
    borderWidth: 1,
  });

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      const isDark = qr.modules.get(row, col);
      if (isDark) {
        const rx = boxX + (col + quietZone) * cellSize;
        // Koordinat Y pada PDF dimulai dari bawah
        const ry =
          boxY + boxSize - (row + quietZone + 1) * cellSize;
        page.drawRectangle({
          x: rx,
          y: ry,
          width: cellSize + 0.15,
          height: cellSize + 0.15,
          color: COLOR_DARK,
        });
      }
    }
  }
}

/**
 * 1. Generator PDF Lembar Hasil Cek & Approval
 * Memuat No. Agenda, metadata tagihan, hasil Verifikasi & Validasi,
 * tabel riwayat persetujuan lintas divisi (Nama, Role, Keputusan, Timestamp dari stage_logs),
 * serta QR Code verifikasi.
 */
export async function generateCheckSheetPdf({
  submission,
  vendor,
  stageLogs,
  qrVerificationUrl,
  qrToken,
  sppNo,
}: GenerateCheckSheetPdfParams): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Lembar Hasil Cek & Approval - ${submission.agenda_no}`);
  pdfDoc.setAuthor("Accelera HUB Digital Verification System");

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
  const { width, height } = page.getSize();
  const marginX = 40;
  let cursorY = height - 42;

  // HEADER BANNER
  page.drawRectangle({
    x: marginX,
    y: cursorY - 46,
    width: width - marginX * 2,
    height: 52,
    color: COLOR_PRIMARY,
  });

  page.drawText("ACCELERA HUB — LEMBAR HASIL CEK & APPROVAL DIGITAL", {
    x: marginX + 14,
    y: cursorY - 18,
    size: 12,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(
    `No. Agenda: ${sanitizePdfText(submission.agenda_no)}   |   Tahap: ${sanitizePdfText(
      STAGE_LABELS[submission.current_stage]
    )}${sppNo ? `   |   No. SPP: ${sanitizePdfText(sppNo)}` : ""}`,
    {
      x: marginX + 14,
      y: cursorY - 35,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.9, 0.94, 1),
    }
  );

  cursorY -= 66;

  // SECTION 1: RINGKASAN METADATA TAGIHAN
  page.drawText("I. DATA IDENTITAS PENGAJUAN TAGIHAN", {
    x: marginX,
    y: cursorY,
    size: 10,
    font: fontBold,
    color: COLOR_PRIMARY,
  });
  cursorY -= 8;

  const metadataRows: Array<[string, string]> = [
    ["Nomor Agenda", sanitizePdfText(submission.agenda_no)],
    ["Nama Mitra / Vendor", sanitizePdfText(vendor?.name ?? "-")],
    ["NPWP Mitra", sanitizePdfText(vendor?.npwp ?? "-")],
    ["Nomor Invoice", sanitizePdfText(submission.invoice_no)],
    ["Nomor PO / Kontrak", sanitizePdfText(submission.contract_po_no ?? "-")],
    ["Uraian Pekerjaan", sanitizePdfText(submission.work_type)],
    ["Nilai Tagihan (Rp)", sanitizePdfText(formatRupiah(Number(submission.amount)))],
    ["Terbilang", sanitizePdfText(formatTerbilangRupiah(Number(submission.amount)))],
    ["Tanggal Terima Softcopy", sanitizePdfText(formatDateTimeWIB(submission.softcopy_date))],
    ["Tanggal Terima Hardcopy", sanitizePdfText(formatDateTimeWIB(submission.hardcopy_date))],
  ];

  const tableWidth = width - marginX * 2;
  for (let i = 0; i < metadataRows.length; i++) {
    const [label, val] = metadataRows[i];
    const wrappedVal = wrapTextLines(val, fontRegular, 8.5, tableWidth - 155);
    const rowHeight = Math.max(17, wrappedVal.length * 11 + 6);
    cursorY -= rowHeight;

    page.drawRectangle({
      x: marginX,
      y: cursorY,
      width: tableWidth,
      height: rowHeight,
      color: i % 2 === 0 ? COLOR_BG_LIGHT : rgb(1, 1, 1),
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });

    page.drawText(label, {
      x: marginX + 8,
      y: cursorY + rowHeight - 12,
      size: 8.5,
      font: fontBold,
      color: COLOR_DARK,
    });

    for (let l = 0; l < wrappedVal.length; l++) {
      page.drawText(wrappedVal[l], {
        x: marginX + 148,
        y: cursorY + rowHeight - 12 - l * 11,
        size: 8.5,
        font: i === 6 ? fontBold : fontRegular,
        color: COLOR_DARK,
      });
    }
  }

  cursorY -= 18;

  // SECTION 2: HASIL VERIFIKASI & VALIDASI GERBANG PEMERIKSAAN
  page.drawText("II. RINGKASAN STATUS PEMERIKSAAN & SLA INTERNAL", {
    x: marginX,
    y: cursorY,
    size: 10,
    font: fontBold,
    color: COLOR_PRIMARY,
  });
  cursorY -= 8;

  const statusGrid: Array<[string, string, string, string]> = [
    [
      "1. Pre-Check Softcopy",
      sanitizePdfText(submission.precheck_status),
      "2. Cek Fisik Hardcopy",
      sanitizePdfText(submission.physical_status),
    ],
    [
      "3. Verifikasi Admin / PIC",
      sanitizePdfText(submission.verification_status),
      "4. Validasi Akuntansi & Pajak",
      sanitizePdfText(submission.validation_status),
    ],
    [
      "5. Status Akhir",
      sanitizePdfText(submission.final_status),
      "6. Realisasi Hari Kerja SLA",
      `${submission.actual_working_days} / ${submission.sla_target_days} HK (${sanitizePdfText(
        submission.sla_status
      )})`,
    ],
  ];

  const halfWidth = tableWidth / 2;
  for (const [l1, v1, l2, v2] of statusGrid) {
    const rowH = 19;
    cursorY -= rowH;

    page.drawRectangle({
      x: marginX,
      y: cursorY,
      width: halfWidth,
      height: rowH,
      color: rgb(1, 1, 1),
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });
    page.drawRectangle({
      x: marginX + halfWidth,
      y: cursorY,
      width: halfWidth,
      height: rowH,
      color: rgb(1, 1, 1),
      borderColor: COLOR_BORDER,
      borderWidth: 0.5,
    });

    page.drawText(l1, {
      x: marginX + 8,
      y: cursorY + 6,
      size: 8,
      font: fontRegular,
      color: COLOR_MUTED,
    });
    page.drawText(v1, {
      x: marginX + 130,
      y: cursorY + 6,
      size: 8.5,
      font: fontBold,
      color: COLOR_SUCCESS,
    });

    page.drawText(l2, {
      x: marginX + halfWidth + 8,
      y: cursorY + 6,
      size: 8,
      font: fontRegular,
      color: COLOR_MUTED,
    });
    page.drawText(v2, {
      x: marginX + halfWidth + 135,
      y: cursorY + 6,
      size: 8.5,
      font: fontBold,
      color: COLOR_SUCCESS,
    });
  }

  cursorY -= 18;

  // SECTION 3: TABEL RIWAYAT PERSETUJUAN LINTAS DIVISI (STAGE LOGS)
  page.drawText("III. RIWAYAT PERSETUJUAN LINTAS DIVISI (AUDIT TRAIL STAGE LOGS)", {
    x: marginX,
    y: cursorY,
    size: 10,
    font: fontBold,
    color: COLOR_PRIMARY,
  });
  cursorY -= 8;

  // Header Tabel Log
  const headerH = 18;
  cursorY -= headerH;
  page.drawRectangle({
    x: marginX,
    y: cursorY,
    width: tableWidth,
    height: headerH,
    color: COLOR_PRIMARY,
  });

  const colOffsets = [6, 118, 225, 310, 435];
  const headers = ["Tahap", "Nama Pejabat / Aktor", "Role", "Keputusan", "Waktu (WIB)"];
  headers.forEach((h, idx) => {
    page.drawText(h, {
      x: marginX + colOffsets[idx],
      y: cursorY + 5,
      size: 7.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
  });

  const orderedLogs = [...stageLogs]
    .sort(
      (a, b) =>
        new Date(a.entered_at).getTime() - new Date(b.entered_at).getTime()
    )
    .slice(-10); // Tampilkan hingga 10 log terakhir agar muat 1 halaman A4

  for (let i = 0; i < orderedLogs.length; i++) {
    const log = orderedLogs[i];
    const rowH = 18;
    if (cursorY - rowH < 135) break;
    cursorY -= rowH;

    page.drawRectangle({
      x: marginX,
      y: cursorY,
      width: tableWidth,
      height: rowH,
      color: i % 2 === 0 ? COLOR_BG_LIGHT : rgb(1, 1, 1),
      borderColor: COLOR_BORDER,
      borderWidth: 0.4,
    });

    const stageText = sanitizePdfText(STAGE_LABELS[log.to_stage] ?? log.to_stage).slice(0, 22);
    const actorText = sanitizePdfText(log.actor_name ?? "Sistem / Pejabat").slice(0, 20);
    const roleText = sanitizePdfText(log.actor_role ?? "-").slice(0, 16);
    const decisionText = sanitizePdfText(log.decision ?? "-").slice(0, 24);
    const tsText = sanitizePdfText(formatDateTimeWIB(log.exited_at ?? log.entered_at));

    const cells = [stageText, actorText, roleText, decisionText, tsText];
    cells.forEach((cell, idx) => {
      page.drawText(cell, {
        x: marginX + colOffsets[idx],
        y: cursorY + 5,
        size: 7.2,
        font: idx === 3 ? fontBold : fontRegular,
        color: COLOR_DARK,
      });
    });
  }

  // FOOTER QR CODE VERIFIKASI
  const footerBoxY = 36;
  const qrSize = 78;
  drawVectorQrCode(page, qrVerificationUrl, marginX, footerBoxY, qrSize);

  page.drawText("VERIFIKASI KEASLIAN DOKUMEN DIGITAL (QR CODE)", {
    x: marginX + qrSize + 14,
    y: footerBoxY + qrSize - 12,
    size: 9,
    font: fontBold,
    color: COLOR_PRIMARY,
  });

  page.drawText(
    "Dokumen Lembar Hasil Cek & Approval ini diterbitkan secara elektronik oleh sistem Accelera HUB.",
    {
      x: marginX + qrSize + 14,
      y: footerBoxY + qrSize - 26,
      size: 8,
      font: fontRegular,
      color: COLOR_DARK,
    }
  );

  page.drawText(
    "Pindai QR Code di samping untuk memverifikasi status persetujuan resmi tanpa tanda tangan basah.",
    {
      x: marginX + qrSize + 14,
      y: footerBoxY + qrSize - 38,
      size: 8,
      font: fontRegular,
      color: COLOR_MUTED,
    }
  );

  page.drawText(`Token Verifikasi: ${sanitizePdfText(qrToken)}`, {
    x: marginX + qrSize + 14,
    y: footerBoxY + qrSize - 53,
    size: 7.5,
    font: fontBold,
    color: COLOR_DARK,
  });

  page.drawText(`URL Publik: ${sanitizePdfText(qrVerificationUrl)}`, {
    x: marginX + qrSize + 14,
    y: footerBoxY + qrSize - 65,
    size: 7,
    font: fontRegular,
    color: COLOR_MUTED,
  });

  return pdfDoc.save();
}

/**
 * 2. Generator PDF Surat Pengajuan Pembayaran (SPP) Resmi
 * Memuat `spp_number` otomatis (`SPP/{TAHUN}/{BULAN}/{URUT}`), No. Agenda, Nama Mitra, NPWP,
 * No. Invoice, Uraian Pekerjaan, Nilai Tagihan (angka & terbilang), nama penyusun (`created_by`)
 * & pejabat penyetuju (`approved_pic_id`, `approved_acc_id`), serta QR Code verifikasi.
 */
export async function generateSppPdf({
  submission,
  vendor,
  sppNo,
  qrVerificationUrl,
  qrToken,
  issuedAt,
  sentToFinanceAt,
  createdByProfile,
  approvedPicProfile,
  approvedAccProfile,
  notes,
}: GenerateSppPdfParams): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Surat Pengajuan Pembayaran (SPP) - ${sppNo}`);
  pdfDoc.setAuthor("Accelera HUB - Divisi Usaha & Akuntansi");

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
  const { width, height } = page.getSize();
  const marginX = 42;
  const contentWidth = width - marginX * 2;
  let cursorY = height - 45;

  // HEADER SURAT RESMI SPP
  page.drawRectangle({
    x: marginX,
    y: cursorY - 56,
    width: contentWidth,
    height: 62,
    color: COLOR_PRIMARY,
  });

  page.drawText("SURAT PENGAJUAN PEMBAYARAN (SPP)", {
    x: marginX + 16,
    y: cursorY - 20,
    size: 14,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`NOMOR SPP: ${sanitizePdfText(sppNo)}`, {
    x: marginX + 16,
    y: cursorY - 36,
    size: 10,
    font: fontBold,
    color: rgb(0.92, 0.96, 1),
  });

  page.drawText(
    `Tanggal Terbit: ${sanitizePdfText(formatDateTimeWIB(issuedAt))}   |   Status: SAH & TERVERIFIKASI`,
    {
      x: marginX + 16,
      y: cursorY - 49,
      size: 8,
      font: fontRegular,
      color: rgb(0.86, 0.91, 1),
    }
  );

  cursorY -= 78;

  page.drawText(
    "Berdasarkan hasil pemeriksaan kelengkapan dokumen fisik, verifikasi substansi pekerjaan oleh PIC Usaha, serta",
    {
      x: marginX,
      y: cursorY,
      size: 8.8,
      font: fontRegular,
      color: COLOR_DARK,
    }
  );
  cursorY -= 12;
  page.drawText(
    "validasi perpajakan dan akuntansi yang telah dinyatakan LULUS, dengan ini diajukan pembayaran tagihan berikut:",
    {
      x: marginX,
      y: cursorY,
      size: 8.8,
      font: fontRegular,
      color: COLOR_DARK,
    }
  );

  cursorY -= 18;

  // TABEL RINCIAN SPP
  const amountNum = Number(submission.amount);
  const terbilangText = `# ${formatTerbilangRupiah(amountNum)} #`;

  const sppDetailRows: Array<[string, string, boolean?]> = [
    ["Nomor SPP", sanitizePdfText(sppNo), true],
    ["Nomor Agenda Registrasi", sanitizePdfText(submission.agenda_no), true],
    ["Nama Mitra / Penerima", sanitizePdfText(vendor?.name ?? "-"), true],
    ["NPWP Mitra", sanitizePdfText(vendor?.npwp ?? "-")],
    ["Alamat Mitra", sanitizePdfText(vendor?.address ?? "-")],
    ["Nomor Invoice", sanitizePdfText(submission.invoice_no), true],
    ["Nomor PO / Kontrak / SPK", sanitizePdfText(submission.contract_po_no ?? "-")],
    ["Uraian Pekerjaan", sanitizePdfText(submission.work_type)],
    ["Nilai Tagihan (Angka)", sanitizePdfText(formatRupiah(amountNum)), true],
    ["Nilai Tagihan (Terbilang)", sanitizePdfText(terbilangText), true],
    [
      "Status Verifikasi & Validasi",
      `Pre-Check: ${submission.precheck_status} | Fisik: ${submission.physical_status} | PIC: ${submission.verification_status} | Akuntansi: ${submission.validation_status}`,
    ],
    [
      "Dikirim ke Keuangan Pada",
      sanitizePdfText(formatDateTimeWIB(sentToFinanceAt ?? issuedAt)),
    ],
  ];

  if (notes?.trim()) {
    sppDetailRows.push(["Catatan SPP", sanitizePdfText(notes)]);
  }

  for (let i = 0; i < sppDetailRows.length; i++) {
    const [label, value, isBold] = sppDetailRows[i];
    const wrapped = wrapTextLines(value, isBold ? fontBold : fontRegular, 9, contentWidth - 170);
    const rowHeight = Math.max(20, wrapped.length * 12 + 8);
    cursorY -= rowHeight;

    page.drawRectangle({
      x: marginX,
      y: cursorY,
      width: contentWidth,
      height: rowHeight,
      color: i % 2 === 0 ? COLOR_BG_LIGHT : rgb(1, 1, 1),
      borderColor: COLOR_BORDER,
      borderWidth: 0.6,
    });

    page.drawText(label, {
      x: marginX + 10,
      y: cursorY + rowHeight - 13,
      size: 8.5,
      font: fontBold,
      color: COLOR_MUTED,
    });

    for (let lineIdx = 0; lineIdx < wrapped.length; lineIdx++) {
      page.drawText(wrapped[lineIdx], {
        x: marginX + 160,
        y: cursorY + rowHeight - 13 - lineIdx * 12,
        size: 9,
        font: isBold ? fontBold : fontRegular,
        color: label.includes("Nilai Tagihan") ? COLOR_PRIMARY : COLOR_DARK,
      });
    }
  }

  cursorY -= 24;

  // PANEL OTORISASI & PEJABAT PENYETUJU DIGITAL
  page.drawText("OTORISASI & PERSETUJUAN ELEKTRONIK LINTAS FUNGSI", {
    x: marginX,
    y: cursorY,
    size: 9.5,
    font: fontBold,
    color: COLOR_PRIMARY,
  });

  cursorY -= 10;
  const colW = (contentWidth - 16) / 3;
  const cardH = 82;
  cursorY -= cardH;

  const signers = [
    {
      title: "1. Disetujui Substansi Oleh",
      roleLabel: ROLE_LABELS.pic_usaha,
      name: approvedPicProfile?.full_name ?? "Pejabat PIC Usaha",
      badge: "APPROVED (PIC USAHA)",
    },
    {
      title: "2. Divalidasi Pajak & Akuntansi",
      roleLabel: ROLE_LABELS.akuntansi,
      name: approvedAccProfile?.full_name ?? "Pejabat Akuntansi",
      badge: "VALIDATED (LULUS)",
    },
    {
      title: "3. Disusun & Diterbitkan Oleh",
      roleLabel: createdByProfile?.role
        ? ROLE_LABELS[createdByProfile.role]
        : ROLE_LABELS.divisi_usaha,
      name: createdByProfile?.full_name ?? "Pejabat Divisi Usaha",
      badge: "SPP ISSUED",
    },
  ];

  signers.forEach((signer, idx) => {
    const boxX = marginX + idx * (colW + 8);
    page.drawRectangle({
      x: boxX,
      y: cursorY,
      width: colW,
      height: cardH,
      color: COLOR_BG_LIGHT,
      borderColor: COLOR_BORDER,
      borderWidth: 0.8,
    });

    page.drawText(signer.title, {
      x: boxX + 8,
      y: cursorY + cardH - 14,
      size: 7.5,
      font: fontBold,
      color: COLOR_MUTED,
    });

    page.drawRectangle({
      x: boxX + 8,
      y: cursorY + 34,
      width: colW - 16,
      height: 18,
      color: rgb(0.9, 0.97, 0.93),
      borderColor: COLOR_SUCCESS,
      borderWidth: 0.6,
    });

    page.drawText(signer.badge, {
      x: boxX + 14,
      y: cursorY + 40,
      size: 7.5,
      font: fontBold,
      color: COLOR_SUCCESS,
    });

    page.drawText(sanitizePdfText(signer.name).slice(0, 26), {
      x: boxX + 8,
      y: cursorY + 18,
      size: 8.5,
      font: fontBold,
      color: COLOR_DARK,
    });

    page.drawText(sanitizePdfText(signer.roleLabel), {
      x: boxX + 8,
      y: cursorY + 7,
      size: 7.5,
      font: fontRegular,
      color: COLOR_MUTED,
    });
  });

  // FOOTER QR CODE VERIFIKASI PUBLIK TERBATAS
  const qrSize = 86;
  const footerY = 38;
  drawVectorQrCode(page, qrVerificationUrl, marginX, footerY, qrSize);

  page.drawText("QR CODE VERIFIKASI KEASLIAN SPP (PUBLIK TERBATAS)", {
    x: marginX + qrSize + 16,
    y: footerY + qrSize - 13,
    size: 9.5,
    font: fontBold,
    color: COLOR_PRIMARY,
  });

  page.drawText(
    "Surat Pengajuan Pembayaran (SPP) ini sah dan diterbitkan secara digital melalui sistem Accelera HUB.",
    {
      x: marginX + qrSize + 16,
      y: footerY + qrSize - 27,
      size: 8,
      font: fontRegular,
      color: COLOR_DARK,
    }
  );

  page.drawText(
    "Pindai QR Code atau kunjungi tautan di bawah untuk memverifikasi keaslian Nomor SPP, Nomor Agenda,",
    {
      x: marginX + qrSize + 16,
      y: footerY + qrSize - 39,
      size: 8,
      font: fontRegular,
      color: COLOR_MUTED,
    }
  );

  page.drawText(
    "Nama Mitra, dan Tanggal Terbit di halaman verifikasi resmi Accelera HUB.",
    {
      x: marginX + qrSize + 16,
      y: footerY + qrSize - 50,
      size: 8,
      font: fontRegular,
      color: COLOR_MUTED,
    }
  );

  page.drawText(`Token QR: ${sanitizePdfText(qrToken)}`, {
    x: marginX + qrSize + 16,
    y: footerY + qrSize - 64,
    size: 7.8,
    font: fontBold,
    color: COLOR_DARK,
  });

  page.drawText(`Endpoint Verifikasi: ${sanitizePdfText(qrVerificationUrl)}`, {
    x: marginX + qrSize + 16,
    y: footerY + qrSize - 76,
    size: 7.2,
    font: fontRegular,
    color: COLOR_PRIMARY,
  });

  return pdfDoc.save();
}

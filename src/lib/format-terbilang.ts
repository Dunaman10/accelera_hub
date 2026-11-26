/**
 * Utility Konversi Nominal Angka ke Teks Terbilang Rupiah Bahasa Indonesia
 * -------------------------------------------------------------------------
 * Contoh:
 * - formatTerbilang(125500000) -> "Seratus Dua Puluh Lima Juta Lima Ratus Ribu"
 * - formatTerbilangRupiah(125500000) -> "Seratus Dua Puluh Lima Juta Lima Ratus Ribu Rupiah"
 */

const UNITS = [
  "",
  "Satu",
  "Dua",
  "Tiga",
  "Empat",
  "Lima",
  "Enam",
  "Tujuh",
  "Delapan",
  "Sembilan",
  "Sepuluh",
  "Sebelas",
] as const;

function convertIntegerToIndonesianWords(n: number): string {
  const num = Math.floor(Math.abs(n));
  if (num === 0) return "";

  if (num < 12) {
    return UNITS[num];
  }

  if (num < 20) {
    return `${convertIntegerToIndonesianWords(num - 10)} Belas`.trim();
  }

  if (num < 100) {
    const tens = Math.floor(num / 10);
    const remainder = num % 10;
    return `${convertIntegerToIndonesianWords(tens)} Puluh ${convertIntegerToIndonesianWords(
      remainder
    )}`.trim();
  }

  if (num < 200) {
    return `Seratus ${convertIntegerToIndonesianWords(num - 100)}`.trim();
  }

  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    return `${convertIntegerToIndonesianWords(hundreds)} Ratus ${convertIntegerToIndonesianWords(
      remainder
    )}`.trim();
  }

  if (num < 2000) {
    return `Seribu ${convertIntegerToIndonesianWords(num - 1000)}`.trim();
  }

  if (num < 1_000_000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    return `${convertIntegerToIndonesianWords(thousands)} Ribu ${convertIntegerToIndonesianWords(
      remainder
    )}`.trim();
  }

  if (num < 1_000_000_000) {
    const millions = Math.floor(num / 1_000_000);
    const remainder = num % 1_000_000;
    return `${convertIntegerToIndonesianWords(millions)} Juta ${convertIntegerToIndonesianWords(
      remainder
    )}`.trim();
  }

  if (num < 1_000_000_000_000) {
    const billions = Math.floor(num / 1_000_000_000);
    const remainder = num % 1_000_000_000;
    return `${convertIntegerToIndonesianWords(billions)} Miliar ${convertIntegerToIndonesianWords(
      remainder
    )}`.trim();
  }

  if (num < 1_000_000_000_000_000) {
    const trillions = Math.floor(num / 1_000_000_000_000);
    const remainder = num % 1_000_000_000_000;
    return `${convertIntegerToIndonesianWords(trillions)} Triliun ${convertIntegerToIndonesianWords(
      remainder
    )}`.trim();
  }

  return String(num);
}

/**
 * Mengonversi angka nominal menjadi kata terbilang Bahasa Indonesia (tanpa suffix "Rupiah").
 */
export function formatTerbilang(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) {
    return "Nol";
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const integerPart = Math.floor(absAmount);
  const decimalCents = Math.round((absAmount - integerPart) * 100);

  let words =
    integerPart === 0 ? "Nol" : convertIntegerToIndonesianWords(integerPart);

  if (decimalCents > 0) {
    words = `${words} Koma ${convertIntegerToIndonesianWords(decimalCents)}`;
  }

  if (isNegative) {
    words = `Minus ${words}`;
  }

  return words.replace(/\s+/g, " ").trim();
}

/**
 * Mengonversi angka nominal menjadi teks Terbilang lengkap dengan akhiran "Rupiah".
 */
export function formatTerbilangRupiah(amount: number): string {
  return `${formatTerbilang(amount)} Rupiah`;
}

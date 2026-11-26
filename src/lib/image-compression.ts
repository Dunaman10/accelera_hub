/**
 * Utilitas Kompresi Gambar di Sisi Client (Canvas HTML5)
 * ----------------------------------------------------------------------------
 * Mengompresi file gambar (`.jpg`, `.jpeg`, `.png`) yang berukuran > 1 MB
 * menggunakan `<canvas>` agar ukuran file turun drastis dan hemat kuota
 * penyimpanan Google Drive 15 GB.
 */

const COMPRESSION_THRESHOLD_BYTES = 1 * 1024 * 1024; // 1 MB
const MAX_IMAGE_DIMENSION = 1920; // Resolusi maksimal dokumen agar teks tetap tajam

export interface CompressionResult {
  file: File;
  wasCompressed: boolean;
  originalSizeBytes: number;
  finalSizeBytes: number;
}

export async function compressImageIfNeeded(
  inputFile: File
): Promise<CompressionResult> {
  const originalSize = inputFile.size;
  const mime = inputFile.type.toLowerCase();
  const isImage =
    mime === "image/jpeg" || mime === "image/jpg" || mime === "image/png";

  if (!isImage || originalSize <= COMPRESSION_THRESHOLD_BYTES) {
    return {
      file: inputFile,
      wasCompressed: false,
      originalSizeBytes: originalSize,
      finalSizeBytes: originalSize,
    };
  }

  try {
    const bitmap = await loadImageElement(inputFile);
    let targetWidth = bitmap.width;
    let targetHeight = bitmap.height;

    if (
      targetWidth > MAX_IMAGE_DIMENSION ||
      targetHeight > MAX_IMAGE_DIMENSION
    ) {
      const ratio = Math.min(
        MAX_IMAGE_DIMENSION / targetWidth,
        MAX_IMAGE_DIMENSION / targetHeight
      );
      targetWidth = Math.round(targetWidth * ratio);
      targetHeight = Math.round(targetHeight * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return {
        file: inputFile,
        wasCompressed: false,
        originalSizeBytes: originalSize,
        finalSizeBytes: originalSize,
      };
    }

    // Latar belakang putih agar PNG transparan tetap terbaca jelas jika dikonversi ke JPEG
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    // Gunakan image/jpeg dengan kualitas bertingkat agar hasil kompresi optimal (< 1 MB)
    const qualities = [0.8, 0.68, 0.55];
    let bestBlob: Blob | null = null;

    for (const q of qualities) {
      const blob = await canvasToBlob(canvas, "image/jpeg", q);
      if (blob) {
        bestBlob = blob;
        if (blob.size <= COMPRESSION_THRESHOLD_BYTES) {
          break;
        }
      }
    }

    if (!bestBlob || bestBlob.size >= originalSize) {
      return {
        file: inputFile,
        wasCompressed: false,
        originalSizeBytes: originalSize,
        finalSizeBytes: originalSize,
      };
    }

    const baseName = inputFile.name.replace(/\.(png|jpg|jpeg)$/i, "");
    const compressedFile = new File([bestBlob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });

    return {
      file: compressedFile,
      wasCompressed: true,
      originalSizeBytes: originalSize,
      finalSizeBytes: compressedFile.size,
    };
  } catch {
    return {
      file: inputFile,
      wasCompressed: false,
      originalSizeBytes: originalSize,
      finalSizeBytes: originalSize,
    };
  }
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Mengunggah file biner langsung (`PUT`) ke Google Drive Resumable Upload URL
 * menggunakan XMLHttpRequest untuk memberikan pelaporan progress real-time (0-100%)
 * dan mengembalikan `drive_file_id` dari respons Google Drive.
 */
export function uploadFileToGoogleDriveResumable(params: {
  uploadUrl: string;
  file: File;
  onProgress?: (percent: number) => void;
}): Promise<{ id: string; name?: string; mimeType?: string }> {
  const { uploadUrl, file, onProgress } = params;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader(
      "Content-Type",
      file.type || "application/octet-stream"
    );

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const pct = Math.min(
            99,
            Math.round((event.loaded / event.total) * 100)
          );
          onProgress(pct);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        try {
          const parsed = JSON.parse(xhr.responseText) as {
            id?: string;
            name?: string;
            mimeType?: string;
          };
          if (!parsed.id) {
            reject(
              new Error(
                "Respons Google Drive tidak menyertakan file.id setelah upload."
              )
            );
            return;
          }
          resolve({
            id: parsed.id,
            name: parsed.name,
            mimeType: parsed.mimeType,
          });
        } catch {
          reject(
            new Error("Gagal membaca respons JSON dari server Google Drive.")
          );
        }
      } else {
        reject(
          new Error(
            `Google Drive Resumable Upload gagal (HTTP ${xhr.status}): ${
              xhr.responseText || xhr.statusText
            }`
          )
        );
      }
    };

    xhr.onerror = () => {
      reject(
        new Error(
          "Koneksi jaringan terputus saat mengunggah biner ke Google Drive."
        )
      );
    };

    xhr.send(file);
  });
}

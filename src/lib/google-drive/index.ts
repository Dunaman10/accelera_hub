/**
 * Google Drive REST API v3 Pure `fetch()` Utility
 * ----------------------------------------------------------------------------
 * Hard Constraints (Accelera HUB):
 * 1. TANPA package `googleapis` (kompatibel Edge / Cloudflare Workers < 3 MB).
 * 2. Semua file bersifat PRIVATE (dilarang set permission `anyone`).
 * 3. Upload biner langsung dari klien via Resumable Upload Session (`uploadUrl`).
 */

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3";
const GOOGLE_DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const DRIVE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";
const DEFAULT_GMAIL_QUOTA_BYTES = 15 * 1024 * 1024 * 1024; // 15 GB
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 menit sebelum expired

const INDONESIAN_MONTH_LABELS = [
  "01 - Januari",
  "02 - Februari",
  "03 - Maret",
  "04 - April",
  "05 - Mei",
  "06 - Juni",
  "07 - Juli",
  "08 - Agustus",
  "09 - September",
  "10 - Oktober",
  "11 - November",
  "12 - Desember",
] as const;

interface CachedTokenState {
  accessToken: string;
  expiresAtMs: number;
}

interface GoogleOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

interface DriveFileListResponse {
  files?: Array<{
    id: string;
    name: string;
    mimeType: string;
  }>;
}

export interface DriveFileMetadata {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  createdTime?: string;
  modifiedTime?: string;
}

export interface CreateResumableUploadParams {
  fileName: string;
  mimeType: string;
  folderId: string;
  fileSizeBytes?: number;
  origin?: string;
  description?: string;
}

export interface ResumableUploadSession {
  uploadUrl: string;
  folderId: string;
  fileName: string;
  mimeType: string;
}

export interface SubmissionFolderHierarchyParams {
  agendaNo: string;
  vendorName: string;
  referenceDate?: Date | string;
  rootFolderId?: string;
}

export interface SubmissionFolderHierarchyResult {
  yearFolderId: string;
  monthFolderId: string;
  submissionFolderId: string;
  folderPath: string;
}

export interface DriveFileStreamResult {
  stream: ReadableStream<Uint8Array>;
  status: number;
  contentType: string;
  contentLength: string | null;
  contentRange: string | null;
  acceptRanges: string | null;
}

export interface DriveStorageQuota {
  limitBytes: number;
  usageBytes: number;
  usageInDriveBytes: number;
  usageInTrashBytes: number;
  remainingBytes: number;
  usagePercent: number;
  isWarning: boolean;
  isCritical: boolean;
  userEmail: string | null;
}

let cachedToken: CachedTokenState | null = null;
let inflightTokenPromise: Promise<string> | null = null;

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Check your .env.local or Cloudflare secrets.`
    );
  }
  return value;
}

function escapeDriveQueryLiteral(input: string): string {
  return input.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function sanitizeFolderSegment(segment: string): string {
  // Ganti garis miring (misal AGP/SSS/...) menjadi tanda hubung agar nama folder rapi dan tidak terpecah
  return segment
    .replace(/[\/\\]+/g, "-")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

/**
 * Menukar `GOOGLE_REFRESH_TOKEN` menjadi `access_token` dengan in-memory caching
 * (buffer aman 5 menit sebelum waktu kedaluwarsa).
 */
export async function getDriveAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAtMs - TOKEN_EXPIRY_BUFFER_MS > now) {
    return cachedToken.accessToken;
  }

  if (inflightTokenPromise) {
    return inflightTokenPromise;
  }

  inflightTokenPromise = (async () => {
    try {
      const clientId = getRequiredEnv("GOOGLE_CLIENT_ID");
      const clientSecret = getRequiredEnv("GOOGLE_CLIENT_SECRET");
      const refreshToken = getRequiredEnv("GOOGLE_REFRESH_TOKEN");

      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      });

      const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `Failed to refresh Google Drive access token (${response.status}): ${errorBody}`
        );
      }

      const data = (await response.json()) as GoogleOAuthTokenResponse;
      if (!data.access_token) {
        throw new Error("Google OAuth response did not include access_token.");
      }

      const expiresInMs = (data.expires_in ?? 3600) * 1000;
      cachedToken = {
        accessToken: data.access_token,
        expiresAtMs: Date.now() + expiresInMs,
      };

      return data.access_token;
    } finally {
      inflightTokenPromise = null;
    }
  })();

  return inflightTokenPromise;
}

/**
 * Mencari atau membuat folder di dalam `parentId` (default `GOOGLE_ROOT_FOLDER_ID`).
 * Mendukung nama tunggal maupun path bertingkat yang dipisahkan `" / "` bila diperlukan,
 * namun untuk nomor agenda seperti `AGP/SSS/...` gunakan `ensureSubmissionDriveFolder()`
 * agar garis miring pada nomor agenda otomatis disanitasi menjadi `-`.
 */
export async function findOrCreateFolder(
  name: string,
  parentId?: string
): Promise<string> {
  const targetParentId = parentId?.trim() || getRequiredEnv("GOOGLE_ROOT_FOLDER_ID");
  const cleanName = sanitizeFolderSegment(name);
  if (!cleanName) {
    throw new Error("Folder name must not be empty.");
  }

  const accessToken = await getDriveAccessToken();
  const escapedName = escapeDriveQueryLiteral(cleanName);
  const escapedParent = escapeDriveQueryLiteral(targetParentId);

  const query = [
    `name = '${escapedName}'`,
    `mimeType = '${DRIVE_FOLDER_MIME_TYPE}'`,
    `'${escapedParent}' in parents`,
    "trashed = false",
  ].join(" and ");

  const searchUrl = new URL(`${GOOGLE_DRIVE_API_BASE}/files`);
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("fields", "files(id, name, mimeType)");
  searchUrl.searchParams.set("pageSize", "1");
  searchUrl.searchParams.set("spaces", "drive");

  const searchResponse = await fetch(searchUrl.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    throw new Error(
      `Failed searching Google Drive folder "${cleanName}" (${searchResponse.status}): ${errorText}`
    );
  }

  const searchResult = (await searchResponse.json()) as DriveFileListResponse;
  if (searchResult.files && searchResult.files.length > 0) {
    return searchResult.files[0].id;
  }

  const createResponse = await fetch(
    `${GOOGLE_DRIVE_API_BASE}/files?fields=id,name`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        name: cleanName,
        mimeType: DRIVE_FOLDER_MIME_TYPE,
        parents: [targetParentId],
      }),
      cache: "no-store",
    }
  );

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(
      `Failed creating Google Drive folder "${cleanName}" (${createResponse.status}): ${errorText}`
    );
  }

  const created = (await createResponse.json()) as { id: string; name: string };
  return created.id;
}

/**
 * Otomatis membentuk hierarki folder `Tahun / Bulan / NoAgenda - NamaMitra`
 * di dalam `GOOGLE_ROOT_FOLDER_ID` dan mengembalikan ID folder pengajuan.
 */
export async function ensureSubmissionDriveFolder({
  agendaNo,
  vendorName,
  referenceDate,
  rootFolderId,
}: SubmissionFolderHierarchyParams): Promise<SubmissionFolderHierarchyResult> {
  const rootId = rootFolderId?.trim() || getRequiredEnv("GOOGLE_ROOT_FOLDER_ID");
  const dateObj = referenceDate ? new Date(referenceDate) : new Date();

  // Konversi tahun & bulan menggunakan zona waktu Asia/Jakarta (WIB)
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(dateObj);
  const yearLabel =
    parts.find((p) => p.type === "year")?.value ??
    String(dateObj.getUTCFullYear());
  const monthIndex =
    Number(parts.find((p) => p.type === "month")?.value ?? "1") - 1;
  const monthLabel =
    INDONESIAN_MONTH_LABELS[Math.max(0, Math.min(11, monthIndex))];

  const safeAgenda = sanitizeFolderSegment(agendaNo);
  const safeVendor = sanitizeFolderSegment(vendorName);
  const submissionFolderName = `${safeAgenda} - ${safeVendor}`;

  const yearFolderId = await findOrCreateFolder(yearLabel, rootId);
  const monthFolderId = await findOrCreateFolder(monthLabel, yearFolderId);
  const submissionFolderId = await findOrCreateFolder(
    submissionFolderName,
    monthFolderId
  );

  return {
    yearFolderId,
    monthFolderId,
    submissionFolderId,
    folderPath: `${yearLabel} / ${monthLabel} / ${submissionFolderName}`,
  };
}

/**
 * Membuat sesi Google Drive Resumable Upload (`uploadType=resumable`) agar browser/APK
 * mengunggah biner langsung ke server Google tanpa membebani payload Cloudflare Worker.
 */
export async function createResumableUploadSession({
  fileName,
  mimeType,
  folderId,
  fileSizeBytes,
  origin,
  description,
}: CreateResumableUploadParams): Promise<ResumableUploadSession> {
  const accessToken = await getDriveAccessToken();
  const cleanFileName = sanitizeFolderSegment(fileName);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json; charset=UTF-8",
    "X-Upload-Content-Type": mimeType || "application/octet-stream",
  };

  if (typeof fileSizeBytes === "number" && fileSizeBytes >= 0) {
    headers["X-Upload-Content-Length"] = String(fileSizeBytes);
  }

  if (origin) {
    headers["Origin"] = origin;
  }

  const response = await fetch(
    `${GOOGLE_DRIVE_UPLOAD_BASE}/files?uploadType=resumable&fields=id,name,mimeType,size`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: cleanFileName,
        parents: [folderId],
        ...(description ? { description } : {}),
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed initiating Google Drive resumable upload (${response.status}): ${errorText}`
    );
  }

  const uploadUrl = response.headers.get("Location");
  if (!uploadUrl) {
    throw new Error(
      "Google Drive resumable upload did not return a Location header."
    );
  }

  return {
    uploadUrl,
    folderId,
    fileName: cleanFileName,
    mimeType: mimeType || "application/octet-stream",
  };
}

export interface UploadBinaryToDriveParams {
  fileName: string;
  mimeType: string;
  folderId: string;
  bytes: Uint8Array;
  description?: string;
}

/**
 * Mengunggah biner (misal PDF SPP resmi hasil generator `pdf-lib`) secara langsung
 * dari server ke folder Google Drive pengajuan (`drive_folder_id`) melalui
 * Resumable Upload REST API (`fetch` murni, kompatibel Cloudflare Workers).
 */
export async function uploadBinaryFileToDrive({
  fileName,
  mimeType,
  folderId,
  bytes,
  description,
}: UploadBinaryToDriveParams): Promise<DriveFileMetadata> {
  const session = await createResumableUploadSession({
    fileName,
    mimeType,
    folderId,
    fileSizeBytes: bytes.byteLength,
    description,
  });

  const payload = new Uint8Array(bytes.byteLength);
  payload.set(bytes);

  const putResponse = await fetch(session.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": session.mimeType,
      "Content-Length": String(payload.byteLength),
    },
    body: payload.buffer,
    cache: "no-store",
  });

  if (!putResponse.ok) {
    const errorText = await putResponse.text();
    throw new Error(
      `Failed uploading binary file "${session.fileName}" to Google Drive (${putResponse.status}): ${errorText}`
    );
  }

  const uploaded = (await putResponse.json()) as {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    createdTime?: string;
    modifiedTime?: string;
  };

  return {
    id: uploaded.id,
    name: uploaded.name,
    mimeType: uploaded.mimeType,
    size: uploaded.size ? Number(uploaded.size) : payload.byteLength,
    createdTime: uploaded.createdTime,
    modifiedTime: uploaded.modifiedTime,
  };
}

/**
 * Mengambil metadata file private dari Google Drive berdasarkan `fileId`.
 */
export async function getDriveFileMetadata(
  fileId: string
): Promise<DriveFileMetadata> {
  const accessToken = await getDriveAccessToken();
  const encodedId = encodeURIComponent(fileId);
  const response = await fetch(
    `${GOOGLE_DRIVE_API_BASE}/files/${encodedId}?fields=id,name,mimeType,size,createdTime,modifiedTime`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed fetching Google Drive file metadata (${response.status}): ${errorText}`
    );
  }

  const raw = (await response.json()) as {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    createdTime?: string;
    modifiedTime?: string;
  };

  return {
    id: raw.id,
    name: raw.name,
    mimeType: raw.mimeType,
    size: raw.size ? Number(raw.size) : null,
    createdTime: raw.createdTime,
    modifiedTime: raw.modifiedTime,
  };
}

/**
 * Mengambil ReadableStream biner file private dari Google Drive untuk di-proxy lewat
 * endpoint terautentikasi (`/api/documents/[fileId]/view`), mendukung HTTP `Range`.
 */
export async function getDriveFileStream(
  fileId: string,
  rangeHeader?: string | null
): Promise<DriveFileStreamResult> {
  const accessToken = await getDriveAccessToken();
  const encodedId = encodeURIComponent(fileId);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (rangeHeader) {
    headers["Range"] = rangeHeader;
  }

  const response = await fetch(
    `${GOOGLE_DRIVE_API_BASE}/files/${encodedId}?alt=media`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  );

  if (!response.ok && response.status !== 206) {
    const errorText = await response.text();
    throw new Error(
      `Failed streaming Google Drive file "${fileId}" (${response.status}): ${errorText}`
    );
  }

  if (!response.body) {
    throw new Error(`Google Drive returned an empty body for file "${fileId}".`);
  }

  return {
    stream: response.body,
    status: response.status,
    contentType:
      response.headers.get("Content-Type") ?? "application/octet-stream",
    contentLength: response.headers.get("Content-Length"),
    contentRange: response.headers.get("Content-Range"),
    acceptRanges: response.headers.get("Accept-Ranges"),
  };
}

/**
 * Mengecek pemakaian kuota penyimpanan Google Drive (monitoring kuota akun 15 GB).
 */
export async function getDriveStorageQuota(): Promise<DriveStorageQuota> {
  const accessToken = await getDriveAccessToken();

  const response = await fetch(
    `${GOOGLE_DRIVE_API_BASE}/about?fields=storageQuota,user(emailAddress)`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed fetching Google Drive storage quota (${response.status}): ${errorText}`
    );
  }

  const data = (await response.json()) as {
    storageQuota?: {
      limit?: string;
      usage?: string;
      usageInDrive?: string;
      usageInDriveTrash?: string;
    };
    user?: {
      emailAddress?: string;
    };
  };

  const limitBytes = data.storageQuota?.limit
    ? Number(data.storageQuota.limit)
    : DEFAULT_GMAIL_QUOTA_BYTES;
  const usageBytes = Number(data.storageQuota?.usage ?? "0");
  const usageInDriveBytes = Number(data.storageQuota?.usageInDrive ?? "0");
  const usageInTrashBytes = Number(data.storageQuota?.usageInDriveTrash ?? "0");
  const remainingBytes = Math.max(0, limitBytes - usageBytes);
  const usagePercent =
    limitBytes > 0
      ? Number(((usageBytes / limitBytes) * 100).toFixed(2))
      : 0;

  return {
    limitBytes,
    usageBytes,
    usageInDriveBytes,
    usageInTrashBytes,
    remainingBytes,
    usagePercent,
    isWarning: usagePercent >= 80,
    isCritical: usagePercent >= 95,
    userEmail: data.user?.emailAddress ?? null,
  };
}

/**
 * Upload safety checks, used wherever a visitor or staff member sends a file. The file's type is
 * decided from its first bytes, never from its name or the type the browser claims.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 3;

export type AllowedType = { mime: string; extension: string };

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) => signature.every((b, i) => bytes[offset + i] === b);

/** Returns the real type for PNG, JPEG, WebP and PDF files, or null for anything else (including SVG and scripts). */
export function detectType(bytes: Uint8Array): AllowedType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", extension: "png" };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", extension: "jpg" };
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return { mime: "image/webp", extension: "webp" };
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: "application/pdf", extension: "pdf" };
  return null;
}

/** A name that is safe in a storage path: letters, digits, dots, dashes and underscores only. */
export function safeFileName(name: string): string {
  const base = name.replace(/\.[^.]*$/, "").normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return base || "file";
}

export type FileCheck = { ok: true; type: AllowedType; name: string } | { ok: false; reason: string };

export function checkFile(file: { name: string; size: number }, bytes: Uint8Array): FileCheck {
  if (file.size <= 0) return { ok: false, reason: `${file.name} is empty.` };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, reason: `${file.name} is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` };
  const type = detectType(bytes);
  if (!type) return { ok: false, reason: `${file.name} is not a PNG, JPEG, WebP or PDF file.` };
  return { ok: true, type, name: `${safeFileName(file.name)}.${type.extension}` };
}

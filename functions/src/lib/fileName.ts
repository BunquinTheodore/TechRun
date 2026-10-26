// Download file names (pure). The camera file name comes from client metadata, so it is untrusted text.

const MAX_NAME_CHARS = 120;

/** Cleans an uploaded file name: no path parts, no control or quote characters, bounded length. null when empty. */
export function sanitizeFileName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const base = value.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f"<>|:*?;]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (cleaned === "") return null;
  if (cleaned.length <= MAX_NAME_CHARS) return cleaned;
  const dot = cleaned.lastIndexOf(".");
  const ext = dot > 0 && cleaned.length - dot <= 6 ? cleaned.slice(dot) : "";
  return cleaned.slice(0, MAX_NAME_CHARS - ext.length) + ext;
}

/**
 * File name for one download: the original name when known (with the stored extension), otherwise
 * techrun-2027-{photoId}.{ext}. Names already used in the same order get " (2)", " (3)" before the extension.
 */
export function downloadFileName(originalName: string | null | undefined, photoId: string, ext: string, used: Set<string>): string {
  const safeExt = /^[a-z0-9]{1,8}$/.test(ext) ? ext : "jpg";
  const clean = sanitizeFileName(originalName);
  let stem = `techrun-2027-${photoId}`;
  if (clean) {
    const dot = clean.lastIndexOf(".");
    stem = dot > 0 ? clean.slice(0, dot) : clean;
  }
  let name = `${stem}.${safeExt}`;
  for (let n = 2; used.has(name.toLowerCase()); n += 1) name = `${stem} (${n}).${safeExt}`;
  used.add(name.toLowerCase());
  return name;
}

/** Content-Disposition value with an ASCII fallback and the UTF-8 name (RFC 6266). */
export function attachmentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

// Minimal pure EXIF reader: capture time only (DateTimeOriginal, with OffsetTimeOriginal when present).
// sharp's metadata().exif gives the raw block; no extra dependency needed for one tag.

/** Offset assumed for camera clocks that record no time zone. TechRun runs in the Philippines (UTC+8). */
export const DEFAULT_CAMERA_UTC_OFFSET = "+08:00";

const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;
const TAG_OFFSET_TIME_ORIGINAL = 0x9011;
const TYPE_ASCII = 2;
const TYPE_LONG = 4;
const TYPE_IFD = 13;
const MAX_IFD_ENTRIES = 512;

interface Reader {
  buf: Buffer;
  le: boolean;
  base: number;
}

function u16(r: Reader, at: number): number {
  return r.le ? r.buf.readUInt16LE(at) : r.buf.readUInt16BE(at);
}
function u32(r: Reader, at: number): number {
  return r.le ? r.buf.readUInt32LE(at) : r.buf.readUInt32BE(at);
}

type IfdEntries = Map<number, { type: number; count: number; valueAt: number; inlineAt: number }>;

function readIfd(r: Reader, offset: number): IfdEntries {
  const out: IfdEntries = new Map();
  const at = r.base + offset;
  if (at + 2 > r.buf.length) return out;
  const n = Math.min(u16(r, at), MAX_IFD_ENTRIES);
  for (let i = 0; i < n; i += 1) {
    const e = at + 2 + i * 12;
    if (e + 12 > r.buf.length) break;
    const type = u16(r, e + 2);
    const count = u32(r, e + 4);
    // Values over 4 bytes live at an offset; ASCII of 4 bytes or fewer sits inline.
    const valueAt = type === TYPE_ASCII && count <= 4 ? e + 8 : r.base + u32(r, e + 8);
    out.set(u16(r, e), { type, count, valueAt, inlineAt: e + 8 });
  }
  return out;
}

function readAscii(r: Reader, entries: IfdEntries, tag: number): string | null {
  const e = entries.get(tag);
  if (!e || e.type !== TYPE_ASCII || e.count === 0) return null;
  const end = e.valueAt + e.count;
  if (e.valueAt < 0 || end > r.buf.length) return null;
  return r.buf.toString("latin1", e.valueAt, end).replace(/\0+$/, "").trim() || null;
}

/** "2027:03:14 06:30:05" plus optional "+08:00" to a Date; null when malformed or zeroed. */
export function parseExifDate(value: string | null, offset: string | null = null): Date | null {
  if (!value) return null;
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  if (y === "0000" || mo === "00" || d === "00") return null;
  if (Number(mo) > 12 || Number(d) > 31 || Number(h) > 23 || Number(mi) > 59 || Number(s) > 59) return null;
  const tz = offset && /^[+-]\d{2}:\d{2}$/.test(offset.trim()) ? offset.trim() : DEFAULT_CAMERA_UTC_OFFSET;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${tz}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Capture time from a raw EXIF block (with or without the "Exif\0\0" header). Never throws. */
export function readCaptureTime(exif: Buffer | undefined | null): Date | null {
  if (!exif || exif.length < 8) return null;
  try {
    const base = exif.subarray(0, 6).toString("latin1") === "Exif\0\0" ? 6 : 0;
    const order = exif.subarray(base, base + 2).toString("latin1");
    if (order !== "II" && order !== "MM") return null;
    const r: Reader = { buf: exif, le: order === "II", base };
    if (u16(r, base + 2) !== 42) return null;
    const ifd0 = readIfd(r, u32(r, base + 4));
    const exifPtr = ifd0.get(TAG_EXIF_IFD);
    const exifIfd: IfdEntries =
      exifPtr && (exifPtr.type === TYPE_LONG || exifPtr.type === TYPE_IFD) ? readIfd(r, u32(r, exifPtr.inlineAt)) : new Map();
    const offset = readAscii(r, exifIfd, TAG_OFFSET_TIME_ORIGINAL);
    return (
      parseExifDate(readAscii(r, exifIfd, TAG_DATETIME_ORIGINAL), offset) ??
      parseExifDate(readAscii(r, exifIfd, TAG_DATETIME_DIGITIZED), offset) ??
      parseExifDate(readAscii(r, ifd0, TAG_DATETIME), null)
    );
  } catch {
    return null;
  }
}

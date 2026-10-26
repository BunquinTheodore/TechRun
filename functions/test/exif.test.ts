import { describe, expect, it } from "vitest";
import { parseExifDate, readCaptureTime } from "../src/pipeline/exif";

interface AsciiTag {
  tag: number;
  value: string;
}

/** Builds a little or big endian TIFF/EXIF block with IFD0 (optional DateTime) and an Exif IFD. */
function buildExif(opts: { le?: boolean; header?: boolean; ifd0?: AsciiTag[]; exif?: AsciiTag[] }): Buffer {
  const le = opts.le ?? true;
  const ifd0Tags = opts.ifd0 ?? [];
  const exifTags = opts.exif ?? [];
  const parts: number[] = [];
  const w16 = (n: number) => (le ? parts.push(n & 0xff, n >> 8) : parts.push(n >> 8, n & 0xff));
  const w32 = (n: number) =>
    le
      ? parts.push(n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, n >>> 24)
      : parts.push(n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);

  const ifdSize = (n: number) => 2 + n * 12 + 4;
  const ifd0Count = ifd0Tags.length + 1;
  const ifd0At = 8;
  const exifAt = ifd0At + ifdSize(ifd0Count);
  let dataAt = exifAt + ifdSize(exifTags.length);
  const data: { at: number; bytes: number[] }[] = [];
  const entry = (t: AsciiTag) => {
    const bytes = [...Buffer.from(`${t.value}\0`, "latin1")];
    w16(t.tag);
    w16(2);
    w32(bytes.length);
    if (bytes.length <= 4) {
      for (let i = 0; i < 4; i += 1) parts.push(bytes[i] ?? 0);
    } else {
      w32(dataAt);
      data.push({ at: dataAt, bytes });
      dataAt += bytes.length;
    }
  };

  parts.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]));
  w16(42);
  w32(ifd0At);
  w16(ifd0Count);
  ifd0Tags.forEach(entry);
  w16(0x8769);
  w16(4);
  w32(1);
  w32(exifAt);
  w32(0);
  w16(exifTags.length);
  exifTags.forEach(entry);
  w32(0);
  for (const d of data) parts.push(...d.bytes);
  const tiff = Buffer.from(parts);
  return opts.header === false ? tiff : Buffer.concat([Buffer.from("Exif\0\0", "latin1"), tiff]);
}

describe("parseExifDate", () => {
  it("parses an EXIF date assuming Philippine time when no offset is given", () => {
    expect(parseExifDate("2027:03:14 06:30:05")?.toISOString()).toBe("2027-03-13T22:30:05.000Z");
  });

  it("uses the given offset", () => {
    expect(parseExifDate("2027:03:14 06:30:05", "+00:00")?.toISOString()).toBe("2027-03-14T06:30:05.000Z");
    expect(parseExifDate("2027:03:14 06:30:05", "-05:00")?.toISOString()).toBe("2027-03-14T11:30:05.000Z");
  });

  it("ignores a malformed offset", () => {
    expect(parseExifDate("2027:03:14 06:30:05", "UTC")?.toISOString()).toBe("2027-03-13T22:30:05.000Z");
  });

  it("rejects zeroed, malformed and impossible dates", () => {
    expect(parseExifDate("0000:00:00 00:00:00")).toBeNull();
    expect(parseExifDate("2027-03-14 06:30:05")).toBeNull();
    expect(parseExifDate("2027:13:14 06:30:05")).toBeNull();
    expect(parseExifDate("2027:03:14 25:30:05")).toBeNull();
    expect(parseExifDate("")).toBeNull();
    expect(parseExifDate(null)).toBeNull();
  });
});

describe("readCaptureTime", () => {
  it("reads DateTimeOriginal with OffsetTimeOriginal (little endian)", () => {
    const exif = buildExif({
      exif: [
        { tag: 0x9003, value: "2027:03:14 06:30:05" },
        { tag: 0x9011, value: "+08:00" },
      ],
    });
    expect(readCaptureTime(exif)?.toISOString()).toBe("2027-03-13T22:30:05.000Z");
  });

  it("reads big endian blocks without the Exif header", () => {
    const exif = buildExif({ le: false, header: false, exif: [{ tag: 0x9003, value: "2027:03:14 07:00:00" }] });
    expect(readCaptureTime(exif)?.toISOString()).toBe("2027-03-13T23:00:00.000Z");
  });

  it("prefers DateTimeOriginal over the IFD0 DateTime (edit time)", () => {
    const exif = buildExif({
      ifd0: [{ tag: 0x0132, value: "2027:04:01 12:00:00" }],
      exif: [{ tag: 0x9003, value: "2027:03:14 06:30:05" }],
    });
    expect(readCaptureTime(exif)?.toISOString()).toBe("2027-03-13T22:30:05.000Z");
  });

  it("falls back to DateTimeDigitized, then IFD0 DateTime", () => {
    const digitized = buildExif({ exif: [{ tag: 0x9004, value: "2027:03:14 06:31:00" }] });
    expect(readCaptureTime(digitized)?.toISOString()).toBe("2027-03-13T22:31:00.000Z");
    const ifd0Only = buildExif({ ifd0: [{ tag: 0x0132, value: "2027:03:14 06:32:00" }] });
    expect(readCaptureTime(ifd0Only)?.toISOString()).toBe("2027-03-13T22:32:00.000Z");
  });

  it("returns null when no date is present", () => {
    expect(readCaptureTime(buildExif({}))).toBeNull();
  });

  it("returns null for missing, short or garbage input without throwing", () => {
    expect(readCaptureTime(undefined)).toBeNull();
    expect(readCaptureTime(null)).toBeNull();
    expect(readCaptureTime(Buffer.from("Exif"))).toBeNull();
    expect(readCaptureTime(Buffer.from("Exif\0\0XXXXXXXXXXXXXXXX", "latin1"))).toBeNull();
    expect(readCaptureTime(Buffer.alloc(64, 0xff))).toBeNull();
  });

  it("survives a truncated block", () => {
    const exif = buildExif({ exif: [{ tag: 0x9003, value: "2027:03:14 06:30:05" }] });
    expect(readCaptureTime(exif.subarray(0, exif.length - 10))).toBeNull();
  });
});

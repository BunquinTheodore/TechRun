import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { deriveImages, watermarkSvg } from "../src/pipeline/derive";

async function makeJpeg(width: number, height: number, exif?: Record<string, Record<string, string>>, orientation?: number): Promise<Buffer> {
  let img = sharp({ create: { width, height, channels: 3, background: { r: 40, g: 120, b: 200 } } }).jpeg();
  if (exif) img = img.withExif(exif);
  if (orientation) img = img.withMetadata({ orientation });
  return img.toBuffer();
}

describe("watermarkSvg", () => {
  it("is sized to the image and escapes the text", () => {
    const svg = watermarkSvg(800, 600, "A<B & C").toString();
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
    expect(svg).toContain("A&lt;B &amp; C");
  });
});

describe("deriveImages", () => {
  it("makes scan, preview and thumb at the configured long edges", async () => {
    const out = await deriveImages(await makeJpeg(3000, 2000));
    expect([out.scan.width, out.scan.height]).toEqual([2000, 1333]);
    expect([out.preview.width, out.preview.height]).toEqual([1200, 800]);
    expect([out.thumb.width, out.thumb.height]).toEqual([400, 267]);
    expect([out.width, out.height]).toEqual([3000, 2000]);
    expect(out.format).toBe("jpeg");
    for (const img of [out.scan, out.preview, out.thumb]) {
      const m = await sharp(img.buffer).metadata();
      expect(m.format).toBe("jpeg");
    }
  });

  it("watermarks the public thumb as well as the preview", async () => {
    const input = await makeJpeg(3000, 2000);
    const out = await deriveImages(input);
    const plain = await sharp(input).resize({ width: 400, height: 400, fit: "inside" }).jpeg().toBuffer();
    const mean = async (buf: Buffer) => (await sharp(buf).stats()).channels.map((c) => c.mean);
    const [marked, clean] = await Promise.all([mean(out.thumb.buffer), mean(plain)]);
    const diff = marked.reduce((sum, m, i) => sum + Math.abs(m - clean[i]), 0);
    expect(diff).toBeGreaterThan(1);
  });

  it("never enlarges a small original", async () => {
    const out = await deriveImages(await makeJpeg(300, 200));
    expect([out.scan.width, out.preview.width, out.thumb.width]).toEqual([300, 300, 300]);
  });

  it("strips EXIF and reads the capture time first", async () => {
    const input = await makeJpeg(1000, 800, {
      IFD0: { Make: "TestCam" },
      IFD2: { DateTimeOriginal: "2027:03:14 06:30:05", OffsetTimeOriginal: "+08:00" },
    });
    const out = await deriveImages(input);
    expect(out.takenAt?.toISOString()).toBe("2027-03-13T22:30:05.000Z");
    for (const img of [out.scan, out.preview, out.thumb]) {
      expect((await sharp(img.buffer).metadata()).exif).toBeUndefined();
    }
  });

  it("returns null takenAt without EXIF", async () => {
    expect((await deriveImages(await makeJpeg(500, 500))).takenAt).toBeNull();
  });

  it("auto orients using the EXIF orientation", async () => {
    // Orientation 6 means rotate 90 degrees: a 1000x500 sensor image displays as 500x1000.
    const out = await deriveImages(await makeJpeg(1000, 500, undefined, 6));
    expect([out.width, out.height]).toEqual([500, 1000]);
    expect([out.preview.width, out.preview.height]).toEqual([500, 1000]);
    expect((await sharp(out.preview.buffer).metadata()).orientation).toBeUndefined();
  });

  it("changes pixels in the preview (watermark applied) but not in the scan", async () => {
    const out = await deriveImages(await makeJpeg(1200, 800));
    const previewStats = await sharp(out.preview.buffer).stats();
    const scanStats = await sharp(out.scan.buffer).stats();
    expect(previewStats.channels[0].stdev).toBeGreaterThan(scanStats.channels[0].stdev + 1);
  });

  it("rejects input that is not an image", async () => {
    await expect(deriveImages(Buffer.from("not an image"))).rejects.toThrow();
  });
});

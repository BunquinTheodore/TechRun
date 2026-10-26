// Derived images with sharp: auto orient, strip metadata (GPS included), scan / preview and thumb (watermarked) JPEGs.

import sharp, { type Sharp } from "sharp";
import { JPEG_QUALITY, SIZES, WATERMARK_TEXT } from "../config";
import { readCaptureTime } from "./exif";

export interface DerivedImage {
  buffer: Buffer;
  width: number;
  height: number;
}

export interface DerivedImages {
  scan: DerivedImage;
  preview: DerivedImage;
  thumb: DerivedImage;
  /** Size of the original after auto orientation. */
  width: number;
  height: number;
  /** EXIF capture time, null when absent or unreadable. */
  takenAt: Date | null;
  /** Decoder format of the original, for example "jpeg". */
  format: string | null;
}

/** Watermark colours mirror PALETTE paper and ink (js/palette.js), as SVG rgb() for the server side renderer. */
const WATERMARK_FILL = "rgb(255,255,255)";
const WATERMARK_STROKE = "rgb(0,0,0)";
const WATERMARK_FILL_OPACITY = 0.32;
const WATERMARK_STROKE_OPACITY = 0.22;
const WATERMARK_ANGLE = -30;

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] ?? c);
}

/**
 * Full size SVG overlay with the watermark text tiled diagonally, plus thin diagonal rules so the preview
 * stays marked even if the runtime lacks fonts for the text.
 */
export function watermarkSvg(width: number, height: number, text: string = WATERMARK_TEXT): Buffer {
  const fontSize = Math.max(14, Math.round(Math.min(width, height) / 18));
  const tileW = Math.round(fontSize * Math.max(8, text.length * 0.75));
  const tileH = Math.round(fontSize * 4);
  const safe = escapeXml(text);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<defs>
<pattern id="wm" patternUnits="userSpaceOnUse" width="${tileW}" height="${tileH}" patternTransform="rotate(${WATERMARK_ANGLE})">
<text x="0" y="${Math.round(tileH / 2)}" font-family="DejaVu Sans, Liberation Sans, Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="${WATERMARK_FILL}" fill-opacity="${WATERMARK_FILL_OPACITY}" stroke="${WATERMARK_STROKE}" stroke-opacity="${WATERMARK_STROKE_OPACITY}" stroke-width="${Math.max(1, Math.round(fontSize / 24))}">${safe}</text>
<line x1="0" y1="${tileH - 1}" x2="${tileW}" y2="${tileH - 1}" stroke="${WATERMARK_FILL}" stroke-opacity="${WATERMARK_FILL_OPACITY / 2}" stroke-width="1"/>
</pattern>
</defs>
<rect width="100%" height="100%" fill="url(#wm)"/>
</svg>`;
  return Buffer.from(svg);
}

function fitInside(edge: number) {
  return { width: edge, height: edge, fit: "inside" as const, withoutEnlargement: true };
}

async function jpeg(img: Sharp, quality: number): Promise<DerivedImage> {
  const { data, info } = await img.jpeg({ quality, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

/** Resize to `edge`, then tile the watermark over the result (composited at the final size so it stays legible). */
async function watermarked(base: Sharp, edge: number, quality: number, text: string): Promise<DerivedImage> {
  const resized = await base.clone().resize(fitInside(edge)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = resized.info;
  return jpeg(sharp(resized.data, { raw: { width, height, channels } }).composite([{ input: watermarkSvg(width, height, text) }]), quality);
}

/** Make the three derived JPEGs. Output carries no EXIF, GPS or ICC metadata (sharp strips by default). */
export async function deriveImages(input: Buffer, watermarkText: string = WATERMARK_TEXT): Promise<DerivedImages> {
  const source = sharp(input, { failOn: "error" });
  const meta = await source.metadata();
  const base = source.clone().rotate();

  const scan = await jpeg(base.clone().resize(fitInside(SIZES.scan)), JPEG_QUALITY.scan);
  // Both public images carry the watermark; only the scan (server only) and the original stay clean.
  const preview = await watermarked(base, SIZES.preview, JPEG_QUALITY.preview, watermarkText);
  const thumb = await watermarked(base, SIZES.thumb, JPEG_QUALITY.thumb, watermarkText);

  const oriented = meta.autoOrient ?? { width: meta.width ?? scan.width, height: meta.height ?? scan.height };
  return {
    scan,
    preview,
    thumb,
    width: oriented.width,
    height: oriented.height,
    takenAt: readCaptureTime(meta.exif),
    format: meta.format ?? null,
  };
}

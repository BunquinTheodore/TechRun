// Cloud Vision TEXT_DETECTION on the scan image, mapped to OcrToken boxes for bibs.ts.

import { ImageAnnotatorClient, protos } from "@google-cloud/vision";
import type { OcrToken, TokenBox } from "./bibs";

type IAnnotateImageResponse = protos.google.cloud.vision.v1.IAnnotateImageResponse;
type IBoundingPoly = protos.google.cloud.vision.v1.IBoundingPoly;

export interface OcrResult {
  tokens: OcrToken[];
  /** Full detected text, for debugging. */
  fullText: string;
}

let client: ImageAnnotatorClient | null = null;
function visionClient(): ImageAnnotatorClient {
  client ??= new ImageAnnotatorClient();
  return client;
}

/** Axis aligned box around a polygon. Vision omits zero coordinates, so missing values count as 0. */
export function polyToBox(poly: IBoundingPoly | null | undefined): TokenBox | null {
  const vertices = poly?.vertices ?? [];
  if (vertices.length === 0) return null;
  const xs = vertices.map((v) => Number(v.x ?? 0));
  const ys = vertices.map((v) => Number(v.y ?? 0));
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * Words from fullTextAnnotation carry confidence, so prefer them.
 * Fall back to textAnnotations (index 0 is the whole text block, the rest are words).
 */
export function annotationsToTokens(res: IAnnotateImageResponse | null | undefined): OcrResult {
  if (!res) return { tokens: [], fullText: "" };
  const tokens: OcrToken[] = [];
  for (const page of res.fullTextAnnotation?.pages ?? []) {
    for (const block of page.blocks ?? []) {
      for (const para of block.paragraphs ?? []) {
        for (const word of para.words ?? []) {
          const text = (word.symbols ?? []).map((s) => s.text ?? "").join("");
          const box = polyToBox(word.boundingBox);
          if (text && box) tokens.push({ text, box, confidence: word.confidence ?? null });
        }
      }
    }
  }
  if (tokens.length === 0) {
    for (const ann of (res.textAnnotations ?? []).slice(1)) {
      const box = polyToBox(ann.boundingPoly);
      if (ann.description && box) tokens.push({ text: ann.description, box, confidence: null });
    }
  }
  const fullText = res.fullTextAnnotation?.text ?? res.textAnnotations?.[0]?.description ?? "";
  return { tokens, fullText };
}

/** Run TEXT_DETECTION on an in memory image. Throws on API errors so the caller can mark the photo for review. */
export async function detectText(image: Buffer): Promise<OcrResult> {
  const [res] = await visionClient().textDetection({ image: { content: image } });
  if (res.error?.message) throw new Error(`Vision: ${res.error.message}`);
  return annotationsToTokens(res);
}

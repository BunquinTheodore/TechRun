import { describe, expect, it } from "vitest";
import { annotationsToTokens, polyToBox } from "../src/pipeline/ocr";

const poly = (x: number, y: number, w: number, h: number) => ({
  vertices: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
});

describe("polyToBox", () => {
  it("returns the bounding box of the vertices", () => {
    expect(polyToBox(poly(10, 20, 30, 40))).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it("treats missing coordinates as zero", () => {
    expect(polyToBox({ vertices: [{}, { x: 50 }, { x: 50, y: 20 }, { y: 20 }] })).toEqual({ x: 0, y: 0, width: 50, height: 20 });
  });

  it("handles rotated text by taking the outer box", () => {
    expect(polyToBox({ vertices: [{ x: 10, y: 30 }, { x: 40, y: 10 }, { x: 50, y: 25 }, { x: 20, y: 45 }] })).toEqual({
      x: 10,
      y: 10,
      width: 40,
      height: 35,
    });
  });

  it("returns null for no vertices", () => {
    expect(polyToBox(null)).toBeNull();
    expect(polyToBox({ vertices: [] })).toBeNull();
  });
});

describe("annotationsToTokens", () => {
  it("prefers fullTextAnnotation words with confidence", () => {
    const r = annotationsToTokens({
      fullTextAnnotation: {
        text: "1234 RUN",
        pages: [
          {
            blocks: [
              {
                paragraphs: [
                  {
                    words: [
                      { boundingBox: poly(0, 0, 80, 40), confidence: 0.97, symbols: [{ text: "1" }, { text: "2" }, { text: "3" }, { text: "4" }] },
                      { boundingBox: poly(100, 0, 60, 40), confidence: 0.5, symbols: [{ text: "R" }, { text: "U" }, { text: "N" }] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      textAnnotations: [{ description: "ignored" }],
    });
    expect(r.fullText).toBe("1234 RUN");
    expect(r.tokens).toEqual([
      { text: "1234", box: { x: 0, y: 0, width: 80, height: 40 }, confidence: 0.97 },
      { text: "RUN", box: { x: 100, y: 0, width: 60, height: 40 }, confidence: 0.5 },
    ]);
  });

  it("falls back to textAnnotations and skips the whole text entry", () => {
    const r = annotationsToTokens({
      textAnnotations: [
        { description: "1234\nRUN", boundingPoly: poly(0, 0, 200, 100) },
        { description: "1234", boundingPoly: poly(0, 0, 80, 40) },
        { description: "", boundingPoly: poly(0, 0, 1, 1) },
        { description: "RUN" },
      ],
    });
    expect(r.fullText).toBe("1234\nRUN");
    expect(r.tokens).toEqual([{ text: "1234", box: { x: 0, y: 0, width: 80, height: 40 }, confidence: null }]);
  });

  it("returns nothing for an empty response", () => {
    expect(annotationsToTokens({})).toEqual({ tokens: [], fullText: "" });
    expect(annotationsToTokens(null)).toEqual({ tokens: [], fullText: "" });
  });
});

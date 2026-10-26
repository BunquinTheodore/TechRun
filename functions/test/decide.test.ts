import { describe, expect, it } from "vitest";
import type { BibExtraction } from "../src/pipeline/bibs";
import { decideTags } from "../src/pipeline/decide";

function vision(over: Partial<BibExtraction> = {}): BibExtraction {
  return { bibs: [], ambiguous: [], rejected: [], scores: {}, confidence: 0, ...over };
}
const REG = new Set(["1001", "2002", "3003"]);

describe("decideTags (Vision only)", () => {
  it("tags confident registered reads", () => {
    const d = decideTags({ vision: vision({ bibs: ["1001"], scores: { "1001": 0.9 }, confidence: 0.9 }), registered: REG });
    expect(d).toEqual({ bibs: ["1001"], suggestedBibs: [], status: "tagged", source: "vision", confidence: 0.9 });
  });

  it("sends a photo with nothing found to review", () => {
    expect(decideTags({ vision: vision(), registered: REG })).toEqual({
      bibs: [],
      suggestedBibs: [],
      status: "review",
      source: "none",
      confidence: 0,
    });
  });

  it("sends ambiguous reads to review as suggestions", () => {
    const d = decideTags({ vision: vision({ ambiguous: ["2002"], scores: { "2002": 0.4 } }), registered: REG });
    expect(d).toMatchObject({ bibs: [], suggestedBibs: ["2002"], status: "review", source: "vision", confidence: 0.4 });
  });

  it("turns a low confidence read into a suggestion", () => {
    const d = decideTags({ vision: vision({ bibs: ["3003"], scores: { "3003": 0.3 } }), registered: REG });
    expect(d).toMatchObject({ bibs: [], suggestedBibs: ["3003"], status: "review" });
  });

  it("keeps confirmed bibs but reviews leftover suggestions", () => {
    const d = decideTags({
      vision: vision({ bibs: ["1001"], ambiguous: ["2002"], scores: { "1001": 0.9, "2002": 0.4 }, confidence: 0.9 }),
      registered: REG,
    });
    expect(d).toMatchObject({ bibs: ["1001"], suggestedBibs: ["2002"], status: "review", source: "vision", confidence: 0.9 });
  });

  it("reviews a read that is not registered", () => {
    const d = decideTags({ vision: vision({ bibs: ["9999"], scores: { "9999": 0.95 } }), registered: REG });
    expect(d).toMatchObject({ bibs: [], suggestedBibs: ["9999"], status: "review" });
  });

  it("only suggests while the registry is empty", () => {
    const d = decideTags({ vision: vision({ ambiguous: ["1234"], scores: { "1234": 0.8 } }), registered: new Set() });
    expect(d).toMatchObject({ bibs: [], suggestedBibs: ["1234"], status: "review" });
  });

  it("reviews when a step failed even with a confident read", () => {
    const d = decideTags({ vision: vision({ bibs: ["1001"], scores: { "1001": 0.9 } }), registered: REG, hadErrors: true });
    expect(d.status).toBe("review");
  });
});

import { describe, expect, it } from "vitest";
import { detectDelimiter, normalizeDistance, parseBibCsv, parseCsv, parseCsvRecords, validateBibRows } from "../src/lib/csv";

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded commas and newlines", () => {
    const text = 'a,"b, c","say ""hi""","multi\nline"\r\n1,2,3,4';
    expect(parseCsv(text)).toEqual([
      ["a", "b, c", 'say "hi"', "multi\nline"],
      ["1", "2", "3", "4"],
    ]);
  });

  it("strips a BOM and handles CR only line endings", () => {
    expect(parseCsv("﻿x,y\ry,z")).toEqual([
      ["x", "y"],
      ["y", "z"],
    ]);
  });

  it("detects semicolon and tab delimiters", () => {
    expect(detectDelimiter("bib;distance\n1;2")).toBe(";");
    expect(detectDelimiter("bib\tdistance")).toBe("\t");
    expect(detectDelimiter('"a;b",c')).toBe(",");
    expect(parseCsv("1001;5K")).toEqual([["1001", "5K"]]);
  });
});

describe("normalizeDistance", () => {
  it.each([
    ["3K", "3K"],
    ["3k", "3K"],
    ["5 km", "5K"],
    ["10KM", "10K"],
    ["10 K Run", "10K"],
    ["3K Fun Run", "3K"],
    ["10", "10K"],
    [5, "5K"],
  ])("maps %s to %s", (input, expected) => {
    expect(normalizeDistance(input)).toBe(expected);
  });

  it.each(["21K", "1K", "", "fun run", "100K"])("rejects %s", (input) => {
    expect(normalizeDistance(input)).toBeNull();
  });
});

describe("parseBibCsv", () => {
  it("finds columns by header name in any order, ignoring extra columns", () => {
    const csv = [
      "Registration ID,Full Name,Race Category,Bib Number,Shirt Size",
      'R1,"Dela Cruz, Juan",10K,1001,M',
      "R2,Maria Santos,5 km,#2002,S",
    ].join("\r\n");
    expect(parseBibCsv(csv)).toEqual({
      rows: [
        { bib: "1001", distance: "10K" },
        { bib: "2002", distance: "5K" },
      ],
      skipped: [],
    });
  });

  it("assumes bib then distance without a header", () => {
    expect(parseBibCsv("1001,3K\n1002,5K\n").rows).toEqual([
      { bib: "1001", distance: "3K" },
      { bib: "1002", distance: "5K" },
    ]);
  });

  it("reports bad, unknown and duplicate rows with line numbers", () => {
    const csv = "bib,distance\n1001,10K\nABC,5K\n1003,21K\n1001,3K\n,5K\n\n1006,3K";
    const result = parseBibCsv(csv);
    expect(result.rows).toEqual([
      { bib: "1001", distance: "10K" },
      { bib: "1006", distance: "3K" },
    ]);
    expect(result.skipped).toEqual([
      { row: 3, bib: "ABC", reason: "bib does not match the bib format" },
      { row: 4, bib: "1003", reason: "unknown distance" },
      { row: 5, bib: "1001", reason: "duplicate bib" },
      { row: 6, bib: "", reason: "missing bib" },
    ]);
  });

  it("keeps leading zeros and unwraps the Excel guard", () => {
    expect(parseBibCsv('bib,distance\n="0123",5K\n  0456 , 3k ').rows).toEqual([
      { bib: "0123", distance: "5K" },
      { bib: "0456", distance: "3K" },
    ]);
  });

  it("skips everything when a header has no distance column", () => {
    const result = parseBibCsv("bib,name\n1001,Juan");
    expect(result.rows).toEqual([]);
    expect(result.skipped[0].reason).toBe("no distance column in the header");
  });

  it("returns nothing for an empty file", () => {
    expect(parseBibCsv("﻿\r\n\r\n")).toEqual({ rows: [], skipped: [] });
  });
});

describe("validateBibRows", () => {
  it("validates client supplied rows", () => {
    const result = validateBibRows([
      { bib: "1001", distance: "5K" },
      { bib: 1002, distance: "10k" },
      { bib: null, distance: "5K" },
      { bib: "1003", distance: "half" },
    ]);
    expect(result.rows).toEqual([
      { bib: "1001", distance: "5K" },
      { bib: "1002", distance: "10K" },
    ]);
    expect(result.skipped.map((s) => s.row)).toEqual([3, 4]);
  });
});

describe("CSV line numbers", () => {
  it("reports the physical line when a quoted cell spans lines", () => {
    const csv = 'bib,distance,note\r\n1001,5K,"two\nlines"\r\nABC,3K,x\r\n\r\n1002,10K,y\n1003,42K,z';
    const result = parseBibCsv(csv);
    expect(result.rows).toEqual([
      { bib: "1001", distance: "5K" },
      { bib: "1002", distance: "10K" },
    ]);
    expect(result.skipped).toEqual([
      { row: 4, bib: "ABC", reason: "bib does not match the bib format" },
      { row: 7, bib: "1003", reason: "unknown distance" },
    ]);
  });

  it("counts lines from 1 with a BOM and CR only endings", () => {
    const result = parseBibCsv("﻿bib;distance\r1001;5K\rbad;5K");
    expect(result.skipped).toEqual([{ row: 3, bib: "bad", reason: "bib does not match the bib format" }]);
  });

  it("parseCsvRecords gives the starting line of each record", () => {
    expect(parseCsvRecords('a,"x\ny"\nb,c').map((r) => r.line)).toEqual([1, 3]);
  });
});

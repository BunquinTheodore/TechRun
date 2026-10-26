// Bib list CSV parsing (pure). Built for the iRunPH registration export but tolerant of hand made files:
// BOM, CRLF or LF, quoted fields with commas, quotes and newlines, comma/semicolon/tab delimiters,
// any column order, extra columns, and an optional header row.
import { DISTANCES, type Distance, type ImportBibRow } from "../types";
import { normalizeBib } from "./validate";

/** Most data rows accepted in one import. */
export const MAX_IMPORT_ROWS = 20000;

export interface SkippedRow {
  row: number;
  bib: string;
  reason: string;
}

export interface ParsedBibs {
  rows: ImportBibRow[];
  skipped: SkippedRow[];
}

/** Picks the delimiter that appears most often outside quotes on the first line. */
export function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    else if (!inQuotes && ch in counts) counts[ch] += 1;
  }
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count > 0 ? best : ",";
}

export interface CsvRecord {
  cells: string[];
  /** 1 based physical line where the record starts (a quoted cell may span lines). */
  line: number;
}

/** RFC 4180 style parser that also reports the starting line of each record. Cells are not trimmed. */
export function parseCsvRecords(input: string, delimiter = detectDelimiter(input.replace(/^﻿/, ""))): CsvRecord[] {
  const text = input.replace(/^﻿/, "");
  const records: CsvRecord[] = [];
  let record: string[] = [];
  let cell = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  let i = 0;
  const endCell = () => {
    record.push(cell);
    cell = "";
  };
  const endRecord = () => {
    endCell();
    records.push({ cells: record, line: recordLine });
    record = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        if (ch === "\n" || (ch === "\r" && text[i + 1] !== "\n")) line += 1;
        cell += ch;
      }
      i += 1;
      continue;
    }
    if (ch === '"' && cell.trim() === "") {
      cell = "";
      inQuotes = true;
    } else if (ch === delimiter) {
      endCell();
    } else if (ch === "\r" || ch === "\n") {
      endRecord();
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      line += 1;
      recordLine = line;
    } else {
      cell += ch;
    }
    i += 1;
  }
  if (cell !== "" || record.length > 0) endRecord();
  return records;
}

/** RFC 4180 style parser. Returns records as arrays of raw cell strings (not trimmed). */
export function parseCsv(input: string, delimiter?: string): string[][] {
  return parseCsvRecords(input, delimiter).map((r) => r.cells);
}

/** Maps a free text distance ("10K", "5 km", "3k Fun Run", "10") to a Distance; null when unknown. */
export function normalizeDistance(value: unknown): Distance | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const compact = String(value)
    .toUpperCase()
    .replace(/[\s._-]+/g, "")
    .replace(/(FUNRUN|RUN|RACE|CATEGORY|CAT)$/g, "");
  const m = /^(3|5|10)(K|KM|KMS|KILOMETERS?|KILOMETRES?)?$/.exec(compact);
  if (!m) return null;
  const distance = `${m[1]}K` as Distance;
  return DISTANCES.includes(distance) ? distance : null;
}

const headerKey = (cell: string) => cell.toLowerCase().replace(/[^a-z#]/g, "");
const BIB_HEADERS = new Set(["bib", "bibno", "bibnumber", "bib#", "racebib", "bibnum", "racenumber", "racebibnumber"]);
const DISTANCE_HEADERS = new Set(["distance", "category", "race", "racecategory", "racedistance", "event", "racetype", "km"]);

/** Strips the Excel ="0123" guard and surrounding whitespace. */
function cleanCell(cell: string | undefined): string {
  const trimmed = (cell ?? "").trim();
  const excel = /^="(.*)"$/.exec(trimmed);
  return (excel ? excel[1] : trimmed).trim();
}

/**
 * Validates parsed bib rows. rowNumbers gives the 1 based CSV line of each entry for error reports;
 * defaults to the 1 based index.
 */
export function validateBibRows(
  raw: readonly { bib: unknown; distance: unknown }[],
  rowNumbers?: readonly number[],
): ParsedBibs {
  const rows: ImportBibRow[] = [];
  const skipped: SkippedRow[] = [];
  const seen = new Set<string>();
  raw.forEach((entry, index) => {
    const row = rowNumbers?.[index] ?? index + 1;
    const rawBib = typeof entry.bib === "string" || typeof entry.bib === "number" ? cleanCell(String(entry.bib)) : "";
    if (rawBib === "") return void skipped.push({ row, bib: "", reason: "missing bib" });
    if (rows.length >= MAX_IMPORT_ROWS) return void skipped.push({ row, bib: rawBib, reason: `over the ${MAX_IMPORT_ROWS} row limit` });
    const bib = normalizeBib(rawBib);
    if (!bib) return void skipped.push({ row, bib: rawBib, reason: "bib does not match the bib format" });
    const distance = normalizeDistance(typeof entry.distance === "string" ? cleanCell(entry.distance) : entry.distance);
    if (!distance) return void skipped.push({ row, bib, reason: "unknown distance" });
    if (seen.has(bib)) return void skipped.push({ row, bib, reason: "duplicate bib" });
    seen.add(bib);
    rows.push({ bib, distance });
  });
  return { rows, skipped };
}

/** Parses a bib list CSV. With a header row the bib and distance columns are found by name, otherwise columns 1 and 2. */
export function parseBibCsv(text: string): ParsedBibs {
  const nonEmpty = parseCsvRecords(text).filter(({ cells }) => cells.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { rows: [], skipped: [] };

  let bibCol = 0;
  let distanceCol = 1;
  let dataStart = 0;
  const header = nonEmpty[0].cells.map((c) => headerKey(cleanCell(c)));
  const headerBib = header.findIndex((k) => BIB_HEADERS.has(k));
  if (headerBib >= 0) {
    bibCol = headerBib;
    const headerDistance = header.findIndex((k, i) => i !== headerBib && DISTANCE_HEADERS.has(k));
    distanceCol = headerDistance >= 0 ? headerDistance : -1;
    dataStart = 1;
  }

  const data = nonEmpty.slice(dataStart);
  if (distanceCol < 0) {
    return { rows: [], skipped: data.map(({ line }) => ({ row: line, bib: "", reason: "no distance column in the header" })) };
  }
  return validateBibRows(
    data.map(({ cells }) => ({ bib: cells[bibCol] ?? "", distance: cells[distanceCol] ?? "" })),
    data.map(({ line }) => line),
  );
}

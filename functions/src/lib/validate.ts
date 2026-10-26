// Input validation for callables. Every callable payload is untrusted, whatever its TypeScript type says.
import { HttpsError } from "firebase-functions/v2/https";
import { BIB_PATTERN } from "../config";

/** Firestore document ids and Storage file stems used by this system. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const MAX_EMAIL_LENGTH = 254;

export function invalid(message: string): never {
  throw new HttpsError("invalid-argument", message);
}

/** Lower cased, trimmed email; throws invalid-argument when it does not look like an address. */
export function requireEmail(value: unknown, field = "email"): string {
  if (typeof value !== "string") invalid(`${field} is required`);
  const email = value.trim().toLowerCase();
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) invalid(`${field} is not a valid email address`);
  return email;
}

export function isValidEmail(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const email = value.trim().toLowerCase();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email);
}

export function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) invalid(`${field} is not a valid id`);
  return value;
}

/** Array of ids, de-duplicated, order kept; length must fall in [min, max]. */
export function requireIdArray(value: unknown, field: string, min: number, max: number): string[] {
  if (!Array.isArray(value)) invalid(`${field} must be an array`);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const id = requireId(item, `${field} entry`);
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  if (out.length < min || out.length > max) invalid(`${field} must contain between ${min} and ${max} entries`);
  return out;
}

export function requireText(value: unknown, field: string, maxLength: number, { allowEmpty = false } = {}): string {
  if (typeof value !== "string") invalid(`${field} is required`);
  const text = value.trim();
  if (!allowEmpty && text.length === 0) invalid(`${field} is required`);
  if (text.length > maxLength) invalid(`${field} is longer than ${maxLength} characters`);
  return text;
}

/** Normalises a typed or OCR bib (trims, drops a leading #, inner spaces); null when it does not match BIB_PATTERN. */
export function normalizeBib(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const bib = String(value).trim().replace(/^#/, "").replace(/\s+/g, "");
  return BIB_PATTERN.test(bib) ? bib : null;
}

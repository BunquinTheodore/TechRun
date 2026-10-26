// Tunable settings for the race photo system. Values marked TBA wait on the organisers.
// No secrets live here: the only external service is Cloud Vision, which uses the function's service account,
// and email goes through the Firebase Trigger Email extension (its SMTP credentials are extension config).

/** Cloud Functions region. Must match the Storage bucket location for the upload trigger. TBA: confirm with the project setup. */
export const REGION = "asia-southeast1";


/** Default event id until multiple events exist. */
export const DEFAULT_EVENT_ID = "techrun-2027";

/** Event name used in emails. */
export const EVENT_DISPLAY_NAME = "TechRun 2027";

/* ---------- bib recognition (Cloud Vision only) ---------- */

/**
 * Bib number format. TBA: confirm the real format and ranges per distance with the organisers.
 * Default accepts 3 to 5 digits. The registered bib list (bibs/ collection) is the final authority.
 */
export const BIB_PATTERN = /^\d{3,5}$/;

/**
 * Minimum height of an OCR token box as a share of the scan image height.
 * Smaller text (timestamps, phone numbers, sponsor fine print) is ignored. Tune on the labelled sample.
 */
export const MIN_BIB_HEIGHT_RATIO = 0.012;

/** Tokens whose box touches within this share of the image edge are treated as cut off. */
export const EDGE_MARGIN_RATIO = 0.005;

/** Below this confidence an automatic read goes to status review (as a suggestion) instead of tagged. */
export const MIN_AUTO_CONFIDENCE = 0.6;

/** How long one function instance reuses the registered bib list. Empty lists are never cached. */
export const REGISTERED_BIBS_CACHE_MS = 60 * 1000;

/* ---------- derived images ---------- */

export const SIZES = {
  /** Long edge of the OCR scan image. */
  scan: 2000,
  /** Long edge of the public watermarked preview. */
  preview: 1200,
  /** Long edge of the grid thumbnail. */
  thumb: 400,
} as const;

export const JPEG_QUALITY = {
  scan: 85,
  preview: 78,
  thumb: 72,
} as const;

export const WATERMARK_TEXT = "TECHRUN 2027 PREVIEW";

/** Upload limit for originals, mirrored in storage.rules. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Receipt screenshot limit, mirrored in storage.rules. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

/** GCash QR image limit, mirrored in storage.rules. */
export const MAX_QR_BYTES = 5 * 1024 * 1024;

/* ---------- orders (manual GCash to each photographer) ---------- */

export const CURRENCY = "PHP" as const;

/**
 * Fixed price of one photo in whole Philippine pesos. Every order amount is count x this, in whole pesos.
 * js/photos must show the same number.
 */
export const PRICE_PER_PHOTO = 150;

/** Most photos one createOrders call may hold (the cart cap). js/photos must use the same number. */
export const MAX_PHOTOS_PER_CALL = 50;

/** Most orders one buyer email may have in awaiting_payment at once. */
export const MAX_OPEN_ORDERS_PER_EMAIL = 10;

/** createOrders calls allowed per buyer email per hour. */
export const CREATE_ORDERS_LIMIT_PER_EMAIL_HOUR = 10;
/** createOrders calls allowed per client IP per hour (kept high: mobile carriers share IPs). */
export const CREATE_ORDERS_LIMIT_PER_IP_HOUR = 40;
/**
 * createOrders calls allowed per hour across all buyers. Every call queues one email, so this caps how much
 * mail the public callable can send even if the per email and per IP limits are dodged.
 */
export const CREATE_ORDERS_LIMIT_GLOBAL_HOUR = 300;

/** Unpaid orders are deleted by the Firestore TTL policy on orders.expireAt after this long. */
export const ORDER_UNPAID_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A rejected order the buyer never fixes is deleted after this long. */
export const ORDER_REJECTED_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Lifetime of signed download URLs to originals. */
export const DOWNLOAD_URL_TTL_MS = 60 * 60 * 1000;

/** Longest reject reason a photographer may write. */
export const MAX_REJECT_REASON_CHARS = 300;

/**
 * Require Firebase App Check on the public order callables. Off until the reCAPTCHA Enterprise site key is set
 * in js/photos/firebase.js; turn both on together, or every buyer call fails.
 */
export const ENFORCE_APP_CHECK = false;

/**
 * Absolute site origin used for links in emails. SITE_URL (functions .env) wins; otherwise the project's
 * web.app origin, or the Hosting emulator in the Emulator Suite.
 */
export function siteOrigin(env: NodeJS.ProcessEnv = process.env): string {
  if (env.SITE_URL) return env.SITE_URL.replace(/\/+$/, "");
  if (env.FUNCTIONS_EMULATOR === "true") return "http://127.0.0.1:5000";
  const projectId = env.GCLOUD_PROJECT ?? env.GCP_PROJECT ?? "techrun-2027";
  return `https://${projectId}.web.app`;
}

import { describe, expect, it } from "vitest";
import { MAX_PHOTOS_PER_CALL, PRICE_PER_PHOTO } from "../src/config";
import {
  ORDER_CODE_ALPHABET,
  ORDER_CODE_PATTERN,
  groupByPhotographer,
  isQrPathFor,
  isReceiptPathFor,
  newOrderCode,
  normalizeGcashRef,
  normalizePhMobile,
  orderAmount,
  orderPageUrl,
  publicStorageUrl,
} from "../src/orders/logic";
import { withNewHash } from "../src/orders/photographer";

const photo = (photoId: string, photographerUid: string) => ({ photoId, photographerUid, thumbPath: `thumbs/ev/${photoId}.jpg` });

describe("pricing constants", () => {
  it("is PHP 150 per photo with a 50 photo cart cap", () => {
    expect(PRICE_PER_PHOTO).toBe(150);
    expect(MAX_PHOTOS_PER_CALL).toBe(50);
  });
});

describe("orderAmount", () => {
  it("is count x 150 pesos", () => {
    expect(orderAmount(1)).toBe(150);
    expect(orderAmount(7)).toBe(1050);
  });
  it("rejects empty or fractional counts", () => {
    expect(() => orderAmount(0)).toThrow();
    expect(() => orderAmount(1.5)).toThrow();
    expect(() => orderAmount(2, 0)).toThrow();
  });
});

describe("groupByPhotographer", () => {
  it("makes one order per photographer with the right amounts", () => {
    const groups = groupByPhotographer([photo("a", "u1"), photo("b", "u2"), photo("c", "u1"), photo("d", "u1")]);
    expect(groups).toEqual([
      { photographerUid: "u1", photoIds: ["a", "c", "d"], thumbPaths: ["thumbs/ev/a.jpg", "thumbs/ev/c.jpg", "thumbs/ev/d.jpg"], count: 3, amount: 450 },
      { photographerUid: "u2", photoIds: ["b"], thumbPaths: ["thumbs/ev/b.jpg"], count: 1, amount: 150 },
    ]);
  });
  it("counts a repeated photo once", () => {
    const [g] = groupByPhotographer([photo("a", "u1"), photo("a", "u1")]);
    expect(g.count).toBe(1);
    expect(g.amount).toBe(150);
  });
  it("returns nothing for an empty cart", () => {
    expect(groupByPhotographer([])).toEqual([]);
  });
  it("keeps the total equal to all photos x price", () => {
    const cart = Array.from({ length: 12 }, (_, i) => photo(`p${i}`, `u${i % 4}`));
    const groups = groupByPhotographer(cart);
    expect(groups).toHaveLength(4);
    expect(groups.reduce((sum, g) => sum + g.amount, 0)).toBe(12 * PRICE_PER_PHOTO);
  });
});

describe("newOrderCode", () => {
  it("looks like TR-XXXXX from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i += 1) expect(newOrderCode()).toMatch(ORDER_CODE_PATTERN);
    expect(ORDER_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
  it("uses the random source", () => {
    expect(newOrderCode(() => 0)).toBe("TR-22222");
    expect(newOrderCode((max) => max - 1)).toBe("TR-ZZZZZ");
  });
});

describe("normalizeGcashRef", () => {
  it("accepts 13 digits, ignoring spaces", () => {
    expect(normalizeGcashRef("1234567890123")).toBe("1234567890123");
    expect(normalizeGcashRef("1234 567 890123")).toBe("1234567890123");
    expect(normalizeGcashRef(" 1234567890123 ")).toBe("1234567890123");
  });
  it("rejects other shapes", () => {
    expect(normalizeGcashRef("123456789012")).toBeNull();
    expect(normalizeGcashRef("12345678901234")).toBeNull();
    expect(normalizeGcashRef("1234-567890123")).toBeNull();
    expect(normalizeGcashRef("12345678901a3")).toBeNull();
    expect(normalizeGcashRef(undefined)).toBeNull();
  });
});

describe("normalizePhMobile", () => {
  it("accepts 09 and +639 forms", () => {
    expect(normalizePhMobile("09171234567")).toBe("09171234567");
    expect(normalizePhMobile("+639171234567")).toBe("09171234567");
    expect(normalizePhMobile("639171234567")).toBe("09171234567");
    expect(normalizePhMobile("0917 123 4567")).toBe("09171234567");
    expect(normalizePhMobile("+63 917-123-4567")).toBe("09171234567");
  });
  it("rejects landlines, short numbers and other countries", () => {
    expect(normalizePhMobile("0281234567")).toBeNull();
    expect(normalizePhMobile("0917123456")).toBeNull();
    expect(normalizePhMobile("091712345678")).toBeNull();
    expect(normalizePhMobile("+6591234567")).toBeNull();
    expect(normalizePhMobile("+638171234567")).toBeNull();
    expect(normalizePhMobile(9171234567)).toBeNull();
  });
});

describe("client supplied paths", () => {
  it("accepts only this order's receipts folder", () => {
    expect(isReceiptPathFor("o1", "receipts/o1/abc.jpg")).toBe(true);
    expect(isReceiptPathFor("o1", "receipts/o1/abc.webp")).toBe(true);
    expect(isReceiptPathFor("o1", "receipts/o2/abc.jpg")).toBe(false);
    expect(isReceiptPathFor("o1", "receipts/o1/../o2/abc.jpg")).toBe(false);
    expect(isReceiptPathFor("o1", "receipts/o1/abc.svg")).toBe(false);
    expect(isReceiptPathFor("o1", "receipts/o1/a/b.jpg")).toBe(false);
    expect(isReceiptPathFor("o1", null)).toBe(false);
  });
  it("accepts only the caller's QR file", () => {
    expect(isQrPathFor("u1", "qr/u1.png")).toBe(true);
    expect(isQrPathFor("u1", "qr/u1.jpg")).toBe(true);
    expect(isQrPathFor("u1", "qr/u1.webp")).toBe(true);
    expect(isQrPathFor("u1", "qr/u1.heic")).toBe(false);
    expect(isQrPathFor("u1", "qr/u2.png")).toBe(false);
    expect(isQrPathFor("u1", "qr/u1.png.exe")).toBe(false);
  });
});

describe("links", () => {
  it("builds the order page link", () => {
    expect(orderPageUrl("abc", "t_-1")).toBe("photos/order.html?id=abc&t=t_-1");
  });
  it("builds public Storage URLs for production and the emulator", () => {
    expect(publicStorageUrl("b.appspot.com", "qr/u1.png", {})).toBe(
      "https://firebasestorage.googleapis.com/v0/b/b.appspot.com/o/qr%2Fu1.png?alt=media",
    );
    expect(publicStorageUrl("b", "thumbs/e/p.jpg", { FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199" })).toBe(
      "http://127.0.0.1:9199/v0/b/b/o/thumbs%2Fe%2Fp.jpg?alt=media",
    );
  });
});

describe("withNewHash", () => {
  it("appends until the cap, then keeps the first and the newest", () => {
    expect(withNewHash(["a"], "b")).toEqual(["a", "b"]);
    const full = ["h0", "h1", "h2", "h3", "h4", "h5", "h6", "h7"];
    const next = withNewHash(full, "n");
    expect(next).toHaveLength(8);
    expect(next[0]).toBe("h0");
    expect(next[7]).toBe("n");
  });
});

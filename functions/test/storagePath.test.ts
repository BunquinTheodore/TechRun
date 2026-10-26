import { describe, expect, it } from "vitest";
import { attachmentDisposition, downloadFileName, sanitizeFileName } from "../src/lib/fileName";
import { bibDocId, originalPath, parseStoragePath, previewPath, qrPath, scanPath, thumbPath } from "../src/types";

const ID = "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f";

describe("storage path helpers", () => {
  it("puts the uploader uid in the original path", () => {
    expect(originalPath("techrun-2027", "uid1", ID, ".JPG")).toBe(`originals/techrun-2027/uid1/${ID}.jpg`);
    expect(previewPath("techrun-2027", ID)).toBe(`previews/techrun-2027/${ID}.jpg`);
    expect(thumbPath("techrun-2027", ID)).toBe(`thumbs/techrun-2027/${ID}.jpg`);
    expect(scanPath("techrun-2027", ID)).toBe(`scans/techrun-2027/${ID}.jpg`);
    expect(qrPath("uid1", "PNG")).toBe("qr/uid1.png");
  });
});

describe("parseStoragePath", () => {
  it("reads event, uid and photo id from an original", () => {
    expect(parseStoragePath(`originals/techrun-2027/uid1/${ID}.JPG`)).toEqual({
      kind: "originals",
      eventId: "techrun-2027",
      uid: "uid1",
      photoId: ID,
      ext: "jpg",
    });
  });

  it("round trips the helpers", () => {
    expect(parseStoragePath(originalPath("ev", "u", ID, "webp"))).toMatchObject({ kind: "originals", uid: "u", photoId: ID, ext: "webp" });
    expect(parseStoragePath(thumbPath("ev", ID))).toEqual({ kind: "thumbs", eventId: "ev", uid: null, photoId: ID, ext: "jpg" });
    expect(parseStoragePath(previewPath("ev", ID))?.kind).toBe("previews");
    expect(parseStoragePath(scanPath("ev", ID))?.kind).toBe("scans");
  });

  it("rejects the old uid less original path and other shapes", () => {
    expect(parseStoragePath(`originals/ev/${ID}.jpg`)).toBeNull();
    expect(parseStoragePath(`originals/ev/u/x/${ID}.jpg`)).toBeNull();
    expect(parseStoragePath(`thumbs/ev/u/${ID}.jpg`)).toBeNull();
    expect(parseStoragePath(`originals/ev/../${ID}.jpg`)).toBeNull();
    expect(parseStoragePath(`receipts/o1/r.jpg`)).toBeNull();
    expect(parseStoragePath(`qr/u1.png`)).toBeNull();
    expect(parseStoragePath("")).toBeNull();
  });
});

describe("download file names", () => {
  it("sanitises untrusted names", () => {
    expect(sanitizeFileName("C:\\fakepath\\IMG_0001.JPG")).toBe("IMG_0001.JPG");
    expect(sanitizeFileName('../../a"b<c>.jpg')).toBe("abc.jpg");
    expect(sanitizeFileName("   ")).toBeNull();
    expect(sanitizeFileName(42)).toBeNull();
    expect(sanitizeFileName(`${"x".repeat(200)}.jpeg`)).toHaveLength(120);
  });

  it("uses the original name with the stored extension, numbering repeats", () => {
    const used = new Set<string>();
    expect(downloadFileName("IMG_0001.JPG", "p1", "jpg", used)).toBe("IMG_0001.jpg");
    expect(downloadFileName("img_0001.jpg", "p2", "jpg", used)).toBe("img_0001 (2).jpg");
    expect(downloadFileName(null, "p3", "png", used)).toBe("techrun-2027-p3.png");
  });

  it("builds a header safe attachment disposition", () => {
    expect(attachmentDisposition("Takbo Ñ.jpg")).toBe(`attachment; filename="Takbo _.jpg"; filename*=UTF-8''Takbo%20%C3%91.jpg`);
  });
});

describe("bibDocId", () => {
  it("keys a bib by event so two events can share a number", () => {
    expect(bibDocId("techrun-2027", "1234")).toBe("techrun-2027__1234");
    expect(bibDocId("other-run", "1234")).not.toBe(bibDocId("techrun-2027", "1234"));
  });
});

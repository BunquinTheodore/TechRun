import { describe, expect, it } from "vitest";
import { orderApprovedMail, orderRejectedMail, ordersCreatedMail, receiptSubmittedMail } from "../src/orders/emails";

describe("order emails (Trigger Email format)", () => {
  it("lists every order with its link and escapes html", () => {
    const mail = ordersCreatedMail("buyer@example.com", "Juan <b>", [
      { code: "TR-22222", photographerName: "Ana", amount: 300, count: 2, link: "https://x.web.app/photos/order.html?id=a&t=1" },
      { code: "TR-33333", photographerName: "Ben", amount: 150, count: 1, link: "https://x.web.app/photos/order.html?id=b&t=2" },
    ]);
    expect(mail.to).toBe("buyer@example.com");
    expect(mail.message.subject).toContain("2 orders");
    expect(mail.message.text).toContain("TR-22222");
    expect(mail.message.text).toContain("https://x.web.app/photos/order.html?id=b&t=2");
    expect(mail.message.html).toContain("Juan &lt;b&gt;");
    expect(mail.message.html).toContain('href="https://x.web.app/photos/order.html?id=a&amp;t=1"');
    expect(mail.message.text).not.toMatch(/[–—]/);
  });

  it("warns the photographer about a duplicate reference", () => {
    const mail = receiptSubmittedMail("p@example.com", {
      code: "TR-22222",
      buyerName: "Juan",
      amount: 150,
      gcashRef: "1234567890123",
      duplicateRef: true,
      dashboardLink: "https://x.web.app/photos/upload.html#orders",
    });
    expect(mail.message.text).toContain("already used");
  });

  it("emails approve and reject outcomes with the order link", () => {
    expect(orderApprovedMail("b@example.com", { code: "TR-22222", link: "L" }).message.text).toContain("L");
    expect(orderRejectedMail("b@example.com", { code: "TR-22222", reason: "Amount short", link: "L" }).message.text).toContain("Amount short");
  });
});

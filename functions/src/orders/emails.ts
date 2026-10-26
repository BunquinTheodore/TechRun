// Order emails (pure builders) and the mail/ queue writer. Delivery is done by the Firebase Trigger Email
// extension, which watches mail/ and expects { to, message: { subject, text, html } }.
import type { Firestore, Transaction, WriteBatch } from "firebase-admin/firestore";
import { CURRENCY, EVENT_DISPLAY_NAME } from "../config";
import { COLLECTIONS, type MailDoc, type Pesos } from "../types";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export function formatPesos(amount: Pesos): string {
  return `${CURRENCY} ${amount.toLocaleString("en-PH")}`;
}

interface Paragraph {
  text: string;
  link?: { href: string; label: string };
}

function compose(to: string, subject: string, paragraphs: Paragraph[]): MailDoc {
  const text = paragraphs.map((p) => (p.link ? `${p.text}\n${p.link.href}` : p.text)).join("\n\n");
  const html = paragraphs
    .map((p) => {
      const body = `<p>${escapeHtml(p.text)}</p>`;
      return p.link ? `${body}\n<p><a href="${escapeHtml(p.link.href)}">${escapeHtml(p.link.label)}</a></p>` : body;
    })
    .join("\n");
  return { to, message: { subject, text, html } };
}

export interface BuyerOrderSummary {
  code: string;
  photographerName: string;
  amount: Pesos;
  count: number;
  /** Absolute order page link with the token. */
  link: string;
}

/** Sent once per createOrders call, listing every order (one per photographer). */
export function ordersCreatedMail(to: string, buyerName: string, orders: readonly BuyerOrderSummary[]): MailDoc {
  const paragraphs: Paragraph[] = [
    { text: `Hi ${buyerName}, thank you for your ${EVENT_DISPLAY_NAME} photo order.` },
    {
      text:
        orders.length === 1
          ? "Pay the photographer by GCash, then upload your receipt on the order page."
          : `Your photos are from ${orders.length} photographers, so you have ${orders.length} orders. Pay each photographer by GCash, then upload each receipt on its order page.`,
    },
    ...orders.map((o) => ({
      text: `Order ${o.code}: ${o.count} ${o.count === 1 ? "photo" : "photos"} by ${o.photographerName}, ${formatPesos(o.amount)}. Put ${o.code} in the GCash message.`,
      link: { href: o.link, label: `Open order ${o.code}` },
    })),
    { text: "Keep this email. The links open your orders on any device, and your downloads appear there once the photographer confirms your payment." },
  ];
  const subject =
    orders.length === 1 ? `${EVENT_DISPLAY_NAME} photos, order ${orders[0].code}` : `${EVENT_DISPLAY_NAME} photos, ${orders.length} orders`;
  return compose(to, subject, paragraphs);
}

/** Sent to the photographer when a buyer submits a receipt. */
export function receiptSubmittedMail(
  to: string,
  input: { code: string; buyerName: string; amount: Pesos; gcashRef: string; duplicateRef: boolean; dashboardLink: string },
): MailDoc {
  const paragraphs: Paragraph[] = [
    { text: `${input.buyerName} sent a GCash receipt for order ${input.code} (${formatPesos(input.amount)}), reference ${input.gcashRef}.` },
  ];
  if (input.duplicateRef) {
    paragraphs.push({ text: "Warning: this reference number was already used on another order. Check your GCash history before approving." });
  }
  paragraphs.push({ text: "Check the receipt against your GCash history, then approve or reject the order.", link: { href: input.dashboardLink, label: "Open my orders" } });
  return compose(to, `Receipt to check: order ${input.code}`, paragraphs);
}

/** Sent to the buyer when the photographer approves. */
export function orderApprovedMail(to: string, input: { code: string; link: string }): MailDoc {
  return compose(to, `${EVENT_DISPLAY_NAME} photos ready, order ${input.code}`, [
    { text: `Your payment for order ${input.code} is confirmed. Your full resolution photos are ready to download.`, link: { href: input.link, label: "Download my photos" } },
    { text: "Download links on the order page last one hour each time you open it. You can come back to this link any time." },
  ]);
}

/** Sent to the buyer when the photographer rejects. */
export function orderRejectedMail(to: string, input: { code: string; reason: string; link: string }): MailDoc {
  return compose(to, `Payment not confirmed, order ${input.code}`, [
    { text: `The photographer could not confirm your payment for order ${input.code}.` },
    { text: `Reason: ${input.reason}` },
    { text: "You can upload a corrected receipt on the order page.", link: { href: input.link, label: `Open order ${input.code}` } },
  ]);
}

/** Queues one email inside a transaction or batch. */
export function queueMail(firestore: Firestore, writer: Transaction | WriteBatch, mail: MailDoc): void {
  const ref = firestore.collection(COLLECTIONS.mail).doc();
  (writer as WriteBatch).set(ref, mail);
}

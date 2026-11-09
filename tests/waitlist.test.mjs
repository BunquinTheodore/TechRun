// Run: node --test tests/waitlist.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, buildPayload, readResponse, joinWaitlist } from "../js/waitlist.js";

test("validate rejects a missing email", () => {
  assert.deepEqual(validate({ name: "Ana", email: "  " }).field, "email");
});
test("validate rejects a malformed email", () => {
  for (const email of ["ana", "ana@", "ana@site", "a b@site.com"]) assert.equal(validate({ email }).ok, false, email);
});
test("validate trims, lowercases the email and keeps an optional name", () => {
  assert.deepEqual(validate({ name: "  Ana Cruz ", email: " Ana@Site.PH " }), { ok: true, name: "Ana Cruz", email: "ana@site.ph" });
  assert.deepEqual(validate({ email: "a@b.co" }), { ok: true, name: "", email: "a@b.co" });
});
test("validate rejects an overlong name", () => {
  assert.equal(validate({ name: "x".repeat(81), email: "a@b.co" }).field, "name");
});
test("buildPayload matches the freewaitlists shape and drops an empty name", () => {
  assert.deepEqual(buildPayload({ name: "Ana", email: "a@b.co" }, "hero"), { email: "a@b.co", meta: { name: "Ana", source: "hero" } });
  assert.deepEqual(buildPayload({ name: "", email: "a@b.co" }, "hero"), { email: "a@b.co", meta: { source: "hero" } });
});
test("readResponse: 201 is a new entry, 200 is already on the list", () => {
  assert.deepEqual(readResponse(201, { success: true }), { ok: true, fresh: true });
  assert.deepEqual(readResponse(200, { success: true }), { ok: true, fresh: false });
});
test("readResponse trusts a 2xx with an empty body but not an explicit success:false", () => {
  assert.deepEqual(readResponse(201, null), { ok: true, fresh: true });
  assert.equal(readResponse(200, { success: false, error: "Waitlist closed" }).ok, false);
});
test("readResponse surfaces the API error and hides server failures", () => {
  assert.deepEqual(readResponse(400, { error: "Invalid email format" }), { ok: false, error: "Invalid email format." });
  assert.match(readResponse(503, { error: "boom" }).error, /busy/);
  assert.match(readResponse(400, null).error, /Something went wrong/);
});
test("joinWaitlist posts JSON and reports network failures", async () => {
  let seen;
  const ok = await joinWaitlist("https://x.test/w", { name: "Ana", email: "a@b.co" }, "hero", async (url, init) => {
    seen = { url, init };
    return { status: 201, json: async () => ({ success: true }) };
  });
  assert.deepEqual(ok, { ok: true, fresh: true });
  assert.equal(seen.init.method, "POST");
  assert.equal(seen.init.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(seen.init.body), { email: "a@b.co", meta: { name: "Ana", source: "hero" } });

  const orig = console.error; console.error = () => {};
  const down = await joinWaitlist("https://x.test/w", { email: "a@b.co" }, "hero", async () => { throw new TypeError("offline"); });
  console.error = orig;
  assert.equal(down.ok, false);
  assert.match(down.error, /connection/);
});

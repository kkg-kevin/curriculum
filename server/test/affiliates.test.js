const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_SETTINGS, normaliseSettings, normaliseCode, suggestCode, pickAttribution, isSelfReferral,
  commissionFor, availableFrom, commissionState, totals, firstNameOf,
} = require("../src/modules/affiliates/affiliate.rules");

test("settings fill in from the defaults and stay within bounds", () => {
  const s = normaliseSettings(null);
  assert.equal(s.periods, DEFAULT_SETTINGS.periods);
  assert.equal(s.rates.pathway, 10);
  assert.equal(s.programmes.shop, true);
  const custom = normaliseSettings({ rates: { pathway: 250, shop: -5, home_learning: "12.5" }, periods: 0, holdDays: 999, programmes: { shop: false } });
  assert.equal(custom.rates.pathway, 100);
  assert.equal(custom.rates.shop, 0);
  assert.equal(custom.rates.home_learning, 12.5);
  assert.equal(custom.periods, 1);
  assert.equal(custom.holdDays, 180);
  assert.equal(custom.programmes.shop, false);
  assert.equal(custom.programmes.pathway, true);
});

test("codes are 4–20 letters and digits, upper case", () => {
  assert.equal(normaliseCode(" amina-24 "), "AMINA24");
  assert.equal(normaliseCode("ab1"), null);
  assert.equal(normaliseCode("x".repeat(21)), null);
  assert.equal(suggestCode("Amina Wanjiru", () => 0.5), "AMINA55");
  assert.equal(suggestCode("Jo", () => 0), "JOXX10");
  assert.equal(suggestCode("", () => 0), "FRIEND10");
});

test("a typed code wins over a link; an old link stops counting", () => {
  const now = new Date("2026-11-06T12:00:00Z");
  const visit = { ref: "amina24", refAt: "2026-11-01T12:00:00Z" };
  assert.deepEqual(pickAttribution({ typedCode: "peter10", visitSource: visit, now }), { code: "PETER10", via: "code" });
  assert.deepEqual(pickAttribution({ typedCode: "", visitSource: visit, now }), { code: "AMINA24", via: "link" });
  assert.equal(pickAttribution({ visitSource: { ref: "AMINA24", refAt: "2026-09-01T12:00:00Z" }, attributionDays: 30, now }), null);
  assert.equal(pickAttribution({ typedCode: "x", visitSource: null, now }), null);
  // A link without a date still counts (older website).
  assert.deepEqual(pickAttribution({ visitSource: { ref: "AMINA24" }, now }), { code: "AMINA24", via: "link" });
});

test("an affiliate never earns from their own family", () => {
  const affiliate = { userId: "u1", email: "Amina@Example.com", phone: "0712 345 678" };
  assert.equal(isSelfReferral(affiliate, { userId: "u1" }), true);
  assert.equal(isSelfReferral(affiliate, { email: "amina@example.com" }), true);
  assert.equal(isSelfReferral(affiliate, { phone: "+254712345678" }), true);
  assert.equal(isSelfReferral(affiliate, { userId: "u2", email: "peter@example.com", phone: "0700000000" }), false);
});

test("commission: the programme's rate of money paid, for the first N periods of a subscription, once for one-offs", () => {
  const settings = normaliseSettings({ rates: { pathway: 10, bootcamp: 5 }, periods: 3 });
  assert.deepEqual(commissionFor({ settings, programme: "pathway", paidAmount: 5000, earnedSoFar: 0 }), { periodNumber: 1, baseAmount: 5000, ratePercent: 10, amount: 500 });
  assert.equal(commissionFor({ settings, programme: "pathway", paidAmount: 5000, earnedSoFar: 2 }).periodNumber, 3);
  assert.equal(commissionFor({ settings, programme: "pathway", paidAmount: 5000, earnedSoFar: 3 }), null);
  assert.equal(commissionFor({ settings, programme: "bootcamp", paidAmount: 3333, earnedSoFar: 0 }).amount, 166.65);
  assert.equal(commissionFor({ settings, programme: "bootcamp", paidAmount: 3000, earnedSoFar: 1 }), null);
  assert.equal(commissionFor({ settings, programme: "pathway", paidAmount: 0, earnedSoFar: 0 }), null, "credit-only invoices earn nothing");
  assert.equal(commissionFor({ settings: { ...settings, programmes: { ...settings.programmes, pathway: false } }, programme: "pathway", paidAmount: 5000, earnedSoFar: 0 }), null);
  assert.equal(commissionFor({ settings: { ...settings, enabled: false }, programme: "pathway", paidAmount: 5000, earnedSoFar: 0 }), null);
});

test("a commission waits, becomes available, goes into a payout, gets paid", () => {
  const paidAt = new Date("2026-11-01T10:00:00Z");
  const availableAt = availableFrom(paidAt, 14);
  assert.equal(availableAt.toISOString(), "2026-11-15T10:00:00.000Z");
  const c = { status: "pending", availableAt, payoutId: null, amount: 500 };
  assert.equal(commissionState(c, null, new Date("2026-11-10")), "waiting");
  assert.equal(commissionState(c, null, new Date("2026-11-16")), "available");
  assert.equal(commissionState({ ...c, payoutId: "p1" }, { status: "requested" }, new Date("2026-11-16")), "requested");
  assert.equal(commissionState({ ...c, payoutId: "p1" }, { status: "rejected" }, new Date("2026-11-16")), "available");
  assert.equal(commissionState({ ...c, status: "paid" }), "paid");
  assert.equal(commissionState({ ...c, status: "cancelled" }), "cancelled");
  const t = totals([
    { amount: 500, state: "waiting" }, { amount: 300, state: "available" }, { amount: 200, state: "paid" }, { amount: 999, state: "cancelled" },
  ]);
  assert.deepEqual(t, { earned: 1000, waiting: 500, available: 300, requested: 0, paid: 200 });
});

test("affiliates see a family's first name only", () => {
  assert.equal(firstNameOf("Peter Otieno"), "Peter");
  assert.equal(firstNameOf(""), "A family");
});

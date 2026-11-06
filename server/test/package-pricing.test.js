// A package priced for several periods (home-learning.pricing.js, 6 Nov 2026).
const test = require("node:test");
const assert = require("node:assert/strict");
const { resolvePricing, priceForPackage, toPublicPackage, pricesOf, sellableOnline } = require("../src/modules/home-learning/home-learning.pricing");

const pkg = (extra = {}) => ({
  id: "p1", slug: "gold", name: "Gold", childrenIncluded: 2, allowExtraChildren: true, maxChildren: 4, features: [], status: "active",
  ...resolvePricing({
    allowExtraChildren: true,
    defaultPeriod: "monthly",
    periodPrices: [
      { billingPeriod: "annually", amount: 80000, extraChildAmount: 30000 },
      { billingPeriod: "weekly", amount: 2500, extraChildAmount: 900 },
      { billingPeriod: "monthly", amount: 8000, extraChildAmount: 3000 },
    ],
  }),
  ...extra,
});

test("prices are tidied into period order, the default kept on the package itself", () => {
  const p = pkg();
  assert.deepEqual(p.periodPrices.map((x) => x.billingPeriod), ["weekly", "monthly", "annually"]);
  assert.equal(p.billingPeriod, "monthly");
  assert.equal(p.amount, 8000);
  assert.equal(p.extraChildAmount, 3000);
});

test("what's missing is named", () => {
  assert.match(resolvePricing({ periodPrices: [] }).error, /at least one period/);
  assert.match(resolvePricing({ periodPrices: [{ billingPeriod: "daily", amount: 100 }] }).error, /weekly, monthly/);
  assert.match(resolvePricing({ periodPrices: [{ billingPeriod: "weekly", amount: "" }] }).error, /weekly price/);
  assert.match(resolvePricing({ allowExtraChildren: true, periodPrices: [{ billingPeriod: "monthly", amount: 100 }] }).error, /monthly price per extra child/);
  assert.match(resolvePricing({ periodPrices: [{ billingPeriod: "monthly", amount: 1 }, { billingPeriod: "monthly", amount: 2 }] }).error, /twice/);
});

test("a family is priced on the period they choose", () => {
  const p = pkg();
  assert.deepEqual(priceForPackage(p, 2), { childCount: 2, amount: 8000, billingPeriod: "monthly" });
  assert.deepEqual(priceForPackage(p, 3, "weekly"), { childCount: 3, amount: 3400, billingPeriod: "weekly" });
  assert.deepEqual(priceForPackage(p, 4, "annually"), { childCount: 4, amount: 140000, billingPeriod: "annually" });
  assert.equal(priceForPackage(p, 2, "quarterly"), null, "not offered every 3 months");
  assert.deepEqual(priceForPackage(p, 2, "quarterly", { fallback: true }), { childCount: 2, amount: 8000, billingPeriod: "monthly" });
  assert.equal(priceForPackage(p, 5, "weekly"), null, "too many children");
});

test("a package saved before 6 Nov 2026 reads as its one price", () => {
  const old = { childrenIncluded: 1, amount: 5000, billingPeriod: "weekly", allowExtraChildren: false };
  assert.deepEqual(pricesOf(old), [{ billingPeriod: "weekly", amount: 5000, extraChildAmount: null }]);
  assert.deepEqual(priceForPackage(old, 1), { childCount: 1, amount: 5000, billingPeriod: "weekly" });
  assert.equal(sellableOnline({ ...old, billingPeriod: "daily" }), false, "a daily package isn't sold online");
});

test("the website gets every period, and the default", () => {
  const pub = toPublicPackage(pkg());
  assert.deepEqual(pub.prices.map((x) => x.billingPeriod), ["weekly", "monthly", "annually"]);
  assert.equal(pub.defaultPeriod, "monthly");
  assert.equal(pub.amount, 8000);
  assert.equal(pub.monthlyAmount, 8000);
});

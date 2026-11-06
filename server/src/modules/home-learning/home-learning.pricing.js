// Pricing rules for a Home Learning, Tech Club or pathway package.
//
// A package can be offered for several billing periods (6 Nov 2026) — weekly, monthly, every 3
// months, yearly — each at its own price (`periodPrices`: [{ billingPeriod, amount,
// extraChildAmount }]). Each price covers childrenIncluded children; when allowExtraChildren is
// on, every child beyond that adds that period's extraChildAmount, up to maxChildren. A family with
// fewer children than the package includes still pays the package price, and gets the package's
// full number of places. A family is on ONE period: the one chosen when they join.
//
// The package's own amount / billingPeriod / extraChildAmount are the price shown first (the
// "default"), kept in step with periodPrices on every save — a package saved before 6 Nov 2026 has
// only those, which read as its one price. Daily packages are no longer offered (a package saved
// now is weekly, monthly, quarterly or yearly); one made before keeps billing daily.
const CURRENCY = "KES";

// The periods a package is offered for, in the order they're shown.
const OFFERED_PERIODS = ["weekly", "monthly", "quarterly", "annually"];
const ORDER = ["daily", ...OFFERED_PERIODS];

const parseList = (value) => {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value;
};

// A package's prices, one per period, in period order: [{ billingPeriod, amount, extraChildAmount }].
function pricesOf(pkg) {
  if (!pkg) return [];
  let list = parseList(pkg.periodPrices);
  if (!Array.isArray(list) || !list.length) {
    list = [{ billingPeriod: pkg.billingPeriod || "monthly", amount: pkg.amount, extraChildAmount: pkg.extraChildAmount }];
  }
  const seen = new Set();
  return list
    .filter((p) => p && ORDER.includes(p.billingPeriod) && Number.isFinite(Number(p.amount)) && !seen.has(p.billingPeriod) && seen.add(p.billingPeriod))
    .map((p) => ({
      billingPeriod: p.billingPeriod,
      amount: Number(p.amount),
      extraChildAmount: pkg.allowExtraChildren && p.extraChildAmount != null && p.extraChildAmount !== "" ? Number(p.extraChildAmount) : null,
    }))
    .sort((a, b) => ORDER.indexOf(a.billingPeriod) - ORDER.indexOf(b.billingPeriod));
}

// The price shown first: the package's own period, else monthly, else the first.
function defaultPriceOf(pkg) {
  const prices = pricesOf(pkg);
  return prices.find((p) => p.billingPeriod === pkg?.billingPeriod) || prices.find((p) => p.billingPeriod === "monthly") || prices[0] || null;
}

// { childCount, amount, billingPeriod } for a family on `pkg` with `requested` children on
// `billingPeriod` (null = the package's default), or null when the package can't take that many
// or isn't offered for that period. `fallback`: a period it isn't offered for falls back to its
// default instead (a family keeping its own period when only its number of children changes).
function priceForPackage(pkg, requested, billingPeriod = null, { fallback = false } = {}) {
  if (!pkg) return null;
  const count = requested == null || requested === "" ? pkg.childrenIncluded : Number(requested);
  if (!Number.isInteger(count) || count < 1) return null;
  let entry = billingPeriod ? pricesOf(pkg).find((p) => p.billingPeriod === billingPeriod) : defaultPriceOf(pkg);
  if (!entry && fallback) entry = defaultPriceOf(pkg);
  if (!entry) return null;
  if (count <= pkg.childrenIncluded) return { childCount: pkg.childrenIncluded, amount: entry.amount, billingPeriod: entry.billingPeriod };
  if (!pkg.allowExtraChildren || count > pkg.maxChildren) return null;
  return { childCount: count, amount: entry.amount + (count - pkg.childrenIncluded) * (entry.extraChildAmount || 0), billingPeriod: entry.billingPeriod };
}

const PERIOD_WORD = { weekly: "weekly", monthly: "monthly", quarterly: "every 3 months", annually: "yearly" };
const periodWord = (period) => PERIOD_WORD[period] || period;

// A package's prices as typed in the package form (`periodPrices`, `defaultPeriod`), tidied:
// { periodPrices, amount, billingPeriod, extraChildAmount } ready to store — or { error } saying
// what's missing. Only weekly / monthly / quarterly / yearly. An older client sending one
// `amount` + `billingPeriod` still works (that becomes the one price).
function resolvePricing(input) {
  const extras = !!input.allowExtraChildren;
  let list = Array.isArray(input.periodPrices) ? input.periodPrices : null;
  if (!list) {
    if (input.amount == null || input.amount === "") return { error: "Enter the package's price" };
    list = [{ billingPeriod: input.billingPeriod || "monthly", amount: input.amount, extraChildAmount: input.extraChildAmount }];
  }
  const seen = new Set();
  const prices = [];
  for (const p of list) {
    if (!p || !OFFERED_PERIODS.includes(p.billingPeriod)) return { error: "A package is billed weekly, monthly, every 3 months or yearly" };
    if (seen.has(p.billingPeriod)) return { error: `The ${periodWord(p.billingPeriod)} price is entered twice` };
    seen.add(p.billingPeriod);
    const amount = Math.round(Number(p.amount));
    if (!Number.isFinite(amount) || amount <= 0) return { error: `Enter the ${periodWord(p.billingPeriod)} price` };
    let extra = null;
    if (extras) {
      extra = Math.round(Number(p.extraChildAmount));
      if (p.extraChildAmount == null || p.extraChildAmount === "" || !Number.isFinite(extra) || extra < 0) return { error: `Enter the ${periodWord(p.billingPeriod)} price per extra child` };
    }
    prices.push({ billingPeriod: p.billingPeriod, amount, extraChildAmount: extra });
  }
  if (!prices.length) return { error: "Offer the package for at least one period — weekly, monthly, every 3 months or yearly" };
  prices.sort((a, b) => ORDER.indexOf(a.billingPeriod) - ORDER.indexOf(b.billingPeriod));
  const main = prices.find((p) => p.billingPeriod === input.defaultPeriod) || prices.find((p) => p.billingPeriod === "monthly") || prices[0];
  return { periodPrices: prices, amount: main.amount, billingPeriod: main.billingPeriod, extraChildAmount: extras ? main.extraChildAmount : null };
}

// The website's view of a package — marketing fields only (no ownerAdminId, status or timestamps).
// `prices` are the periods it's offered for (never daily — billed afterwards, not on the website);
// `amount` / `billingPeriod` the one shown first (older websites read only those).
function toPublicPackage(pkg) {
  const prices = pricesOf(pkg).filter((p) => p.billingPeriod !== "daily");
  const main = prices.find((p) => p.billingPeriod === pkg.billingPeriod) || prices.find((p) => p.billingPeriod === "monthly") || prices[0] || { amount: pkg.amount, billingPeriod: pkg.billingPeriod || "monthly", extraChildAmount: pkg.extraChildAmount };
  return {
    id: pkg.id,
    slug: pkg.slug,
    name: pkg.name,
    summary: pkg.summary || "",
    description: pkg.description || "",
    childrenIncluded: pkg.childrenIncluded,
    amount: main.amount,
    billingPeriod: main.billingPeriod,
    prices,
    defaultPeriod: main.billingPeriod,
    // The website before 31 Oct 2026 read this name; only a monthly price means what it says.
    monthlyAmount: main.amount,
    currency: CURRENCY,
    allowExtraChildren: !!pkg.allowExtraChildren,
    extraChildAmount: pkg.allowExtraChildren ? main.extraChildAmount : null,
    maxChildren: pkg.maxChildren,
    features: Array.isArray(pkg.features) ? pkg.features : [],
    badge: pkg.badge || null,
  };
}

// Whether a package can be signed up for on the website: offered for a period other than daily.
const sellableOnline = (pkg) => pricesOf(pkg).some((p) => p.billingPeriod !== "daily");

module.exports = { CURRENCY, OFFERED_PERIODS, pricesOf, defaultPriceOf, priceForPackage, resolvePricing, toPublicPackage, sellableOnline, periodWord };

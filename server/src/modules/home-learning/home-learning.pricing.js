// Pricing rules for a Home Learning or Tech Club package. A package's `amount` — its price per
// `billingPeriod` (day, week, month, quarter or year; shared/utils/billing-periods.js) — covers
// childrenIncluded children; when allowExtraChildren is on, every child beyond that adds
// extraChildAmount per period, up to maxChildren. A family with fewer children than the package
// includes still pays the package price, and gets the package's full number of places.
const CURRENCY = "KES";

// { childCount, amount, billingPeriod } for a family on `pkg` with `requested` children, or null
// when the package can't take that many.
function priceForPackage(pkg, requested) {
  if (!pkg) return null;
  const count = requested == null || requested === "" ? pkg.childrenIncluded : Number(requested);
  if (!Number.isInteger(count) || count < 1) return null;
  const billingPeriod = pkg.billingPeriod || "monthly";
  if (count <= pkg.childrenIncluded) return { childCount: pkg.childrenIncluded, amount: pkg.amount, billingPeriod };
  if (!pkg.allowExtraChildren || count > pkg.maxChildren) return null;
  return { childCount: count, amount: pkg.amount + (count - pkg.childrenIncluded) * (pkg.extraChildAmount || 0), billingPeriod };
}

// The website's view of a package — marketing fields only (no ownerAdminId, status or timestamps).
function toPublicPackage(pkg) {
  return {
    id: pkg.id,
    slug: pkg.slug,
    name: pkg.name,
    summary: pkg.summary || "",
    description: pkg.description || "",
    childrenIncluded: pkg.childrenIncluded,
    amount: pkg.amount,
    billingPeriod: pkg.billingPeriod || "monthly",
    // The website before 31 Oct 2026 read this name; only a monthly price means what it says.
    monthlyAmount: pkg.amount,
    currency: CURRENCY,
    allowExtraChildren: !!pkg.allowExtraChildren,
    extraChildAmount: pkg.allowExtraChildren ? pkg.extraChildAmount : null,
    maxChildren: pkg.maxChildren,
    features: Array.isArray(pkg.features) ? pkg.features : [],
    badge: pkg.badge || null,
  };
}

module.exports = { CURRENCY, priceForPackage, toPublicPackage };

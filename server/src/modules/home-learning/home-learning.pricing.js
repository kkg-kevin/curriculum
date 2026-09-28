// Pricing rules for a Home Learning package (home_learning_packages). A package's monthlyAmount
// covers childrenIncluded children; when allowExtraChildren is on, every child beyond that adds
// extraChildAmount, up to maxChildren. A family with fewer children than the package includes still
// pays the package price, and the household gets the package's full number of places.
const CURRENCY = "KES";

// { childCount, monthlyAmount } for a household on `pkg` with `requested` children, or null when
// the package can't take that many.
function priceForPackage(pkg, requested) {
  if (!pkg) return null;
  const count = requested == null || requested === "" ? pkg.childrenIncluded : Number(requested);
  if (!Number.isInteger(count) || count < 1) return null;
  if (count <= pkg.childrenIncluded) return { childCount: pkg.childrenIncluded, monthlyAmount: pkg.monthlyAmount };
  if (!pkg.allowExtraChildren || count > pkg.maxChildren) return null;
  return { childCount: count, monthlyAmount: pkg.monthlyAmount + (count - pkg.childrenIncluded) * (pkg.extraChildAmount || 0) };
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
    monthlyAmount: pkg.monthlyAmount,
    currency: CURRENCY,
    allowExtraChildren: !!pkg.allowExtraChildren,
    extraChildAmount: pkg.allowExtraChildren ? pkg.extraChildAmount : null,
    maxChildren: pkg.maxChildren,
    features: Array.isArray(pkg.features) ? pkg.features : [],
    badge: pkg.badge || null,
  };
}

module.exports = { CURRENCY, priceForPackage, toPublicPackage };

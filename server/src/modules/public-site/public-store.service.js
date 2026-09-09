const InventoryModel = require("../settings/inventory/inventory.model");
const { slugify } = require("../../shared/utils/slugify");
const { toAbsoluteMediaUrl } = require("../../shared/utils/media-url");
const { requirePublicContentAdminId } = require("../../shared/utils/public-content");

// The public marketing site's Store section (digifunzi-landing's /store) sells physical goods —
// the Quarky robot, classroom bundles, accessories. A "store item" here is a row in the shared
// `inventory` catalog (the same catalog Projects and Courses link materials from) that an admin
// flipped to `saleStatus: "for_sale"` in the portal's Inventory panel. Only the designated
// PUBLIC_CONTENT_ADMIN_ID's for-sale items are ever served — same tenant-scoping posture as
// public pathways / projects / diagnostics (503 if that env var is unset).
//
// The projection is hand-built from a safe field set. Operational fields (the ops `category`,
// `unit`, `ownerAdminId`, stock quantities) are never exposed — a shopper sees the marketing
// copy, the price, "what you get" and the spec table, nothing else.

// `inventory` has no slug column — computed at read time from `name`, same as projects.
function computedSlug(item) {
  return slugify(item.name) || "item";
}

// Two for-sale items can share a computed slug (unlikely — inventory names are unique per
// admin, but slugify collapses punctuation). Prefer the one with an image, then a price, then
// the first — deterministic so a list and a detail lookup agree.
function pickForSlug(matches) {
  if (matches.length <= 1) return matches[0] || null;
  return matches.find((i) => i.image) || matches.find((i) => i.priceAmount != null) || matches[0];
}

function priceOf(item) {
  if (item.priceAmount == null) return null;
  return {
    amount: Number(item.priceAmount),
    currency: item.priceCurrency || "KES",
    unit: item.priceUnit || null,
    note: item.priceNote || "",
    compareAt: item.compareAtAmount == null ? null : Number(item.compareAtAmount),
  };
}

// mysql2 auto-parses JSON columns on read, but a row that was never given one holds null.
function arr(value) {
  return Array.isArray(value) ? value : [];
}

function listItem(item) {
  const highlights = arr(item.highlights);
  return {
    id: item.id,
    slug: computedSlug(item),
    name: item.name,
    tagline: item.tagline || "",
    storeCategory: item.storeCategory || null,
    badge: item.badge || "",
    stockStatus: item.stockStatus || "available",
    image: toAbsoluteMediaUrl(item.image),
    price: priceOf(item),
    highlightCount: highlights.length,
  };
}

async function forSaleItems() {
  const ownerAdminId = requirePublicContentAdminId();
  return InventoryModel.findForSaleItems(ownerAdminId);
}

const PublicStoreService = {
  // GET /api/public/store — the designated admin's for-sale inventory items, newest first,
  // slug collisions collapsed to one representative each.
  async listItems() {
    const items = await forSaleItems();

    const bySlug = new Map();
    for (const it of items) {
      const slug = computedSlug(it);
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug).push(it);
    }
    return [...bySlug.values()]
      .map(pickForSlug)
      .filter(Boolean)
      .map(listItem)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  // GET /api/public/store/:idOrSlug — list item + the full marketing detail: description,
  // highlights, "what you get" (includes), the spec table and the image gallery. Returns null
  // (→ 404) for an unknown id/slug, an item owned by a different admin, or one not for sale.
  async getItem(idOrSlug) {
    const items = await forSaleItems();

    let item = items.find((i) => i.id === idOrSlug) || null;
    if (!item) {
      item = pickForSlug(items.filter((i) => computedSlug(i) === idOrSlug));
    }
    if (!item) return null;

    return {
      ...listItem(item),
      description: item.description || "",
      highlights: arr(item.highlights),
      includes: arr(item.includes),
      specs: arr(item.specs)
        .filter((s) => s && s.label && s.value)
        .map((s) => ({ label: String(s.label), value: String(s.value) })),
      gallery: arr(item.gallery).map((src) => toAbsoluteMediaUrl(src)).filter(Boolean),
    };
  },
};

module.exports = PublicStoreService;

// Sellable inventory items — an item in the shared `inventory` catalog (robots, kits,
// accessories) can be marked "for sale" so it appears in the public marketing site's Store
// section (digifunzi-landing's /store), the same pattern as sellable Project assessments
// (20260909144200_add_sale_fields_to_assessments.js).
//
// Everything defaults to the existing internal-only behaviour: `saleStatus` is `internal`
// unless an admin explicitly flips it in the portal, and every other column is nullable. The
// public store endpoints only ever read `saleStatus = 'for_sale'` rows owned by
// PUBLIC_CONTENT_ADMIN_ID. The operational `category` column (Robots/Electronics/…) is left
// alone — the website uses its own `storeCategory` (kit/bundle/accessory).
//
// Idempotent (hasColumn guards) so a re-run or partial rollback is safe.
const COLS = [
  'saleStatus',
  'storeCategory',
  'stockStatus',
  'tagline',
  'badge',
  'priceAmount',
  'priceCurrency',
  'priceUnit',
  'priceNote',
  'compareAtAmount',
  'highlights',
  'includes',
  'specs',
  'gallery',
];

exports.up = async function up(knex) {
  const present = {};
  for (const c of COLS) present[c] = await knex.schema.hasColumn('inventory', c);

  await knex.schema.alterTable('inventory', (t) => {
    if (!present.saleStatus) {
      t.enu('saleStatus', ['internal', 'for_sale']).notNullable().defaultTo('internal');
    }
    // The website's Store filter — deliberately separate from the ops `category` enum.
    if (!present.storeCategory) t.enu('storeCategory', ['kit', 'bundle', 'accessory']).nullable();
    // Drives the buy button: "Enquire to buy" vs "Notify me when available".
    if (!present.stockStatus) {
      t.enu('stockStatus', ['available', 'preorder', 'coming_soon']).notNullable().defaultTo('available');
    }
    if (!present.tagline) t.string('tagline', 200).nullable();
    if (!present.badge) t.string('badge', 40).nullable();
    // Whole currency units (e.g. 14500 = KES 14,500). No fractional pricing, no real checkout —
    // "Enquire to buy" posts a lead and staff quote the real figure.
    if (!present.priceAmount) t.integer('priceAmount').unsigned().nullable();
    if (!present.priceCurrency) t.string('priceCurrency', 8).nullable().defaultTo('KES');
    if (!present.priceUnit) t.string('priceUnit', 30).nullable();
    if (!present.priceNote) t.string('priceNote', 300).nullable();
    // Optional "was" price for a visible discount.
    if (!present.compareAtAmount) t.integer('compareAtAmount').unsigned().nullable();
    // JSON arrays — highlights: string[]; includes ("what you get"): string[];
    // specs: {label,value}[]; gallery: string[] of image URLs beyond the main `image`.
    if (!present.highlights) t.json('highlights').nullable();
    if (!present.includes) t.json('includes').nullable();
    if (!present.specs) t.json('specs').nullable();
    if (!present.gallery) t.json('gallery').nullable();
  });

  if (!present.saleStatus) {
    await knex.schema.alterTable('inventory', (t) => t.index('saleStatus'));
  }
};

exports.down = async function down(knex) {
  const present = {};
  for (const c of COLS) present[c] = await knex.schema.hasColumn('inventory', c);
  await knex.schema.alterTable('inventory', (t) => {
    for (const c of COLS) if (present[c]) t.dropColumn(c);
  });
};

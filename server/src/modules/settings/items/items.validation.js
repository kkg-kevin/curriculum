const { z } = require("zod");
const { invoiceTypes } = require("../../billing/billing.validation");

// Settings → Items: one catalog, every item either Goods or a Service.
//   - goods:   physical things (robots, components, tools…). Linked onto Courses and Project
//              assessments as materials with a quantity, and optionally sold in the website Store.
//   - service: things you charge for that aren't physical (term fees, subscriptions, sessions).
// Both can carry an invoice price + invoice type, so either can be picked on the invoice form.
const ITEM_KINDS = ["goods", "service"];

const INVENTORY_CATEGORIES = ["Robots", "Electronics", "Components", "Consumables", "Tools", "Other"];

// --- Sell-on-the-website fields (goods only) --------------------------------------------------
// Only meaningful when `saleStatus === "for_sale"` — the item then appears in the public
// marketing site's Store (digifunzi-landing's /store). Same shape/approach as
// assessment.validation.js's saleFields.
const INVENTORY_SALE_STATUSES = ["internal", "for_sale"];
const STORE_CATEGORIES = ["kit", "bundle", "accessory"];
const STOCK_STATUSES = ["available", "preorder", "coming_soon"];

// Fields only a Goods item has. items.service.js strips them from a Service's writes, so a service
// can never be put in the Store or given a materials category.
const GOODS_ONLY_FIELDS = [
  "category", "image", "saleStatus", "storeCategory", "stockStatus", "tagline", "badge",
  "priceAmount", "priceCurrency", "priceUnit", "priceNote", "compareAtAmount",
  "highlights", "includes", "specs", "gallery",
];

const specEntrySchema = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(200),
});

// Field *shapes* only, no `.default()` — defaults belong on the create schema (below), never on
// update: `.partial()` keeps a `.default()` live, so a partial PATCH that omits a key would
// silently reset that column to its default instead of leaving it alone.
const baseFields = {
  kind:        z.enum(ITEM_KINDS),
  name:        z.string().trim().min(1, "Name is required").max(150),
  unit:        z.string().trim().min(1).max(30),
  // Rich text (TipTap HTML) for goods; plain text for services — same column either way.
  description: z.string().max(15000).nullable(),

  // Invoicing — both kinds. Picking the item on the invoice form prefills description + amount.
  defaultPrice: z.coerce.number().nonnegative().nullable(),
  invoiceType:  z.enum(invoiceTypes).nullable(),

  // Goods only.
  category:    z.enum(INVENTORY_CATEGORIES, { errorMap: () => ({ message: "Select a valid category" }) }),
  image:       z.string().nullable(),
  saleStatus:      z.enum(INVENTORY_SALE_STATUSES),
  storeCategory:   z.enum(STORE_CATEGORIES).nullable(),
  stockStatus:     z.enum(STOCK_STATUSES),
  tagline:         z.string().trim().max(200),
  badge:           z.string().trim().max(40),
  // Whole currency units — coerced so the portal's number input (a string) is accepted.
  priceAmount:     z.coerce.number().int().min(0).max(100000000).nullable(),
  priceCurrency:   z.string().trim().max(8),
  priceUnit:       z.string().trim().max(30),
  priceNote:       z.string().trim().max(300),
  compareAtAmount: z.coerce.number().int().min(0).max(100000000).nullable(),
  highlights:      z.array(z.string().trim().min(1).max(200)).max(12),
  includes:        z.array(z.string().trim().min(1).max(200)).max(20),
  specs:           z.array(specEntrySchema).max(20),
  gallery:         z.array(z.string().trim().max(500)).max(12),
};

// A visible "was" price only makes sense above the actual price. Re-applied to create + update
// (Zod can't `.partial()` a schema that already carries `.refine()`).
const compareAtRefinement = (d) =>
  d.compareAtAmount == null || d.priceAmount == null || d.compareAtAmount > d.priceAmount;
const compareAtRefinementOptions = {
  message: "Compare-at price must be higher than the price",
  path: ["compareAtAmount"],
};

// Create: every field optional with its default, so the old Inventory and Items payloads (which
// never sent `kind` or the other catalog's fields) still validate exactly as before. `kind` has
// no default here — the route decides it (see items.controller.js).
const createItemSchema = z
  .object({
    kind:        baseFields.kind.optional(),
    name:        baseFields.name,
    unit:        baseFields.unit.optional(),
    description: baseFields.description.optional().default(""),

    defaultPrice: baseFields.defaultPrice.optional().default(null),
    invoiceType:  baseFields.invoiceType.optional().default(null),

    category:    baseFields.category.optional().default("Other"),
    image:       baseFields.image.optional().default(null),
    saleStatus:      baseFields.saleStatus.optional().default("internal"),
    storeCategory:   baseFields.storeCategory.optional(),
    stockStatus:     baseFields.stockStatus.optional().default("available"),
    tagline:         baseFields.tagline.optional().default(""),
    badge:           baseFields.badge.optional().default(""),
    priceAmount:     baseFields.priceAmount.optional(),
    priceCurrency:   baseFields.priceCurrency.optional().default("KES"),
    priceUnit:       baseFields.priceUnit.optional().default(""),
    priceNote:       baseFields.priceNote.optional().default(""),
    compareAtAmount: baseFields.compareAtAmount.optional(),
    highlights:      baseFields.highlights.optional().default([]),
    includes:        baseFields.includes.optional().default([]),
    specs:           baseFields.specs.optional().default([]),
    gallery:         baseFields.gallery.optional().default([]),
  })
  .refine(compareAtRefinement, compareAtRefinementOptions);

// Update: every field optional, NO defaults — an omitted key is left untouched by the model's
// filterDefined(). `kind` may change here (Settings → Items "Move to Goods / Services"); the
// service decides whether that's allowed.
const updateItemSchema = z
  .object(Object.fromEntries(Object.entries(baseFields).map(([k, s]) => [k, s.optional()])))
  .refine(compareAtRefinement, compareAtRefinementOptions);

const listItemsQuerySchema = z.object({ kind: z.enum(ITEM_KINDS).optional() });

module.exports = {
  createItemSchema,
  updateItemSchema,
  listItemsQuerySchema,
  ITEM_KINDS,
  GOODS_ONLY_FIELDS,
  INVENTORY_CATEGORIES,
  INVENTORY_SALE_STATUSES,
  STORE_CATEGORIES,
  STOCK_STATUSES,
};

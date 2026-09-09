// One-off operational script: creates a sample inventory item owned by PUBLIC_CONTENT_ADMIN_ID
// and flipped `saleStatus: "for_sale"`, so it appears immediately in the public marketing
// site's Store section (africa.digifunzi.com/store) with a price and an "Enquire to buy"
// button. See Guide/STORE_SETUP.md and Guide/WEBSITE_INTEGRATION_CONTRACT.md §3.5/§3.6.
//
// Mirrors the copy from the old static Quarky page (digifunzi-landing/src/content/store.js,
// now retired). Safe to re-run — it skips creation if an item with the same name already
// exists.
//
// Usage (from server/):
//   node src/scripts/seedSampleStoreItem.js

require("dotenv").config();

const env = require("../config/env");
const db = require("../config/db");
const InventoryModel = require("../modules/settings/inventory/inventory.model");

const ITEM_NAME = "Quarky Robot Kit";

async function run() {
  if (!env.PUBLIC_CONTENT_ADMIN_ID) {
    console.error("PUBLIC_CONTENT_ADMIN_ID is not set in server/.env — cannot seed.");
    process.exitCode = 1;
    return;
  }

  const owner = await db("users")
    .where({ id: env.PUBLIC_CONTENT_ADMIN_ID, role: "admin" })
    .first();
  if (!owner) {
    console.error(
      `PUBLIC_CONTENT_ADMIN_ID (${env.PUBLIC_CONTENT_ADMIN_ID}) does not match any admin user — cannot seed.`,
    );
    process.exitCode = 1;
    return;
  }

  const existing = await db("inventory")
    .where({ ownerAdminId: env.PUBLIC_CONTENT_ADMIN_ID })
    .whereRaw("LOWER(name) = ?", [ITEM_NAME.toLowerCase()])
    .first();
  if (existing) {
    console.log(`An inventory item named "${existing.name}" already exists (${existing.id}) — nothing to do.`);
    console.log(`saleStatus: ${existing.saleStatus}`);
    process.exit(0);
  }

  const record = await InventoryModel.create({
    ownerAdminId: env.PUBLIC_CONTENT_ADMIN_ID,
    name: ITEM_NAME,
    category: "Robots",
    unit: "kit",
    description:
      "Quarky is a compact, rugged learning robot built for the classroom. Learners wire " +
      "sensors, drive motors and write real code to make it move, sense and react - the same " +
      "board runs through most Digifunzi projects.",
    image: null, // no image → the Store card shows a brand-blue band with the name

    // --- Selling panel ---
    saleStatus: "for_sale",
    storeCategory: "kit",
    stockStatus: "available",
    tagline: "The hands-on robot at the heart of Digifunzi",
    badge: "Core kit",
    priceAmount: 14500,
    priceCurrency: "KES",
    priceUnit: "each",
    priceNote: "School and bulk pricing available - ask us for a class-set quote.",
    compareAtAmount: null,
    highlights: [
      "Beginner-friendly block coding with a smooth path to Python",
      "Built-in sensors: light, distance, sound, motion",
      "Motor and servo ports for building custom machines",
      "Rechargeable and classroom-durable",
    ],
    includes: [
      "Quarky main board with built-in sensors",
      "USB cable and rechargeable battery",
      "Quick-start guide and access to the block editor",
      "Starter project cards",
    ],
    specs: [
      { label: "Programming", value: "Block-based editor and Python" },
      { label: "Connectivity", value: "USB and wireless" },
      { label: "Sensors", value: "Light, distance, sound, motion, temperature" },
      { label: "Power", value: "Rechargeable battery" },
      { label: "Recommended age", value: "8 and up" },
    ],
    gallery: [],
  });

  console.log("Created for-sale store item:", {
    id: record.id,
    name: record.name,
    saleStatus: record.saleStatus,
    price: `${record.priceCurrency} ${record.priceAmount}`,
  });
  console.log(
    "\nIt's live now. Check GET /api/public/store, or open /store on the landing site.\n" +
      "To edit it: Settings > Inventory > \"" +
      ITEM_NAME +
      "\" > the Selling section of the modal.",
  );
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});

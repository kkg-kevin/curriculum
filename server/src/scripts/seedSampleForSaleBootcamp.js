// One-off operational script: creates a sample Program curriculum (a bootcamp) owned by
// PUBLIC_CONTENT_ADMIN_ID and flipped `saleStatus: "for_sale"`, so it appears immediately on
// the public marketing site's Bootcamps section (africa.digifunzi.com/bootcamps) with a price
// and an "Enquire to book" button. See Guide/BOOTCAMP_SALE_SETUP.md and
// Guide/WEBSITE_INTEGRATION_CONTRACT.md §3.1/§3.2.
//
// Safe to re-run — it skips creation if a curriculum with the same name already exists.
//
// Usage (from server/):
//   node src/scripts/seedSampleForSaleBootcamp.js

require("dotenv").config();

const env = require("../config/env");
const db = require("../config/db");
const CurriculumModel = require("../modules/curriculum/curriculum.model");

const BOOTCAMP_NAME = "Robot Builders Holiday Bootcamp";

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

  const existing = await db("curricula")
    .where({ ownerAdminId: env.PUBLIC_CONTENT_ADMIN_ID, name: BOOTCAMP_NAME })
    .first();
  if (existing) {
    console.log(`A curriculum named "${BOOTCAMP_NAME}" already exists (${existing.id}) — nothing to do.`);
    console.log(`isProgram: ${existing.isProgram} · saleStatus: ${existing.saleStatus}`);
    process.exit(0);
  }

  const record = await CurriculumModel.create({
    ownerAdminId: env.PUBLIC_CONTENT_ADMIN_ID,
    name: BOOTCAMP_NAME,
    code: "RB-HOLIDAY",
    description:
      "One intensive week of hands-on robotics. Learners start with a bare Quarky board and " +
      "finish with a robot they built, coded and can drive around an obstacle course — with a " +
      "showcase for families on the last afternoon. No prior coding needed.",
    status: "active",
    isProgram: true,
    academicCycleModel: "terms",
    // --- Selling panel ---
    saleStatus: "for_sale",
    coverImage: null, // no image → the card shows a brand-blue band with the name
    saleTagline: "A full robot build, coded and driven, in one week",
    saleFormat: "holiday",
    durationLabel: "1 week",
    priceAmount: 12000,
    priceCurrency: "KES",
    priceNote: "Includes all materials and the end-of-week showcase. Sibling discount available.",
    ageMin: 9,
    ageMax: 14,
    highlights: [
      "Build a working robot from a bare board",
      "Write real code to make it move, sense and react",
      "Drive it through an obstacle course you design",
      "Showcase for families on the final afternoon",
    ],
  });

  console.log("Created for-sale bootcamp:", {
    id: record.id,
    name: record.name,
    isProgram: record.isProgram,
    saleStatus: record.saleStatus,
    price: `${record.priceCurrency} ${record.priceAmount}`,
  });

  console.log(
    "\nIt's live now. Check GET /api/public/bootcamps, or open /bootcamps on the landing site.\n" +
      "To edit it: Programs > \"" +
      BOOTCAMP_NAME +
      "\" > the Selling card. Deploy it to a hub from the same page to give it real run dates.",
  );
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});

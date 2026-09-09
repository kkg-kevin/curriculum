// One-off operational script: creates a sample Project assessment owned by
// PUBLIC_CONTENT_ADMIN_ID and flipped `saleStatus: "for_sale"`, so it appears immediately on
// the public marketing site's Projects section (africa.digifunzi.com/projects) with a price
// and an "Enquire to buy" button. See Guide/PROJECT_SALE_SETUP.md and
// Guide/WEBSITE_INTEGRATION_CONTRACT.md §3.3/§3.4.
//
// It links the "Quarky Ultimate" kit as "what you'll need" if that inventory item exists for
// the admin. Safe to re-run — it skips creation if a project with the same name already exists.
//
// Usage (from server/):
//   node src/scripts/seedSampleForSaleProject.js

require("dotenv").config();

const env = require("../config/env");
const db = require("../config/db");
const AssessmentModel = require("../modules/assessments/assessment.model");
const AssessmentInventoryLinkModel = require("../modules/assessments/assessment-inventory-link.model");

const PROJECT_NAME = "Weather Station You Can Build";

const deliverables = [
  {
    id: "d1",
    name: "A working weather station",
    description:
      "Temperature and light readings shown live on the Quarky display, updating every few seconds.",
  },
  {
    id: "d2",
    name: "A day of logged readings",
    description: "A simple table of readings taken across a day, with a note on what changed and why.",
  },
  {
    id: "d3",
    name: "A 1-minute demo video",
    description: "The learner explaining what they built and showing it react to a torch and a warm hand.",
  },
];

const milestones = [
  {
    id: "m1",
    order: 0,
    name: "Read the temperature sensor",
    description:
      "Wire the sensor, print the raw value, and figure out what number means \"room temperature\".",
  },
  {
    id: "m2",
    order: 1,
    name: "Show it on the display",
    description: "Turn the raw reading into a tidy line of text and refresh it on a loop.",
  },
  {
    id: "m3",
    order: 2,
    name: "Add the light sensor",
    description: "A second input on the same screen - bright, dim or dark.",
  },
  {
    id: "m4",
    order: 3,
    name: "Warn when it gets too hot",
    description: "A decision: above a threshold you pick, flash the LED red and buzz once.",
  },
  {
    id: "m5",
    order: 4,
    name: "Log a day of readings",
    description: "Take a reading every few minutes, write them down, and look for the pattern.",
  },
];

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

  const existing = await db("assessments")
    .where({ ownerAdminId: env.PUBLIC_CONTENT_ADMIN_ID, type: "project", name: PROJECT_NAME })
    .first();
  if (existing) {
    console.log(`A project named "${PROJECT_NAME}" already exists (${existing.id}) — nothing to do.`);
    console.log(`saleStatus: ${existing.saleStatus}`);
    process.exit(0);
  }

  const record = await AssessmentModel.create({
    ownerAdminId: env.PUBLIC_CONTENT_ADMIN_ID,
    name: PROJECT_NAME,
    type: "project",
    structureType: "structured",
    description:
      "Build a real weather station from a temperature sensor, a light sensor and a screen - " +
      "then use it to track how your room changes through the day. A great first \"sensors and " +
      "decisions\" project: no prior coding needed, and every step ends with something working.",
    overview:
      "Five short, hands-on lessons. Each one adds a single new idea - reading a sensor, showing " +
      "a value, comparing against a threshold, acting on it, logging over time - and builds " +
      "directly on the last. By the end the learner has a device they made, that does something " +
      "useful, and they can explain how every part of it works.",
    instructions:
      "Work through the milestones in order. Take your time - there's no timer. Ask for help if " +
      "a sensor won't read; that's normal and part of the learning.",
    deliverables,
    milestones,
    // --- Selling panel ---
    saleStatus: "for_sale",
    coverImage: null, // no image → the card shows a brand-blue band with the name
    saleTagline: "Build a real weather station and track how your room changes through the day",
    saleLevel: "beginner",
    priceAmount: 1800,
    priceCurrency: "KES",
    priceNote: "One-time purchase - lifetime access for one learner.",
    ageMin: 9,
    ageMax: 13,
  });

  console.log("Created for-sale project:", {
    id: record.id,
    name: record.name,
    saleStatus: record.saleStatus,
    price: `${record.priceCurrency} ${record.priceAmount}`,
  });

  // Link the Quarky kit as "what you'll need", if the admin has it in inventory.
  const kit = await db("inventory")
    .where({ ownerAdminId: env.PUBLIC_CONTENT_ADMIN_ID })
    .whereRaw("LOWER(name) LIKE ?", ["%quarky%"])
    .first();
  if (kit) {
    await AssessmentInventoryLinkModel.link(record.id, kit.id, 1);
    console.log(`Linked inventory: "${kit.name}" ×1`);
  } else {
    console.log('No "Quarky" inventory item found — skipped the "what you\'ll need" link.');
  }

  console.log(
    "\nIt's live now. Check GET /api/public/projects, or open /projects on the landing site.\n" +
      "To edit it: Assessments > \"" +
      PROJECT_NAME +
      "\" > Assessment Information tab > Selling panel.",
  );
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed failed:", err);
  process.exitCode = 1;
});

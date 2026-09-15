const { id, fk, timestamps } = require("../helpers");

// A logged learner visit to a space at a non-school hub (co_working_space / innovation_lab /
// makerspace / tech_club - see learning_hubs.hubType) - the hub charges for space usage per the
// pricing configured on that space (learning_hubs.spaces[].pricingModel/rate), and this table
// records one learner-at-one-space-on-one-day charge. This app only RECORDS that a visit
// happened (staff logs it after the fact) - no booking/calendar/check-in-check-out flow.
//
// spaceId isn't a fk() to a real table row - spaces[] is a JSON array on learning_hubs, not its
// own table - it's the space entry's own id (see learning-hub.service.js's space-id backfill).
//
// pricingModelAtLogging/rateAtLogging/priceUnitAtLogging/amount are snapshotted at the moment of
// logging (from the space's own rate, or the learner's learner_hub_links pricing override if
// set) so a later change to the space's list price never silently rewrites the charge history of
// visits already logged.
//
// billingStatus starts "unbilled"; a batched "generate charges" action (see hub-visit.service.js)
// rolls a hub's unbilled visits for a date range into one billing_invoices row per learner (one
// billing_invoice_items row per visit, tied back via that item's metadata.hubVisitId), flipping
// each visit to "invoiced" + invoiceItemId set. "waived" is the free/comp equivalent - never
// billed, kept for the hub's own record. Deliberately its own table, not a
// hub_subscription/learner_term row in billing_invoices directly - see
// server/src/modules/hub-visits/hub-visit.service.js for the full generate-charges flow.
exports.up = async function up(knex) {
  await knex.schema.createTable("hub_visits", (table) => {
    id(table);
    // Multi-tenant scope - same posture as every other root-ish table (learning_hubs, curricula,
    // courses, assessments, competitions, bootcamps).
    fk(table, "ownerAdminId").notNullable();
    fk(table, "hubId").notNullable();
    fk(table, "learnerId").notNullable();
    fk(table, "spaceId").notNullable();
    table.date("visitDate").notNullable();
    table.decimal("hours", 5, 2).nullable();
    table.string("pricingModelAtLogging", 20).notNullable();
    table.decimal("rateAtLogging", 12, 2).notNullable();
    table.string("priceUnitAtLogging", 30).notNullable();
    table.decimal("amount", 12, 2).notNullable();
    table.enu("billingStatus", ["unbilled", "invoiced", "waived"]).notNullable().defaultTo("unbilled");
    fk(table, "invoiceItemId").nullable();
    fk(table, "loggedByUserId").nullable();
    table.string("notes", 500).nullable();
    timestamps(table);
    // One row per learner+space+day - a double-click or a retried request creating two
    // revenue-bearing rows for what was really one visit. A learner visiting two different
    // spaces on the same day is two rows (allowed); the service layer also checks this up front
    // for a friendly 400 rather than leaving it to a raw SQL error.
    table.unique(["learnerId", "spaceId", "visitDate"]);
    table.index("ownerAdminId");
    table.index("hubId");
    table.index("learnerId");
    table.index("spaceId");
    table.index("visitDate");
    table.index("billingStatus");
    table.index("invoiceItemId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("hub_visits");
};

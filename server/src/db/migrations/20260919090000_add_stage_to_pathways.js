const { fk } = require("../helpers");

// A Pathway now belongs to exactly one Developmental Stage, same "belongs to one stage"
// shape Performance Bands already adopted (see 20260828100000_add_age_category_to_performance_bands.js).
// Nullable at the DB level so existing pathways aren't broken by this migration — required only
// at the Zod/service layer going forward (see competency.validation.js's pathwayFields), same
// posture as performance_bands.ageCategoryId. An existing pathway with no stage assigned yet is
// surfaced to the admin via an "orphaned pathway" banner (mirroring the existing orphaned-band
// banner) rather than a hard NOT NULL that would break on migrate.
exports.up = async function up(knex) {
  await knex.schema.alterTable("pathways", (table) => {
    fk(table, "ageCategoryId").nullable();
    table.index("ageCategoryId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("pathways", (table) => {
    table.dropColumn("ageCategoryId");
  });
};

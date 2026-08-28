const { fk } = require("../helpers");

// A Progress-Arc-purpose band (learningAreaId null) now belongs to exactly one Developmental
// Stage — see performance-band.model.js's module comment. Nullable at the DB level forever:
// Learning-Journey bands (learningAreaId + courseId set) reuse this same table and must never
// require or receive one. "Required" is enforced only at the Zod/service layer, conditioned on
// learningAreaId being null — never a hard NOT NULL here, which would break Learning-Journey
// inserts.
exports.up = async function up(knex) {
  await knex.schema.alterTable("performance_bands", (table) => {
    fk(table, "ageCategoryId").nullable();
    table.index("ageCategoryId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("performance_bands", (table) => {
    table.dropColumn("ageCategoryId");
  });
};

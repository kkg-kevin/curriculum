const { id, fk, timestamps } = require("../helpers");

// One row per anonymous website visitor's completed public BOOTCAMP diagnostic — a parallel
// table to public_diagnostic_attempts (pathways), not a shared/generalized one. Mirrors that
// table's final shape exactly (post its own two follow-up migrations —
// 20260909104300_add_items_snapshot / 20260909110000_make_lead_nullable), with bootcampId in
// place of pathwayId. Kept separate rather than generalizing the existing table to an
// entityType/entityId shape: that table already holds real attempt data in production, and a
// schema/query rewrite there carries real risk to a working feature for a change that's purely
// additive here. See public_diagnostic_attempts' own migration comment for why this is a
// standalone table at all (not assessment_submissions) — same reasoning applies unchanged.
exports.up = async function up(knex) {
  await knex.schema.createTable("public_bootcamp_diagnostic_attempts", (table) => {
    id(table);
    fk(table, "bootcampId").notNullable();
    fk(table, "assessmentId").notNullable();
    fk(table, "leadId").nullable(); // -> leads.id; nullable from the start (unlike the pathway table's original NOT NULL, later relaxed) — lead capture can fail and the report must still go out.
    table.integer("childAge").notNullable();
    table.string("childName", 150).nullable();
    table.json("answers").notNullable();
    table.json("itemsSnapshot").nullable();
    table.json("itemResults").nullable();
    table.float("totalScore").notNullable();
    table.float("maxScore").notNullable();
    table.json("indicatorBreakdown").nullable();
    table.string("ipHash", 64).nullable();
    timestamps(table, { updatedAt: false });
    table.index("bootcampId");
    table.index("leadId");
    table.index("createdAt");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("public_bootcamp_diagnostic_attempts");
};

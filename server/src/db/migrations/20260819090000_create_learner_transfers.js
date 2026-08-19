const { id, fk, timestamps } = require("../helpers");

// Write-once audit log for cross-hub transfers. Deliberately its own table rather than a
// "transferred" status left sitting on learner_hub_links — dozens of existing call sites read
// that table's rows without filtering by status, so a stale-but-present link would start
// showing a learner as still "in" a class/hub they've actually left. A transfer still does a
// real unlink of the old hub-link (the same, already-proven learner-hub-link.model.js#unlink
// path unenrollFromHub always used) — this table exists purely so "where did they come from" and
// "when" survive that delete. See learner.service.js#transferHub.
exports.up = async function up(knex) {
  await knex.schema.createTable("learner_transfers", (table) => {
    id(table);
    fk(table, "learnerId").notNullable();
    fk(table, "fromHubId").notNullable();
    fk(table, "toHubId").notNullable();
    fk(table, "fromClassId").nullable();
    fk(table, "toClassId").nullable();
    table.string("fromAdmissionNumber", 50).nullable();
    fk(table, "transferredBy").nullable();
    table.string("notes", 500).nullable();
    timestamps(table, { updatedAt: false });
    table.index(["learnerId"]);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("learner_transfers");
};

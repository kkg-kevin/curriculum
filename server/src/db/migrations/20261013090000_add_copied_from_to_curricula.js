const { fk } = require("../helpers");

// A curriculum made with "Duplicate" (see curriculum.service.js's duplicateCurriculum) remembers
// which curriculum it was copied from. Only a flag — the two are independent from then on, and it
// is left as it is when the original is later renamed or deleted. It's what the green "Copy" pill
// next to the curriculum type is drawn from.
//
// Idempotent (hasColumn guard) so a re-run or partial rollback is safe.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("curricula", "copiedFromId"))) {
    await knex.schema.alterTable("curricula", (table) => {
      fk(table, "copiedFromId").nullable();
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("curricula", "copiedFromId")) {
    await knex.schema.alterTable("curricula", (table) => {
      table.dropColumn("copiedFromId");
    });
  }
};

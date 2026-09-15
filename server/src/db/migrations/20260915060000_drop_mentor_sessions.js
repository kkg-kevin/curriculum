// The Mentor Sessions module (non-school hub revenue logging, see the 20260914110000 migration)
// was removed — this drops the table it created. down() recreates it to match, in case a
// rollback is ever run.
exports.up = async function up(knex) {
  await knex.schema.dropTableIfExists("mentor_sessions");
};

exports.down = async function down(knex) {
  const { id, fk, timestamps } = require("../helpers");
  await knex.schema.createTable("mentor_sessions", (table) => {
    id(table);
    fk(table, "ownerAdminId").notNullable();
    fk(table, "hubId").notNullable();
    fk(table, "teacherId").notNullable();
    fk(table, "learnerId").notNullable();
    table.date("sessionDate").notNullable();
    table.integer("durationMinutes").unsigned().nullable();
    table.integer("feeAmount").unsigned().nullable();
    table.string("feeCurrency", 8).notNullable().defaultTo("KES");
    table.enu("paymentStatus", ["unpaid", "paid", "waived"]).notNullable().defaultTo("unpaid");
    table.string("notes", 1000).nullable();
    timestamps(table);
    table.index("ownerAdminId");
    table.index("hubId");
    table.index("teacherId");
    table.index("learnerId");
    table.index("sessionDate");
  });
};

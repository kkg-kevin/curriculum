const { fk } = require("../helpers");

// Replaces the freeform room text label with a real reference to the new rooms table. Zero
// existing timetable_slots rows have a non-empty room value (confirmed against the dev DB), so
// this is a clean swap rather than a backfill.
exports.up = async function up(knex) {
  await knex.schema.alterTable("timetable_slots", (table) => {
    table.dropColumn("room");
    fk(table, "roomId").nullable();
    table.index("roomId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("timetable_slots", (table) => {
    table.dropColumn("roomId");
    table.string("room", 100).nullable();
  });
};

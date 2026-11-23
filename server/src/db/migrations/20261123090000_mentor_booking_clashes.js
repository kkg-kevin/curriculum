// A paid mentor session whose time a class has since taken (23 Nov 2026): the timetable wins, so the
// booking is flagged and the family picks a new time or takes a full refund
// (modules/mentor-bookings/mentor-booking.clashes.js).
//
//   clashAt       when the clash was found; null = no clash. Cleared when a new time is picked, or
//                 when the class moves away again.
//   clashReason   what the family is told.
exports.up = async function up(knex) {
  if (await knex.schema.hasColumn("mentor_bookings", "clashAt")) return;
  await knex.schema.alterTable("mentor_bookings", (t) => {
    t.datetime("clashAt").nullable();
    t.string("clashReason", 255).nullable();
    t.index("clashAt");
  });
};

exports.down = async function down(knex) {
  if (!(await knex.schema.hasColumn("mentor_bookings", "clashAt"))) return;
  await knex.schema.alterTable("mentor_bookings", (t) => {
    t.dropIndex("clashAt");
    t.dropColumn("clashAt");
    t.dropColumn("clashReason");
  });
};

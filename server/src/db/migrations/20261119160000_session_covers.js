const { id, fk, timestamps } = require("../helpers");

// Session covers (19 Nov 2026, modules/session-covers/): one educator teaches one session of
// another's class — asked for from the calendar, accepted by the cover educator.
//   status   pending (asked) → accepted | declined; accepted/pending → cancelled (by the class's
//            side, or because the session moved) | withdrawn (the cover educator pulled out)
//   date / startTime / endTime   the session's day and slot when asked (a session that moves
//            off that date cancels the cover — see SessionCoverService.keepCurrent)
//   originalTeacherId  the class's educator being covered (the asker; for a hub-arranged cover
//            the course's primary educator) — whose claim the session comes off
//   requestedByKind    educator | hub | admin
//   familiesNotifiedAt the day-before notice to the class's families has gone
//   claimId            the cover educator's claim that included this session (claims/, "covers")
// New tables have a newer collation than the older ones — never SQL-join them to older tables.
exports.up = async function up(knex) {
  if (await knex.schema.hasTable("session_covers")) return;
  await knex.schema.createTable("session_covers", (table) => {
    id(table);
    fk(table, "ownerAdminId").notNullable();
    fk(table, "hubId").nullable();
    fk(table, "classId").notNullable();
    fk(table, "courseId").notNullable();
    fk(table, "sessionId").notNullable();
    table.string("date", 10).notNullable();
    table.string("startTime", 5).nullable();
    table.string("endTime", 5).nullable();
    fk(table, "originalTeacherId").nullable();
    fk(table, "coverTeacherId").notNullable();
    table.string("requestedByKind", 10).notNullable().defaultTo("educator");
    fk(table, "requestedByUserId").nullable();
    table.string("note", 1000).nullable();
    table.string("status", 12).notNullable().defaultTo("pending");
    table.datetime("respondedAt").nullable();
    table.string("declineReason", 300).nullable();
    table.datetime("cancelledAt").nullable();
    fk(table, "cancelledByUserId").nullable();
    table.string("cancelReason", 300).nullable();
    table.datetime("familiesNotifiedAt").nullable();
    fk(table, "claimId").nullable();
    table.decimal("educatorPay", 12, 2).nullable();
    timestamps(table);
    table.index(["classId", "date"]);
    table.index(["coverTeacherId", "status"]);
    table.index(["ownerAdminId", "status"]);
    table.index("claimId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("session_covers");
};

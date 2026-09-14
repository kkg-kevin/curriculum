const { id, fk, timestamps } = require("../helpers");

// A logged mentor-learner session at a non-school hub (co_working_space / innovation_lab /
// makerspace / tech_club — see learning_hubs.hubType) — a mentor (a teacher-role account) meets
// one learner, the hub charges a fee, the hub collects and keeps the money itself. This app only
// RECORDS that: no scheduling, no availability/conflict checks, no payment processing — a session
// is logged after it already happened, same posture as attendance being marked after a class runs
// rather than booked in advance. Deliberately its own table, not a hub_subscription/learner_term
// row in billing_invoices — that table's whole shape (issuerType/payerHubId/payerUserId) means
// "a document the admin issued", i.e. money owed TO the admin; a mentor session is the opposite
// direction (money the hub earns and keeps), so reusing it would conflate two opposite money
// flows in one table. See server/src/modules/mentor-sessions/mentor-session.service.js.
exports.up = async function up(knex) {
  await knex.schema.createTable("mentor_sessions", (table) => {
    id(table);
    // Multi-tenant scope — same posture as every other root-ish table (learning_hubs, curricula,
    // courses, assessments, competitions, bootcamps).
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

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("mentor_sessions");
};

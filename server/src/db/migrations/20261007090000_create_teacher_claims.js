const { id, fk, timestamps } = require("../helpers");

// Educator claims — how an educator gets paid for a course they teach.
//
// A claim is one payment request for one (educator, class, course): either an ADVANCE (a fixed
// share of the whole course's value, before it is finished) or the FULL payment (the course's
// value less any advance already requested). It travels educator → supervisor → admin:
//
//   pending_supervisor  submitted, waiting for a supervisor
//   pending_admin       the supervisor approved it; waiting for final approval
//   approved            approved for payment, not paid yet
//   paid                paid
//   rejected            declined at either stage (rejectedStage says which), with a reason the
//                       educator sees
//
// Money is worked out when the claim is submitted and stored on the row (rate, session counts,
// amounts), so a later change to the rate, the course's sessions or the timetable never moves
// the figure someone already approved. The names are stored too: a claim is a financial record
// and must still read correctly after the educator, class or course it points at is gone.
exports.up = async function up(knex) {
  await knex.schema.createTable("teacher_claims", (table) => {
    id(table);
    fk(table, "ownerAdminId").notNullable();
    fk(table, "teacherId").notNullable();
    fk(table, "classId").notNullable();
    fk(table, "courseId").notNullable();
    fk(table, "hubId").nullable();
    table.string("claimNumber", 30).notNullable();

    table.string("teacherName", 170).notNullable();
    table.string("courseName", 255).nullable();
    table.string("className", 255).nullable();
    table.string("hubName", 150).nullable();

    table.enu("type", ["advance", "full"]).notNullable();
    table.enu("status", ["pending_supervisor", "pending_admin", "approved", "paid", "rejected"]).notNullable().defaultTo("pending_supervisor");

    table.string("currency", 3).notNullable().defaultTo("KES");
    table.decimal("sessionRate", 12, 3).notNullable();
    table.integer("sessionsTotal").notNullable().defaultTo(0);
    table.integer("sessionsDelivered").notNullable().defaultTo(0);
    table.decimal("courseAmount", 12, 2).notNullable(); // the whole course's value
    table.decimal("advanceDeducted", 12, 2).notNullable().defaultTo(0); // taken off a full claim
    table.decimal("amount", 12, 2).notNullable(); // what this claim asks to be paid

    table.string("invoiceUrl", 500).notNullable();
    table.string("invoiceFilename", 255).nullable();
    table.string("note", 500).nullable();
    // What the course's records looked like when the claim was submitted (attendance marked,
    // assignments graded, reports done) — the reviewer also sees the live picture.
    table.json("evidence").nullable();

    fk(table, "supervisorId").nullable();
    table.string("supervisorName", 150).nullable();
    table.datetime("supervisorDecidedAt").nullable();
    fk(table, "adminId").nullable();
    table.string("adminName", 150).nullable();
    table.datetime("adminDecidedAt").nullable();

    table.enu("rejectedStage", ["supervisor", "admin"]).nullable();
    table.string("rejectionReason", 1000).nullable();

    table.datetime("paidAt").nullable();
    fk(table, "paidBy").nullable();
    table.string("paymentReference", 120).nullable();

    timestamps(table);
    table.index("ownerAdminId");
    table.index("teacherId");
    table.index(["teacherId", "classId", "courseId"]);
    table.index("status");
  });

  // One row per workspace (admin): what a session pays and how big an advance is.
  await knex.schema.createTable("claim_settings", (table) => {
    id(table);
    fk(table, "ownerAdminId").notNullable();
    table.decimal("sessionRate", 12, 3).notNullable().defaultTo(904.666);
    table.integer("advancePercent").notNullable().defaultTo(30);
    table.string("currency", 3).notNullable().defaultTo("KES");
    timestamps(table);
    table.unique("ownerAdminId");
  });

  // An educator's own per-session rate, when it differs from the workspace's.
  if (!(await knex.schema.hasColumn("teachers", "sessionRate"))) {
    await knex.schema.alterTable("teachers", (table) => {
      table.decimal("sessionRate", 12, 3).nullable();
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("teachers", "sessionRate")) {
    await knex.schema.alterTable("teachers", (table) => {
      table.dropColumn("sessionRate");
    });
  }
  await knex.schema.dropTableIfExists("claim_settings");
  await knex.schema.dropTableIfExists("teacher_claims");
};

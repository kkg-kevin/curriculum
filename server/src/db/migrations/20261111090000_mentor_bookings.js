const { id, fk, timestamps } = require("../helpers");

// Mentor bookings (11 Nov 2026) — a parent books a mentor to take their child through a session
// they're stuck on (modules/mentor-bookings/). Pay first: the time is held, the invoice is paid,
// the booking is confirmed. Online, or in person at a hub's space (desk & chair) whose fee goes on
// the same invoice; a partner hub's share of that fee is owed to it and settled later.
//
//   teacher_availability_slots.dayOfWeek   + saturday, sunday (parents book evenings and weekends;
//                                          class timetables stay Monday–Friday)
//   claim_settings.mentorBookings          the booking rules and rates (Settings → Educator Pay)
//   learning_hubs.deskFeeOwner             "ours" (the workspace's own hub) | "hub" (a partner:
//                deskCollectionPercent     its desk fees, less this % kept for collecting, are owed to it)
//   pathway_packages.includedHelpSessions  mentor sessions a plan includes each billing period
//   mentor_help_requests                   a learner asks for help on a session; the parent books
//   mentor_bookings                        one booking: who, what, where, when, the money, the outcome
//   hub_settlements                        a partner hub paid (or credited) what it's owed
//   billing_invoices.invoiceType           + mentor_booking
//   teacher_claims                         + type "bookings" (a mentor claiming their held bookings —
//                                          no class or course, so those become nullable)
//
// New tables have the server's newer collation — never SQL-join them to the older ones.

const OLD_INVOICE_TYPES = ["hub_subscription", "learner_term", "course_module", "bootcamp", "hub_usage", "home_learning", "tech_club", "store_order", "pathway", "pathway_subscription"];
const NEW_INVOICE_TYPES = [...OLD_INVOICE_TYPES, "mentor_booking"];
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];
const ALL_DAYS = [...WEEKDAYS, "saturday", "sunday"];
const enumSql = (values) => values.map((v) => `'${v}'`).join(", ");

exports.up = async function up(knex) {
  await knex.raw(`ALTER TABLE teacher_availability_slots MODIFY dayOfWeek ENUM(${enumSql(ALL_DAYS)}) NOT NULL`);

  if (!(await knex.schema.hasColumn("claim_settings", "mentorBookings"))) {
    await knex.schema.alterTable("claim_settings", (t) => { t.json("mentorBookings").nullable(); });
  }
  if (!(await knex.schema.hasColumn("learning_hubs", "deskFeeOwner"))) {
    await knex.schema.alterTable("learning_hubs", (t) => {
      t.string("deskFeeOwner", 10).notNullable().defaultTo("ours");
      t.decimal("deskCollectionPercent", 5, 2).notNullable().defaultTo(0);
    });
  }
  if (!(await knex.schema.hasColumn("pathway_packages", "includedHelpSessions"))) {
    await knex.schema.alterTable("pathway_packages", (t) => { t.integer("includedHelpSessions").notNullable().defaultTo(0); });
  }

  if (!(await knex.schema.hasTable("mentor_help_requests"))) {
    await knex.schema.createTable("mentor_help_requests", (t) => {
      id(t);
      fk(t, "ownerAdminId").nullable();
      fk(t, "learnerId").notNullable();
      fk(t, "courseId").nullable();
      fk(t, "sessionId").nullable();
      t.string("courseName", 255).nullable();
      t.string("sessionTitle", 255).nullable();
      t.string("message", 1000).nullable();
      t.string("status", 12).notNullable().defaultTo("open"); // open | booked | closed
      fk(t, "bookingId").nullable();
      fk(t, "createdByUserId").nullable();
      timestamps(t);
      t.index("learnerId");
      t.index("status");
    });
  }

  if (!(await knex.schema.hasTable("mentor_bookings"))) {
    await knex.schema.createTable("mentor_bookings", (t) => {
      id(t);
      fk(t, "ownerAdminId").notNullable();
      fk(t, "learnerId").notNullable();
      fk(t, "parentUserId").nullable();
      fk(t, "teacherId").notNullable();
      fk(t, "helpRequestId").nullable();
      // What they're stuck on.
      fk(t, "courseId").nullable();
      fk(t, "sessionId").nullable();
      t.string("courseName", 255).nullable();
      t.string("sessionTitle", 255).nullable();
      t.string("topic", 1000).nullable();
      // Where and when.
      t.string("mode", 10).notNullable(); // online | hub
      fk(t, "hubId").nullable(); // the hub it's at (in person) or invoiced through (online)
      t.string("hubName", 150).nullable();
      t.string("spaceId", 64).nullable();
      t.string("spaceName", 120).nullable();
      t.string("meetingLink", 500).nullable();
      t.date("date").notNullable();
      t.string("startTime", 5).notNullable();
      t.string("endTime", 5).notNullable();
      t.integer("minutes").notNullable();
      // "date start" while it holds the mentor's time; null once cancelled — two bookings can never
      // take one mentor's time (UNIQUE below), even when two parents click at once.
      t.string("slotKey", 20).nullable();
      t.string("status", 12).notNullable(); // held | confirmed | completed | no_show | cancelled
      t.datetime("holdExpiresAt").nullable();
      t.datetime("confirmedAt").nullable();
      // The money, fixed when booked.
      fk(t, "invoiceId").nullable();
      t.string("currency", 3).notNullable().defaultTo("KES");
      t.decimal("mentorFee", 12, 2).notNullable().defaultTo(0);
      t.boolean("includedInPlan").notNullable().defaultTo(false);
      fk(t, "planSubscriptionId").nullable();
      t.decimal("deskFee", 12, 2).notNullable().defaultTo(0);
      t.string("deskFeeOwner", 10).nullable();
      t.decimal("deskCollectionPercent", 5, 2).notNullable().defaultTo(0);
      t.decimal("hubShare", 12, 2).notNullable().defaultTo(0);
      t.decimal("educatorPay", 12, 2).notNullable().defaultTo(0);
      // After it: held (completed) or the learner didn't come (no_show), and the mentor's note.
      t.text("mentorNote").nullable();
      t.datetime("markedAt").nullable();
      fk(t, "markedBy").nullable();
      // Cancelled: by whom, why, and any money to give back.
      t.datetime("cancelledAt").nullable();
      t.string("cancelledBy", 10).nullable(); // parent | mentor | staff | system
      t.string("cancelReason", 500).nullable();
      t.string("refundStatus", 10).nullable(); // due | refunded
      t.decimal("refundAmount", 12, 2).nullable();
      t.string("refundReference", 120).nullable();
      t.datetime("refundedAt").nullable();
      // Paid to the mentor (a claim), and to a partner hub (a settlement).
      fk(t, "claimId").nullable();
      fk(t, "settlementId").nullable();
      t.string("remindedFor", 10).nullable();
      fk(t, "createdByUserId").nullable();
      timestamps(t);
      t.unique(["teacherId", "slotKey"]);
      t.index("ownerAdminId");
      t.index("learnerId");
      t.index("teacherId");
      t.index("parentUserId");
      t.index("invoiceId");
      t.index("hubId");
      t.index("status");
      t.index("date");
    });
  }

  if (!(await knex.schema.hasTable("hub_settlements"))) {
    await knex.schema.createTable("hub_settlements", (t) => {
      id(t);
      fk(t, "ownerAdminId").notNullable();
      fk(t, "hubId").notNullable();
      t.decimal("amount", 12, 2).notNullable();
      t.string("currency", 3).notNullable().defaultTo("KES");
      t.string("method", 12).notNullable(); // mpesa | bank | cash | offset
      t.string("reference", 120).nullable();
      fk(t, "offsetInvoiceId").nullable();
      t.integer("bookingCount").notNullable().defaultTo(0);
      t.string("note", 500).nullable();
      fk(t, "settledBy").nullable();
      timestamps(t);
      t.index("ownerAdminId");
      t.index("hubId");
    });
  }

  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(NEW_INVOICE_TYPES)}) NOT NULL`);
  await knex.raw("ALTER TABLE teacher_claims MODIFY type ENUM('advance', 'full', 'bookings') NOT NULL");
  await knex.raw("ALTER TABLE teacher_claims MODIFY classId VARCHAR(36) NULL");
  await knex.raw("ALTER TABLE teacher_claims MODIFY courseId VARCHAR(36) NULL");
};

exports.down = async function down(knex) {
  await knex("teacher_claims").where({ type: "bookings" }).del();
  await knex.raw("ALTER TABLE teacher_claims MODIFY type ENUM('advance', 'full') NOT NULL");
  await knex("billing_invoices").where({ invoiceType: "mentor_booking" }).update({ invoiceType: "learner_term" });
  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(OLD_INVOICE_TYPES)}) NOT NULL`);
  await knex.schema.dropTableIfExists("hub_settlements");
  await knex.schema.dropTableIfExists("mentor_bookings");
  await knex.schema.dropTableIfExists("mentor_help_requests");
  if (await knex.schema.hasColumn("pathway_packages", "includedHelpSessions")) await knex.schema.alterTable("pathway_packages", (t) => t.dropColumn("includedHelpSessions"));
  if (await knex.schema.hasColumn("learning_hubs", "deskFeeOwner")) await knex.schema.alterTable("learning_hubs", (t) => { t.dropColumn("deskFeeOwner"); t.dropColumn("deskCollectionPercent"); });
  if (await knex.schema.hasColumn("claim_settings", "mentorBookings")) await knex.schema.alterTable("claim_settings", (t) => t.dropColumn("mentorBookings"));
  await knex("teacher_availability_slots").whereIn("dayOfWeek", ["saturday", "sunday"]).del();
  await knex.raw(`ALTER TABLE teacher_availability_slots MODIFY dayOfWeek ENUM(${enumSql(WEEKDAYS)}) NOT NULL`);
};

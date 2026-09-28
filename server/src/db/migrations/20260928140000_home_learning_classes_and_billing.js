const { randomUUID } = require("crypto");

// Home Learning becomes a first-class part of the class-based machinery instead of a side table
// every access check has to special-case:
//   - learning_hubs.isHomeLearning marks one auto-provisioned "Home Learning" hub per admin. Every
//     home-learning child gets a learner_hub_links row there, so tenancy (isLinkedToOwnHub), the
//     learner/teacher portals, admin edit/suspend/delete, etc. all work through the normal path.
//   - home_learning_enrollments gains gradeId/gradeName/classId. Each enrolled child gets their own
//     Class in that hub (curriculum + grade), with the educator linked to its courses — so
//     assessments, grading, attendance, reports and the Progress Arc all apply unchanged.
//   - billing_invoices gains householdId + a "home_learning" invoiceType for the monthly package.
//
// Existing enrollments predate grades, so the backfill only creates the hub + hub links (no class);
// an admin picks a grade on the Home Learning page, which provisions the class from then on.
const OLD_INVOICE_TYPES = ["hub_subscription", "learner_term", "course_module", "bootcamp", "hub_usage"];
const NEW_INVOICE_TYPES = [...OLD_INVOICE_TYPES, "home_learning"];
const enumSql = (values) => values.map((v) => `'${v}'`).join(", ");

exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("learning_hubs", "isHomeLearning"))) {
    await knex.schema.alterTable("learning_hubs", (table) => {
      table.boolean("isHomeLearning").notNullable().defaultTo(false);
      table.index(["ownerAdminId", "isHomeLearning"]);
    });
  }

  if (!(await knex.schema.hasColumn("home_learning_enrollments", "classId"))) {
    await knex.schema.alterTable("home_learning_enrollments", (table) => {
      table.string("gradeId", 100).nullable();
      table.string("gradeName", 150).nullable();
      table.string("classId", 36).nullable();
      table.index("classId");
      table.index("householdId");
    });
  }

  if (!(await knex.schema.hasColumn("billing_invoices", "householdId"))) {
    await knex.schema.alterTable("billing_invoices", (table) => {
      table.string("householdId", 36).nullable();
      table.index("householdId");
    });
  }
  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(NEW_INVOICE_TYPES)}) NOT NULL`);

  // Backfill: one Home Learning hub per admin that already has households, and a hub link for
  // every child already enrolled (admission numbers follow enrollInHub's HOME-<year>-NNN shape).
  const now = new Date();
  const year = String(now.getFullYear());
  const ownerIds = (await knex("home_learning_households").distinct("ownerAdminId")).map((r) => r.ownerAdminId);
  for (const ownerAdminId of ownerIds) {
    let hub = await knex("learning_hubs").where({ ownerAdminId, isHomeLearning: true }).first();
    if (!hub) {
      hub = {
        id: randomUUID(), name: "Home Learning", hubType: "school", code: "HOME", status: "active",
        deliveryMode: "in_person", description: "Children learning at home with a visiting educator.",
        ownerAdminId, isHomeLearning: true, createdAt: now, updatedAt: now,
      };
      await knex("learning_hubs").insert(hub);
    }
    const enrollments = await knex("home_learning_enrollments").where({ ownerAdminId });
    for (const enrollment of enrollments) {
      const existing = await knex("learner_hub_links").where({ learnerId: enrollment.learnerId, hubId: hub.id }).first();
      if (existing) continue;
      const prefix = `HOME-${year}`;
      const { count } = await knex("learner_hub_links").where("admissionNumber", "like", `${prefix}%`).count({ count: "*" }).first();
      await knex("learner_hub_links").insert({
        id: randomUUID(), learnerId: enrollment.learnerId, hubId: hub.id, classId: null,
        admissionNumber: `${prefix}-${String(Number(count) + 1).padStart(3, "0")}`,
        status: enrollment.status === "active" ? "active" : "inactive", createdAt: now, updatedAt: now,
      });
    }
    const educatorIds = [...new Set(enrollments.map((e) => e.educatorId).filter(Boolean))];
    for (const teacherId of educatorIds) {
      const linked = await knex("teacher_hub_links").where({ teacherId, hubId: hub.id }).first();
      if (!linked) await knex("teacher_hub_links").insert({ id: randomUUID(), teacherId, hubId: hub.id, createdAt: now });
    }
  }
};

exports.down = async function down(knex) {
  // Home Learning invoices must be removed/reassigned first — MySQL truncates values that aren't
  // in the target ENUM to '' rather than failing.
  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(OLD_INVOICE_TYPES)}) NOT NULL`);
  if (await knex.schema.hasColumn("billing_invoices", "householdId")) {
    await knex.schema.alterTable("billing_invoices", (table) => {
      table.dropIndex("householdId");
      table.dropColumn("householdId");
    });
  }
  if (await knex.schema.hasColumn("home_learning_enrollments", "classId")) {
    await knex.schema.alterTable("home_learning_enrollments", (table) => {
      table.dropIndex("classId");
      table.dropIndex("householdId");
      table.dropColumn("gradeId");
      table.dropColumn("gradeName");
      table.dropColumn("classId");
    });
  }
  if (await knex.schema.hasColumn("learning_hubs", "isHomeLearning")) {
    await knex.schema.alterTable("learning_hubs", (table) => {
      table.dropIndex(["ownerAdminId", "isHomeLearning"]);
      table.dropColumn("isHomeLearning");
    });
  }
};

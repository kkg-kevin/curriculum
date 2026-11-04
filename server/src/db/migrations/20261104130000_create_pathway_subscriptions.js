const { id, fk, timestamps } = require("../helpers");

// Website pathways sold by subscription (modules/pathway-subscriptions/), on the Tech Club pattern:
//   - pathway_packages: a pathway's plans (Billing → Packages → Pathways) — price per billing
//     period for `childrenIncluded` children, optional extra children up to `maxChildren`.
//     `pathwayTemplateId` is the catalogue entry the website sells (pathway_templates).
//   - pathway_subscriptions: one family on one plan of one pathway (pending → active; paused when
//     a period goes unpaid past the grace days; cancelled). Periods and invoices follow
//     shared/utils/billing-periods.js like the other packages; `accessUntil` is the last day the
//     paid periods cover.
//   - pathway_subscription_children: each child on it, with the pathway row (their stage) and the
//     course they started at.
//   - learner_pathway_access: what a learner may open on a pathway — from a subscription (until
//     `accessUntil`) or a one-off purchase (no end, accessUntil NULL). Course access checks it
//     beside the class route (pathway-access.js), so a lapse locks only that pathway's courses.
//   - billing_invoices.pathwaySubscriptionId + a "pathway_subscription" invoiceType.
// Additive only — no existing row changes.
const OLD_INVOICE_TYPES = ["hub_subscription", "learner_term", "course_module", "bootcamp", "hub_usage", "home_learning", "tech_club", "store_order", "pathway"];
const NEW_INVOICE_TYPES = [...OLD_INVOICE_TYPES, "pathway_subscription"];
const enumSql = (values) => values.map((v) => `'${v}'`).join(", ");

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("pathway_packages"))) {
    await knex.schema.createTable("pathway_packages", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "pathwayTemplateId").notNullable();
      table.string("name", 150).notNullable();
      table.string("slug", 160).notNullable();
      table.string("summary", 300).nullable();
      table.text("description").nullable();
      table.integer("childrenIncluded").notNullable().defaultTo(1);
      table.integer("amount").notNullable();
      table.boolean("allowExtraChildren").notNullable().defaultTo(false);
      table.integer("extraChildAmount").nullable();
      table.integer("maxChildren").notNullable().defaultTo(1);
      table.string("billingPeriod", 10).notNullable().defaultTo("monthly");
      table.json("features").nullable();
      table.string("badge", 40).nullable();
      table.boolean("isPublished").notNullable().defaultTo(false);
      table.string("status", 20).notNullable().defaultTo("active");
      table.integer("sortOrder").notNullable().defaultTo(0);
      timestamps(table);
      table.unique(["ownerAdminId", "slug"]);
      table.index(["pathwayTemplateId", "isPublished", "status"]);
    });
  }

  if (!(await knex.schema.hasTable("pathway_subscriptions"))) {
    await knex.schema.createTable("pathway_subscriptions", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "packageId").nullable();
      fk(table, "pathwayTemplateId").notNullable();
      fk(table, "curriculumId").notNullable();
      table.string("pathwayName", 150).notNullable();
      fk(table, "hubId").nullable();
      table.string("guardianName", 150).notNullable();
      table.string("guardianEmail", 255).nullable();
      table.string("guardianPhone", 30).nullable();
      table.integer("childCount").notNullable();
      table.integer("amount").notNullable();
      table.string("billingPeriod", 10).notNullable().defaultTo("monthly");
      table.string("billingAnchor", 10).nullable();
      table.string("billedThrough", 10).nullable();
      table.json("pendingBilling").nullable();
      table.string("accessUntil", 10).nullable();
      table.string("status", 20).notNullable().defaultTo("pending");
      table.string("source", 20).notNullable().defaultTo("website");
      fk(table, "signupInvoiceId").nullable();
      table.date("startDate").nullable();
      table.text("notes").nullable();
      table.dateTime("pausedAt").nullable();
      table.dateTime("cancelledAt").nullable();
      timestamps(table);
      table.index(["ownerAdminId", "status"]);
      table.index("pathwayTemplateId");
      table.index("guardianEmail");
    });
  }

  if (!(await knex.schema.hasTable("pathway_subscription_children"))) {
    await knex.schema.createTable("pathway_subscription_children", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "subscriptionId").notNullable();
      fk(table, "learnerId").notNullable();
      fk(table, "pathwayId").nullable();
      fk(table, "startCourseId").nullable();
      table.string("status", 20).notNullable().defaultTo("active");
      timestamps(table);
      table.index("subscriptionId");
      table.index("learnerId");
    });
  }

  if (!(await knex.schema.hasTable("learner_pathway_access"))) {
    await knex.schema.createTable("learner_pathway_access", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "learnerId").notNullable();
      fk(table, "curriculumId").notNullable();
      fk(table, "pathwayTemplateId").nullable();
      table.string("pathwayName", 150).notNullable();
      table.string("source", 20).notNullable();
      fk(table, "subscriptionId").nullable();
      fk(table, "invoiceId").nullable();
      table.string("accessUntil", 10).nullable();
      table.string("status", 20).notNullable().defaultTo("active");
      timestamps(table);
      table.index("learnerId");
      table.index("subscriptionId");
    });
  }

  if (!(await knex.schema.hasColumn("billing_invoices", "pathwaySubscriptionId"))) {
    await knex.schema.alterTable("billing_invoices", (table) => {
      fk(table, "pathwaySubscriptionId").nullable();
      table.index("pathwaySubscriptionId");
    });
  }
  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(NEW_INVOICE_TYPES)}) NOT NULL`);
};

exports.down = async function down(knex) {
  await knex("billing_invoices").where({ invoiceType: "pathway_subscription" }).update({ invoiceType: "pathway" });
  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(OLD_INVOICE_TYPES)}) NOT NULL`);
  if (await knex.schema.hasColumn("billing_invoices", "pathwaySubscriptionId")) {
    await knex.schema.alterTable("billing_invoices", (table) => { table.dropIndex("pathwaySubscriptionId"); table.dropColumn("pathwaySubscriptionId"); });
  }
  for (const t of ["learner_pathway_access", "pathway_subscription_children", "pathway_subscriptions", "pathway_packages"]) {
    await knex.schema.dropTableIfExists(t);
  }
};

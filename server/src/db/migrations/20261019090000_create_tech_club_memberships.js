const { id, fk, timestamps } = require("../helpers");

// Estate Tech Clubs get the same website sign-up Home Learning has (see modules/tech-clubs/):
// a parent picks a club on the website, chooses a package, and creates their own login plus a
// login per child — locked until an admin approves the first month's payment, after which the
// admin places each child in one of the club's classes.
//
//   - club_packages: what a club membership costs (same pricing shape as home_learning_packages —
//     monthlyAmount covers childrenIncluded children, optional extra children up to maxChildren).
//     `hubIds` limits a package to some clubs; empty = every club. Kept apart from
//     home_learning_packages so Home Learning's packages, slugs and website stay exactly as they are.
//   - club_memberships: one family at one club, billed monthly (status pending → active, or
//     cancelled when an admin declines a sign-up).
//   - club_membership_children: each child in a membership, and the club class they were placed
//     in (NULL while awaiting placement).
//   - billing_invoices.clubMembershipId + a "tech_club" invoiceType for the monthly invoice.
//   - leads.clubMembershipId: the enquiry recorded for staff when a family signs up.
//
// Additive only — no existing row changes.
const OLD_INVOICE_TYPES = ["hub_subscription", "learner_term", "course_module", "bootcamp", "hub_usage", "home_learning"];
const NEW_INVOICE_TYPES = [...OLD_INVOICE_TYPES, "tech_club"];
const enumSql = (values) => values.map((v) => `'${v}'`).join(", ");

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("club_packages"))) {
    await knex.schema.createTable("club_packages", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      table.string("name", 150).notNullable();
      table.string("slug", 160).notNullable();
      table.string("summary", 300).nullable();
      table.text("description").nullable();
      table.integer("childrenIncluded").notNullable();
      table.integer("monthlyAmount").notNullable();
      table.boolean("allowExtraChildren").notNullable().defaultTo(false);
      table.integer("extraChildAmount").nullable();
      table.integer("maxChildren").notNullable();
      table.json("features").nullable();
      table.string("badge", 40).nullable();
      table.json("hubIds").nullable();
      table.boolean("isPublished").notNullable().defaultTo(false);
      table.string("status", 20).notNullable().defaultTo("active");
      table.integer("sortOrder").notNullable().defaultTo(0);
      timestamps(table);
      table.unique(["ownerAdminId", "slug"]);
      table.index(["ownerAdminId", "isPublished", "status"]);
    });
  }

  if (!(await knex.schema.hasTable("club_memberships"))) {
    await knex.schema.createTable("club_memberships", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "hubId").notNullable();
      fk(table, "packageId").nullable();
      table.string("guardianName", 150).notNullable();
      table.string("guardianEmail", 255).nullable();
      table.string("guardianPhone", 30).nullable();
      table.integer("childCount").notNullable();
      table.integer("monthlyAmount").notNullable();
      table.string("status", 20).notNullable().defaultTo("pending");
      table.string("source", 20).notNullable().defaultTo("website");
      fk(table, "signupInvoiceId").nullable();
      table.date("startDate").nullable();
      table.text("notes").nullable();
      timestamps(table);
      table.index(["ownerAdminId", "status"]);
      table.index("hubId");
      table.index("packageId");
      table.index("guardianEmail");
    });
  }

  if (!(await knex.schema.hasTable("club_membership_children"))) {
    await knex.schema.createTable("club_membership_children", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "membershipId").notNullable();
      fk(table, "learnerId").notNullable();
      fk(table, "classId").nullable();
      table.string("status", 20).notNullable().defaultTo("active");
      table.string("placementNotes", 255).nullable();
      timestamps(table);
      table.index("membershipId");
      table.index("learnerId");
      table.index("classId");
    });
  }

  if (!(await knex.schema.hasColumn("billing_invoices", "clubMembershipId"))) {
    await knex.schema.alterTable("billing_invoices", (table) => {
      table.string("clubMembershipId", 36).nullable();
      table.index("clubMembershipId");
    });
  }
  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(NEW_INVOICE_TYPES)}) NOT NULL`);

  if (!(await knex.schema.hasColumn("leads", "clubMembershipId"))) {
    await knex.schema.alterTable("leads", (table) => {
      table.string("clubMembershipId", 36).nullable();
      table.index("clubMembershipId");
    });
  }
};

exports.down = async function down(knex) {
  // Tech Club invoices must be removed/reassigned first — MySQL truncates values that aren't in
  // the target ENUM to '' rather than failing.
  if (await knex.schema.hasColumn("leads", "clubMembershipId")) {
    await knex.schema.alterTable("leads", (table) => {
      table.dropIndex("clubMembershipId");
      table.dropColumn("clubMembershipId");
    });
  }
  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(OLD_INVOICE_TYPES)}) NOT NULL`);
  if (await knex.schema.hasColumn("billing_invoices", "clubMembershipId")) {
    await knex.schema.alterTable("billing_invoices", (table) => {
      table.dropIndex("clubMembershipId");
      table.dropColumn("clubMembershipId");
    });
  }
  await knex.schema.dropTableIfExists("club_membership_children");
  await knex.schema.dropTableIfExists("club_memberships");
  await knex.schema.dropTableIfExists("club_packages");
};

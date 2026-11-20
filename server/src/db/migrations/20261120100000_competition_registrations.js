const { id, fk } = require("../helpers");

// Competitions: information, entry and registration (20 Nov 2026).
//
//   competitions.info  JSON — the "Competition information" section shown after the description:
//     { ageMin, ageMax, eligibilityNote, entryModes: ["individual","group"], mode: online|in_person|both,
//       venue, milestones: [{ label, date }], prizes: [string], extras: [{ label, value }] }
//   Existing competitions get entryModes from their old single `format` (individual → individual;
//   pairs / team → group; none → both). The old column stays, unused by new screens.
//
//   Tracks (still the competitions.tracks JSON) gain their own detail page and entry settings —
//   see competition.validation.js; nothing to migrate, every new field is optional.
//
//   competition_registrations — one per individual or team entry made on the website:
//     entryType individual | group; the person registering (contact*); the team name and school;
//     participants [{ name, dateOfBirth, school }]; the fee (amount, currency) on one invoice
//     (invoiceType "competition", billed to the contact); status pending_payment → confirmed (paid,
//     or a free track) | cancelled. `token` is private (the registration's own link). No accounts
//     are created (user's choice) — an enquiry (leads.source "competition") is made for follow-up.
// New tables have a newer collation than the older ones — never SQL-join them to older tables.

const OLD_INVOICE_TYPES = ["hub_subscription", "learner_term", "course_module", "bootcamp", "hub_usage", "home_learning", "tech_club", "store_order", "pathway", "pathway_subscription", "mentor_booking"];
const NEW_INVOICE_TYPES = [...OLD_INVOICE_TYPES, "competition"];
const OLD_LEAD_SOURCES = ["enroll", "contact", "diagnostic", "event"];
const NEW_LEAD_SOURCES = [...OLD_LEAD_SOURCES, "competition"];
const OLD_SEQUENCE_SCOPES = ["invoice", "receipt", "order"];
const NEW_SEQUENCE_SCOPES = [...OLD_SEQUENCE_SCOPES, "competition_registration"];
const enumSql = (values) => values.map((v) => `'${v}'`).join(", ");

function entryModesFromFormat(format) {
  if (format === "individual") return ["individual"];
  if (format === "pairs" || format === "team") return ["group"];
  return ["individual", "group"];
}

exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("competitions", "info"))) {
    await knex.schema.alterTable("competitions", (t) => { t.json("info").nullable(); });
    const rows = await knex("competitions").select("id", "format");
    for (const row of rows) {
      const info = { entryModes: entryModesFromFormat(row.format) };
      await knex("competitions").where({ id: row.id }).update({ info: JSON.stringify(info) });
    }
  }

  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(NEW_INVOICE_TYPES)}) NOT NULL`);
  await knex.raw(`ALTER TABLE leads MODIFY source ENUM(${enumSql(NEW_LEAD_SOURCES)}) NOT NULL`);
  // Registration numbers (CR-2026-000123) count up per year like invoice and order numbers.
  await knex.raw(`ALTER TABLE billing_number_sequences MODIFY COLUMN scope ENUM(${enumSql(NEW_SEQUENCE_SCOPES)}) NOT NULL`);

  if (!(await knex.schema.hasTable("competition_registrations"))) {
    await knex.schema.createTable("competition_registrations", (t) => {
      id(t);
      fk(t, "ownerAdminId").notNullable();
      fk(t, "competitionId").notNullable();
      t.string("registrationNumber", 30).notNullable();
      t.string("trackId", 64).notNullable();
      t.string("trackName", 150).notNullable();
      t.string("entryType", 20).notNullable(); // individual | group
      t.string("teamName", 150).nullable();
      t.string("organisation", 200).nullable();
      t.string("contactName", 150).notNullable();
      t.string("contactEmail", 255).notNullable();
      t.string("contactPhone", 40).notNullable();
      t.string("contactRole", 20).nullable(); // parent | teacher | school | participant | other
      t.json("participants").notNullable();
      t.integer("participantCount").notNullable().defaultTo(1);
      t.decimal("amount", 12, 2).notNullable().defaultTo(0);
      t.string("currency", 8).notNullable().defaultTo("KES");
      fk(t, "invoiceId").nullable();
      fk(t, "leadId").nullable();
      fk(t, "hubId").nullable();
      t.string("status", 20).notNullable().defaultTo("pending_payment"); // pending_payment | confirmed | cancelled
      t.datetime("confirmedAt").nullable();
      t.datetime("cancelledAt").nullable();
      t.string("cancelReason", 500).nullable();
      fk(t, "cancelledBy").nullable();
      t.string("token", 64).notNullable();
      t.json("visitSource").nullable();
      t.datetime("createdAt").notNullable();
      t.datetime("updatedAt").nullable();
      t.unique(["token"]);
      t.unique(["registrationNumber"]);
      t.index(["competitionId", "status"]);
      t.index("ownerAdminId");
      t.index("invoiceId");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("competition_registrations");
  await knex("billing_number_sequences").where({ scope: "competition_registration" }).del();
  await knex.raw(`ALTER TABLE billing_number_sequences MODIFY COLUMN scope ENUM(${enumSql(OLD_SEQUENCE_SCOPES)}) NOT NULL`);
  await knex("leads").where({ source: "competition" }).update({ source: "enroll" });
  await knex.raw(`ALTER TABLE leads MODIFY source ENUM(${enumSql(OLD_LEAD_SOURCES)}) NOT NULL`);
  await knex.raw(`ALTER TABLE billing_invoices MODIFY invoiceType ENUM(${enumSql(OLD_INVOICE_TYPES)}) NOT NULL`);
  if (await knex.schema.hasColumn("competitions", "info")) {
    await knex.schema.alterTable("competitions", (t) => { t.dropColumn("info"); });
  }
};

const { timestamps } = require("../helpers");

// Enquiry housekeeping (27 Oct 2026; leads/lead.housekeeping.js): a daily reminder about
// enquiries left New, closing enquiries nobody has touched for a long time, and removing the
// personal details of old closed ones (data protection) — each switchable.
//
//   leads.autoClosedAt   when the daily job closed it for inactivity (it can be reopened).
//   leads.anonymisedAt   when its personal details were removed (name, email, phone, child's
//                        name, message and its replies / notes); what's left still counts in
//                        reports (source, interest, how they found us, dates, paid or not).
//   enquiry_settings     one row for the installation (id "default") — enquiries aren't kept per
//                        workspace: every admin sees every enquiry from the website.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("leads", "autoClosedAt"))) {
    await knex.schema.alterTable("leads", (table) => table.datetime("autoClosedAt").nullable());
  }
  if (!(await knex.schema.hasColumn("leads", "anonymisedAt"))) {
    await knex.schema.alterTable("leads", (table) => table.datetime("anonymisedAt").nullable());
  }
  if (!(await knex.schema.hasTable("enquiry_settings"))) {
    await knex.schema.createTable("enquiry_settings", (table) => {
      table.string("id", 36).primary();
      table.json("settings").nullable();
      table.string("updatedBy", 36).nullable();
      timestamps(table);
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("enquiry_settings");
  for (const column of ["autoClosedAt", "anonymisedAt"]) {
    if (await knex.schema.hasColumn("leads", column)) await knex.schema.alterTable("leads", (table) => table.dropColumn(column));
  }
};

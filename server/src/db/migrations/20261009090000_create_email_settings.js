const { id, fk, timestamps } = require("../helpers");

// Which emails a workspace sends at all. One row per workspace (admin), written the first time
// the admin switches something off — a workspace with no row sends everything.
//
// disabledTypes is a list of email types (see modules/notifications/email-types.js): the emailed
// notifications, plus the automatic invoice and receipt emails. This sits above each person's own
// choices (users.emailPreferences): a type the workspace has switched off is not sent to anyone
// in it, whatever they have chosen for themselves.
exports.up = async function up(knex) {
  await knex.schema.createTable("email_settings", (table) => {
    id(table);
    fk(table, "ownerAdminId").notNullable();
    table.json("disabledTypes").nullable();
    timestamps(table);
    table.unique(["ownerAdminId"]);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("email_settings");
};

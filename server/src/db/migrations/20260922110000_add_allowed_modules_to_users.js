// A collaborator (see 20260914090000_add_collaborator_role.js) previously got all-or-nothing
// tenant access: every module except DELETE. allowedModules narrows that to a per-module
// allowlist an admin configures at invite time or later — see scope.middleware.js's
// attachOwnRecords for how a request's path resolves to a module key and gets checked against
// this list, and admin-tools/module-registry.js for the canonical set of valid keys. NULL (not
// an empty array) is the "legacy/unconfigured" sentinel, treated as "every module" everywhere
// this is read — see collaborator.service.js and scope.middleware.js — so a collaborator invited
// before this feature existed isn't silently locked out on deploy. A newly-invited collaborator
// from here on always gets an explicit array; NULL only ever occurs on pre-existing rows.
exports.up = async function up(knex) {
  await knex.schema.alterTable("users", (table) => {
    table.json("allowedModules").nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("users", (table) => {
    table.dropColumn("allowedModules");
  });
};

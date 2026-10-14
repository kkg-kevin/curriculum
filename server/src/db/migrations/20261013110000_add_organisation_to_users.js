const { fk } = require("../helpers");

// One organisation, several equal admins. Until now every admin was a tenant of their own: the
// `ownerAdminId` on every piece of content was that admin's user id, so two admins never saw each
// other's data. `users.organisationId` lets admins share one pool instead — an admin with it set
// works on THAT key's data (scope.middleware.js: req.ownerAdminId = organisationId || own id), so
// every admin of an organisation sees, creates, edits and deletes the same content, and no admin
// "holds" it. The key is the id of the organisation's first admin, which is why none of the
// `ownerAdminId` columns needed renaming or rewriting for that admin's existing data.
//
// Null (every existing account) = unchanged behaviour: that admin is still on their own. Admins
// are joined, and their existing data folded together, by scripts/mergeOrganisation.js.
//
// `curricula.mergedFromAdminId` records which admin a curriculum belonged to before such a merge,
// so the public website keeps preferring the organisation's original curricula when a merged-in
// one carries pathways of the same name (public-site.service.js).
//
// Idempotent (hasColumn guards) so a re-run or partial rollback is safe.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("users", "organisationId"))) {
    await knex.schema.alterTable("users", (table) => {
      fk(table, "organisationId").nullable();
    });
  }
  if (!(await knex.schema.hasColumn("curricula", "mergedFromAdminId"))) {
    await knex.schema.alterTable("curricula", (table) => {
      fk(table, "mergedFromAdminId").nullable();
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("users", "organisationId")) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("organisationId");
    });
  }
  if (await knex.schema.hasColumn("curricula", "mergedFromAdminId")) {
    await knex.schema.alterTable("curricula", (table) => {
      table.dropColumn("mergedFromAdminId");
    });
  }
};

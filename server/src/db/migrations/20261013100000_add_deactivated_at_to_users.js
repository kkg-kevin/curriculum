// Settings → People & sharing → Users lets a workspace's owner switch any login in it off without
// deleting it (see modules/admin-tools/workspace-users.service.js). `deactivatedAt` set = that
// account can't sign in (auth.service.js's login) and its open sessions were ended at the moment
// it was switched off; null (every existing account) = unchanged behaviour.
//
// Separate from a hub / educator / learner being "suspended" (their own record's status): a
// suspended account still signs in and sees a read-only portal; a deactivated login doesn't get in.
//
// Idempotent (hasColumn guard) so a re-run or partial rollback is safe.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("users", "deactivatedAt"))) {
    await knex.schema.alterTable("users", (table) => {
      table.datetime("deactivatedAt", { precision: 3 }).nullable();
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("users", "deactivatedAt")) {
    await knex.schema.alterTable("users", (table) => {
      table.dropColumn("deactivatedAt");
    });
  }
};

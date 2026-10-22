// One login, more than one role — e.g. an admin who also teaches. users.role stays the account's
// own (first) role; users.extraRoles lists the others it may sign in as (["teacher"], …), added
// when the same email is given a teacher, learning-hub or parent login (see
// modules/auth/account-roles.js). Each session carries the role chosen at sign-in.
//
// Additive and idempotent (hasColumn guard).

exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("users", "extraRoles"))) {
    await knex.schema.alterTable("users", (t) => t.json("extraRoles").nullable());
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("users", "extraRoles")) {
    await knex.schema.alterTable("users", (t) => t.dropColumn("extraRoles"));
  }
};

// Staff can see a child's own login password again (learner page → Login): each learner login's
// password is kept here, encrypted (auth/learner-password-vault.js), next to its one-way hash on
// users. A table of its own rather than a column on users, so it can never ride along in any of
// the many places a user row is sent back. Only children's username logins are kept — never a
// parent's, staff's or admin's. Passwords set before this existed can't be shown (only their hash
// was ever stored) until they're set again.
exports.up = async function up(knex) {
  if (await knex.schema.hasTable("learner_login_secrets")) return;
  await knex.schema.createTable("learner_login_secrets", (t) => {
    t.string("userId", 36).primary();
    t.text("sealed").notNullable();
    t.timestamp("updatedAt").notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("learner_login_secrets");
};

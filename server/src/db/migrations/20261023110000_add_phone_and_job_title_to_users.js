// An admin's own profile (My profile, /profile): a phone number and a job title, both optional and
// set by the admin themselves. Additive and idempotent (hasColumn guards).

exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("users", "phone"))) {
    await knex.schema.alterTable("users", (t) => t.string("phone", 30).nullable());
  }
  if (!(await knex.schema.hasColumn("users", "jobTitle"))) {
    await knex.schema.alterTable("users", (t) => t.string("jobTitle", 100).nullable());
  }
};

exports.down = async function down(knex) {
  for (const column of ["jobTitle", "phone"]) {
    if (await knex.schema.hasColumn("users", column)) {
      await knex.schema.alterTable("users", (t) => t.dropColumn(column));
    }
  }
};

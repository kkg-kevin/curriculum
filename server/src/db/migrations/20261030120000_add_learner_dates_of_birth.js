// The website asks for a child's date of birth instead of an age (30 Oct 2026). Kept on the
// enquiry and on a diagnostic attempt, next to the age it gave at the time.
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn("leads", "learnerDateOfBirth"))) {
    await knex.schema.alterTable("leads", (table) => {
      table.date("learnerDateOfBirth").nullable();
    });
  }
  if (!(await knex.schema.hasColumn("public_diagnostic_attempts", "childDateOfBirth"))) {
    await knex.schema.alterTable("public_diagnostic_attempts", (table) => {
      table.date("childDateOfBirth").nullable();
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn("public_diagnostic_attempts", "childDateOfBirth")) {
    await knex.schema.alterTable("public_diagnostic_attempts", (table) => table.dropColumn("childDateOfBirth"));
  }
  if (await knex.schema.hasColumn("leads", "learnerDateOfBirth")) {
    await knex.schema.alterTable("leads", (table) => table.dropColumn("learnerDateOfBirth"));
  }
};

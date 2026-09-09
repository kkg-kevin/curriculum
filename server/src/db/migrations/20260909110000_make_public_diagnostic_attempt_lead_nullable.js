// The public diagnostic no longer captures a lead at submit time — the anonymous visitor sees
// their graded report immediately with nothing asked upfront, and enrols later via the normal
// /enroll form (see public-diagnostic.service.js). So an attempt row can now exist with no
// associated lead. `leadId` becomes nullable; existing rows (which all have one) are untouched.
//
// Column type matches the original fk() helper: table.string(name, 36).
exports.up = async function up(knex) {
  await knex.schema.alterTable("public_diagnostic_attempts", (table) => {
    table.string("leadId", 36).nullable().alter();
  });
};

exports.down = async function down(knex) {
  // A straight .notNullable().alter() would fail on any null-leadId row, so clear those first.
  await knex("public_diagnostic_attempts").whereNull("leadId").del();
  await knex.schema.alterTable("public_diagnostic_attempts", (table) => {
    table.string("leadId", 36).notNullable().alter();
  });
};

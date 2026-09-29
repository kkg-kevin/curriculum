// Families can now sign up for Home Learning on the website (POST /api/public/home-learning/signups
// — see home-learning-signup.service.js) instead of only enquiring:
//   - home_learning_enrollments.curriculumId becomes nullable: a child who signed up on the website
//     is in the household straight away but "awaiting placement" until an admin chooses their
//     curriculum, grade (their class) and educator. placementNotes keeps what the parent told us
//     (current school / grade) to help with that.
//   - home_learning_households.source ("admin" | "website") and signupInvoiceId (the first-month
//     invoice raised at sign-up, which the admin's "Approve payment" is recorded against).
// Additive only: existing rows keep their curriculum and get source "admin".
exports.up = async function up(knex) {
  await knex.schema.alterTable("home_learning_enrollments", (table) => {
    table.string("curriculumId", 36).nullable().alter();
    table.string("placementNotes", 255).nullable();
  });
  await knex.schema.alterTable("home_learning_households", (table) => {
    table.string("source", 20).notNullable().defaultTo("admin");
    table.string("signupInvoiceId", 36).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("home_learning_households", (table) => {
    table.dropColumn("signupInvoiceId");
    table.dropColumn("source");
  });
  // Rows still awaiting placement (NULL curriculum) must be placed or removed before this runs.
  await knex.schema.alterTable("home_learning_enrollments", (table) => {
    table.dropColumn("placementNotes");
    table.string("curriculumId", 36).notNullable().alter();
  });
};

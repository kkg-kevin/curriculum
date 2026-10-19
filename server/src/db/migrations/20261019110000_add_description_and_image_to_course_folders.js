// A course folder gets a short description and a cover image, shown on its card on the Courses
// page (the image fills the card's top panel, like a course's cover). Both optional; additive only.
exports.up = async function up(knex) {
  await knex.schema.alterTable("course_folders", (table) => {
    table.text("description").nullable();
    table.string("coverImage", 2048).nullable();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("course_folders", (table) => {
    table.dropColumn("coverImage");
    table.dropColumn("description");
  });
};

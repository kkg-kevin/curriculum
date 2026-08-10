const { id, fk, timestamps } = require("../helpers");

// Missed in the original schema pass — curriculum-competency-indicator.model.js turned out to
// have live, mounted routes (curriculum.routes.js's /:id/competencies/links/:competencyId/
// indicators) even though no client UI calls them today, so this needs a real table rather
// than being excluded like the confirmed-dead assessment.model.js legacy view.
exports.up = async function up(knex) {
  await knex.schema.createTable("curriculum_competency_indicators", (table) => {
    id(table);
    fk(table, "curriculumId").notNullable();
    fk(table, "competencyId").notNullable();
    table.string("name", 150).notNullable();
    table.string("description", 300).nullable();
    table.float("weight").notNullable().defaultTo(0);
    timestamps(table);
    table.index(["curriculumId", "competencyId"]);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("curriculum_competency_indicators");
};

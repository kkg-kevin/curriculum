const { id, fk, timestamps } = require("../helpers");

// Unsaved work in the assessment builder (see modules/assessments/drafts/). The builder writes
// the form here as it is typed, so nothing is lost if the page closes before Save — and because
// it's in the workspace rather than one browser, several people sharing one account each keep
// their own draft, and any of them can carry one on from the Assessments page.
//
// assessmentId is null for an assessment that hasn't been saved yet, and the assessment being
// edited otherwise. content is the builder's whole form, as is — it's only validated when the
// assessment itself is saved. name and type are copied out of it for the Assessments page list.
// revision goes up by one on every write: a write that names an older revision is refused, so two
// people carrying on the same draft can't silently overwrite each other (the builder keeps the
// second one's work as a separate draft instead).
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("assessment_drafts"))) {
    await knex.schema.createTable("assessment_drafts", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "assessmentId").nullable();
      table.string("type", 20).notNullable();
      table.string("name", 150).notNullable().defaultTo("");
      table.json("content").nullable();
      table.integer("revision").notNullable().defaultTo(1);
      fk(table, "lastEditedBy").nullable();
      timestamps(table);
      table.index("ownerAdminId");
      table.index("assessmentId");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("assessment_drafts");
};

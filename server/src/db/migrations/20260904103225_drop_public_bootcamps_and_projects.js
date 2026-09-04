// Website Content (Bootcamps/Projects) admin authoring — API and client UI — is removed. Both
// tables had zero real rows in every environment this was checked against before writing this
// migration. Pathways (GET /api/public/pathways) are unaffected — those read from
// pathway_templates, a different table entirely.
exports.up = async function up(knex) {
  await knex.schema.dropTableIfExists("public_projects");
  await knex.schema.dropTableIfExists("public_bootcamps");
};

exports.down = async function down(knex) {
  const { id, timestamps } = require("../helpers");
  await knex.schema
    .createTable("public_bootcamps", (table) => {
      id(table);
      table.string("name", 150).notNullable();
      table.string("slug", 160).notNullable().unique();
      table.text("description").notNullable();
      table.string("coverImage", 500).nullable();
      table.enu("status", ["upcoming", "active", "completed"]).notNullable().defaultTo("upcoming");
      table.date("startDate").nullable();
      table.date("endDate").nullable();
      table.string("educationLevel", 50).nullable();
      table.string("gradeFrom", 30).nullable();
      table.string("gradeTo", 30).nullable();
      table.json("classes").nullable();
      table.json("courses").nullable();
      table.boolean("isPublished").notNullable().defaultTo(true);
      timestamps(table);
      table.index("slug");
      table.index("status");
      table.index("isPublished");
    })
    .createTable("public_projects", (table) => {
      id(table);
      table.string("name", 150).notNullable();
      table.string("slug", 160).notNullable().unique();
      table.text("description").notNullable();
      table.string("coverImage", 500).nullable();
      table.integer("ageMin").nullable();
      table.integer("ageMax").nullable();
      table.integer("sessionCount").nullable();
      table.json("requirements").nullable();
      table.json("modules").nullable();
      table.boolean("isPublished").notNullable().defaultTo(true);
      timestamps(table);
      table.index("slug");
      table.index("isPublished");
    });
};

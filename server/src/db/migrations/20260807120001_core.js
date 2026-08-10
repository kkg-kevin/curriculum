const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema
    .createTable("users", (table) => {
      id(table);
      table.string("name", 150).notNullable();
      table.string("email", 255).nullable();
      table.string("username", 50).nullable();
      table.string("passwordHash", 255).notNullable();
      table.enu("role", ["admin", "school", "teacher", "learner", "curriculumAdmin", "branchAdmin"]).notNullable();
      table.string("photo", 500).nullable();
      timestamps(table);
      table.index("email");
      table.index("username");
      table.index("role");
    })
    .createTable("branches", (table) => {
      id(table);
      table.string("name", 150).notNullable();
      fk(table, "branchAdminId").nullable();
      timestamps(table);
      table.index("branchAdminId");
    })
    .createTable("system_levels", (table) => {
      id(table);
      table.integer("sequence").notNullable();
      table.string("name", 50).notNullable();
      timestamps(table);
    })
    .createTable("inventory", (table) => {
      id(table);
      table.string("name", 150).notNullable();
      table.enu("category", ["Robots", "Electronics", "Components", "Consumables", "Tools", "Other"]).nullable().defaultTo("Other");
      table.string("unit", 30).nullable().defaultTo("pcs");
      table.text("description").nullable();
      table.string("image", 500).nullable();
      timestamps(table);
    })
    .createTable("competencies", (table) => {
      id(table);
      table.string("name", 150).notNullable();
      table.text("description").nullable();
      table.string("code", 20).nullable();
      timestamps(table);
      table.index("code");
    })
    .createTable("competency_indicators", (table) => {
      // Promoted out of competencies.json[].indicators[] — that nested array's `id` is
      // already used as a de-facto FK from indicator-achievements, performance-bands,
      // and assessment/submission indicatorMarks[], so it needs to be a real row with a
      // real PK rather than JSON, per the migration plan.
      id(table);
      fk(table, "competencyId").notNullable();
      table.string("name", 150).notNullable();
      table.string("description", 300).nullable();
      table.string("code", 20).nullable();
      timestamps(table);
      table.index("competencyId");
    })
    .createTable("learning_areas_catalog", (table) => {
      // Global settings catalog (settings/learning-areas) — distinct from the
      // curriculum-scoped `learning_areas` table created in the curriculum-framework
      // migration.
      id(table);
      table.string("name", 100).notNullable();
      table.string("description", 500).nullable();
      table.string("color", 7).nullable().defaultTo("#25476a");
      table.json("courses").nullable();
      timestamps(table);
    });
};

exports.down = async function down(knex) {
  await knex.schema
    .dropTableIfExists("learning_areas_catalog")
    .dropTableIfExists("competency_indicators")
    .dropTableIfExists("competencies")
    .dropTableIfExists("inventory")
    .dropTableIfExists("system_levels")
    .dropTableIfExists("branches")
    .dropTableIfExists("users");
};

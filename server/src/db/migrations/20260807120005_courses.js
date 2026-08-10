const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema
    .createTable("courses", (table) => {
      id(table);
      table.string("name", 150).notNullable();
      table.string("code", 20).nullable();
      table.enu("status", ["draft", "active", "archived"]).notNullable().defaultTo("draft");
      table.text("description").nullable();
      table.string("coverImage", 500).nullable();
      table.integer("ageMin").nullable();
      table.integer("ageMax").nullable();
      table.json("requirements").nullable();
      timestamps(table);
      table.index("status");
    })
    .createTable("course_modules", (table) => {
      id(table);
      fk(table, "courseId").notNullable();
      table.string("name", 150).notNullable();
      table.integer("order").notNullable();
      timestamps(table);
      table.index("courseId");
    })
    .createTable("course_sessions", (table) => {
      id(table);
      fk(table, "courseId").notNullable();
      fk(table, "moduleId").nullable();
      table.string("title", 255).notNullable().defaultTo("");
      table.integer("order").notNullable();
      table.json("outcomes").nullable();
      table.text("introduction", "mediumtext").nullable();
      table.json("mainConcepts").nullable();
      table.json("activities").nullable();
      table.json("assessmentIds").nullable();
      table.json("assessmentAttachments").nullable();
      table.json("notes").nullable();
      table.json("resources").nullable();
      timestamps(table);
      table.index("courseId");
      table.index("moduleId");
    })
    .createTable("course_competency_links", (table) => {
      id(table);
      fk(table, "courseId").notNullable();
      fk(table, "competencyId").notNullable();
      timestamps(table, { updatedAt: false });
      table.index("courseId");
      table.index("competencyId");
    })
    .createTable("course_curriculum_links", (table) => {
      id(table);
      fk(table, "courseId").notNullable();
      fk(table, "curriculumId").notNullable();
      timestamps(table, { updatedAt: false });
      table.index("courseId");
      table.index("curriculumId");
    })
    .createTable("course_learning_area_links", (table) => {
      id(table);
      fk(table, "courseId").notNullable();
      fk(table, "learningAreaId").notNullable();
      timestamps(table, { updatedAt: false });
      table.index("courseId");
      table.index("learningAreaId");
    })
    .createTable("course_inventory_links", (table) => {
      id(table);
      fk(table, "courseId").notNullable();
      fk(table, "inventoryItemId").notNullable();
      table.float("quantity").notNullable().defaultTo(1);
      timestamps(table, { updatedAt: false });
      table.unique(["courseId", "inventoryItemId"]);
    });
};

exports.down = async function down(knex) {
  await knex.schema
    .dropTableIfExists("course_inventory_links")
    .dropTableIfExists("course_learning_area_links")
    .dropTableIfExists("course_curriculum_links")
    .dropTableIfExists("course_competency_links")
    .dropTableIfExists("course_sessions")
    .dropTableIfExists("course_modules")
    .dropTableIfExists("courses");
};

const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema
    .createTable("curricula", (table) => {
      id(table);
      table.string("name", 100).notNullable();
      table.string("code", 20).notNullable();
      table.string("academicYear", 50).nullable();
      table.string("description", 500).nullable();
      table.enu("status", ["draft", "active"]).notNullable().defaultTo("draft");
      table.string("educationLevel", 100).nullable();
      table.string("gradeFrom", 50).nullable();
      table.string("gradeTo", 50).nullable();
      table.string("framework", 100).nullable();
      table.string("curriculumType", 100).nullable();
      table.boolean("isProgram").notNullable().defaultTo(false);
      table.string("academicCycleModel", 30).notNullable().defaultTo("terms");
      table.json("periods").nullable();
      table.json("classes").nullable();
      table.json("competencyWeights").nullable();
      fk(table, "curriculumAdminId").nullable();
      timestamps(table);
      table.index("curriculumAdminId");
      table.index("framework");
      table.index("academicYear");
      table.index("status");
    })
    .createTable("learning_hubs", (table) => {
      id(table);
      table.string("name", 150).notNullable();
      table.enu("hubType", ["school", "co_working_space", "innovation_lab", "makerspace", "tech_club"]).notNullable().defaultTo("school");
      table.string("code", 20).nullable();
      table.string("email", 255).nullable();
      table.string("phone", 20).nullable();
      table.string("contactPerson", 150).nullable();
      table.json("address").nullable();
      table.text("mapLink").nullable();
      fk(table, "curriculumId").nullable();
      fk(table, "branchId").nullable();
      table.enu("status", ["draft", "active", "inactive"]).notNullable().defaultTo("draft");
      table.string("description", 1000).nullable();
      table.string("photo", 500).nullable();
      table.json("photos").nullable();
      table.json("amenities").nullable();
      table.json("operatingHours").nullable();
      table.json("spaces").nullable();
      timestamps(table);
      table.index("curriculumId");
      table.index("branchId");
      table.index("status");
      table.index("hubType");
      table.index("email");
    });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("learning_hubs").dropTableIfExists("curricula");
};

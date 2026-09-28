const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema
    .createTable("home_learning_households", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      table.string("guardianName", 150).notNullable();
      table.string("guardianEmail", 255).nullable();
      table.string("guardianPhone", 30).notNullable();
      table.string("county", 100).nullable();
      table.string("subCounty", 100).nullable();
      table.string("town", 100).nullable();
      table.string("addressLine", 255).nullable();
      table.string("landmark", 255).nullable();
      table.string("planCode", 30).notNullable();
      table.integer("childCount").notNullable();
      table.integer("monthlyAmount").notNullable();
      table.string("status", 20).notNullable().defaultTo("pending");
      table.date("startDate").nullable();
      table.text("notes").nullable();
      timestamps(table);
      table.index("ownerAdminId");
      table.index("guardianEmail");
    })
    .createTable("home_learning_enrollments", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      fk(table, "householdId").notNullable();
      fk(table, "learnerId").notNullable();
      fk(table, "curriculumId").notNullable();
      fk(table, "educatorId").nullable();
      table.string("status", 20).notNullable().defaultTo("active");
      timestamps(table);
      table.unique(["learnerId"]);
      table.index("ownerAdminId");
      table.index("learnerId");
      table.index("curriculumId");
      table.index("educatorId");
    });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("home_learning_enrollments");
  await knex.schema.dropTableIfExists("home_learning_households");
};

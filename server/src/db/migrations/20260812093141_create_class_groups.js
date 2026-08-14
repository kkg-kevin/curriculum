const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema
    .createTable("class_groups", (table) => {
      id(table);
      fk(table, "classId").notNullable();
      table.string("name", 150).notNullable();
      timestamps(table);
      table.index("classId");
    })
    .createTable("class_group_members", (table) => {
      id(table);
      fk(table, "groupId").notNullable();
      fk(table, "learnerId").notNullable();
      timestamps(table, { updatedAt: false });
      table.unique(["groupId", "learnerId"]);
      table.index("groupId");
      table.index("learnerId");
    });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("class_group_members").dropTableIfExists("class_groups");
};

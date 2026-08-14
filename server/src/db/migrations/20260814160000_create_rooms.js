const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema.createTable("rooms", (table) => {
    id(table);
    fk(table, "hubId").notNullable();
    table.string("name", 100).notNullable();
    table.integer("capacity").unsigned().nullable();
    table.string("notes", 500).nullable();
    table.enu("status", ["active", "inactive"]).notNullable().defaultTo("active");
    timestamps(table);
    table.unique(["hubId", "name"]);
    table.index("hubId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("rooms");
};

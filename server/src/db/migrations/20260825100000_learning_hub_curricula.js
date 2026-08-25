const { id, fk, timestamps } = require("../helpers");
const { randomUUID } = require("crypto");

exports.up = async function up(knex) {
  await knex.schema.createTable("learning_hub_curricula", (table) => {
    id(table);
    fk(table, "hubId").notNullable();
    fk(table, "curriculumId").notNullable();
    table.enu("slot", ["core", "secondary"]).notNullable();
    table.enu("role", ["core", "complementary", "substitutional"]).notNullable();
    table.enu("status", ["active", "inactive", "completed"]).notNullable().defaultTo("active");
    table.datetime("startedAt").nullable();
    table.datetime("endedAt").nullable();
    timestamps(table);
    table.unique(["hubId", "slot"]);
    table.unique(["hubId", "curriculumId"]);
    table.index("hubId");
    table.index("curriculumId");
    table.index(["hubId", "status"]);
    table.index(["hubId", "role"]);
  });

  const now = new Date();
  const hubs = await knex("learning_hubs").select("id", "curriculumId");
  const rows = hubs
    .filter((hub) => hub.curriculumId)
    .map((hub) => ({
      id: randomUUID(),
      hubId: hub.id,
      curriculumId: hub.curriculumId,
      slot: "core",
      role: "core",
      status: "active",
      startedAt: now,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    }));

  if (rows.length > 0) {
    await knex("learning_hub_curricula").insert(rows);
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("learning_hub_curricula");
};

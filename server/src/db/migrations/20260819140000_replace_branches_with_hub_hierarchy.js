const { fk } = require("../helpers");

// Replaces the standalone branches/branchAdmin feature (a separate table + login role for
// cross-hub oversight, built but never actually used — zero branchAdmin users, zero hubs with
// branchId set at the time of this migration) with a simpler hub-native model: a Learning Hub
// can itself be the parent of other hubs (its "branches"), addressed via a self-referential
// learning_hubs.parentHubId instead of a separate branches table + branchAdminId login. The
// parent hub's own existing "school" admin gains access to switch into branch hubs — see
// scope.middleware.js's req.ownSchools/req.ownSchool resolution.
exports.up = async function up(knex) {
  await knex.schema.alterTable("learning_hubs", (table) => {
    table.dropIndex("branchId");
    table.dropColumn("branchId");
  });
  await knex.schema.alterTable("learning_hubs", (table) => {
    fk(table, "parentHubId").nullable();
    table.index("parentHubId");
  });
  await knex.schema.dropTableIfExists("branches");
  await knex.schema.alterTable("users", (table) => {
    table.enu("role", ["admin", "school", "teacher", "learner", "curriculumAdmin"]).notNullable().alter();
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("users", (table) => {
    table.enu("role", ["admin", "school", "teacher", "learner", "curriculumAdmin", "branchAdmin"]).notNullable().alter();
  });
  await knex.schema.createTable("branches", (table) => {
    table.string("id", 36).primary();
    table.string("name", 150).notNullable();
    fk(table, "branchAdminId").nullable();
    table.datetime("createdAt").notNullable();
    table.datetime("updatedAt").nullable();
    table.index("branchAdminId");
  });
  await knex.schema.alterTable("learning_hubs", (table) => {
    table.dropIndex("parentHubId");
    table.dropColumn("parentHubId");
  });
  await knex.schema.alterTable("learning_hubs", (table) => {
    fk(table, "branchId").nullable();
    table.index("branchId");
  });
};

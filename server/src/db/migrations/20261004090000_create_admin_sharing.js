const { id, fk, timestamps } = require("../helpers");

// Sharing between admins (see src/modules/sharing/). Each admin is its own workspace; two admins
// who connect can each browse the other's content and copy what they want into their own
// workspace, where the copy is theirs to change.
//
//   admin_connections  one row per pair of admins: a request (pending) that the other admin
//                      accepts. Either side can remove it.
//   shared_imports     what an admin has already copied from another: source record → their own
//                      copy. Lets a later copy reuse it instead of making a second one (a course
//                      brought in today and an assessment tomorrow share the same competencies).
exports.up = async function up(knex) {
  await knex.schema.createTable("admin_connections", (table) => {
    id(table);
    fk(table, "requesterAdminId").notNullable();
    fk(table, "recipientAdminId").notNullable();
    table.string("status", 20).notNullable().defaultTo("pending"); // pending | accepted
    table.datetime("respondedAt").nullable();
    timestamps(table);
    table.index("requesterAdminId");
    table.index("recipientAdminId");
  });

  await knex.schema.createTable("shared_imports", (table) => {
    id(table);
    fk(table, "ownerAdminId").notNullable(); // the admin who copied it in
    fk(table, "sourceAdminId").notNullable();
    table.string("entityTable", 64).notNullable();
    fk(table, "sourceId").notNullable();
    fk(table, "targetId").notNullable();
    timestamps(table, { updatedAt: false });
    table.index(["ownerAdminId", "sourceAdminId"]);
    table.index(["ownerAdminId", "entityTable", "sourceId"]);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("shared_imports");
  await knex.schema.dropTableIfExists("admin_connections");
};

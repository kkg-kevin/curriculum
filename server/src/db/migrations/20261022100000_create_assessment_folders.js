const { id, fk, timestamps } = require("../helpers");

// Assessment folders: an admin groups their assessments into named folders on the Assessments
// page, the same way as course folders (20261019100000/20261019110000). A folder is just an
// organising label in one admin's workspace — an assessment sits in at most one
// (assessments.folderId, NULL = not in a folder) and nothing else about it changes. Deleting a
// folder leaves its assessments in place, just out of the folder.
// Additive only — every existing assessment starts outside any folder.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("assessment_folders"))) {
    await knex.schema.createTable("assessment_folders", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      table.string("name", 120).notNullable();
      table.string("color", 20).nullable();
      table.text("description").nullable();
      table.string("coverImage", 2048).nullable();
      timestamps(table);
      table.index("ownerAdminId");
    });
  }
  if (!(await knex.schema.hasColumn("assessments", "folderId"))) {
    await knex.schema.alterTable("assessments", (table) => {
      table.string("folderId", 36).nullable();
      table.index("folderId");
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("assessments", "folderId")) {
    await knex.schema.alterTable("assessments", (table) => {
      table.dropIndex("folderId");
      table.dropColumn("folderId");
    });
  }
  await knex.schema.dropTableIfExists("assessment_folders");
};

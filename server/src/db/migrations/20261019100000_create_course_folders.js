const { id, fk, timestamps } = require("../helpers");

// Course folders: an admin groups their courses into named folders on the Courses page (e.g.
// "Robotics", "Grade 4"). A folder is just an organising label in one admin's workspace — a course
// sits in at most one (courses.folderId, NULL = not in a folder) and nothing else about the course
// changes. Deleting a folder leaves its courses in place, just out of the folder.
// Additive only — every existing course starts outside any folder.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("course_folders"))) {
    await knex.schema.createTable("course_folders", (table) => {
      id(table);
      fk(table, "ownerAdminId").notNullable();
      table.string("name", 120).notNullable();
      table.string("color", 20).nullable();
      timestamps(table);
      table.index("ownerAdminId");
    });
  }
  if (!(await knex.schema.hasColumn("courses", "folderId"))) {
    await knex.schema.alterTable("courses", (table) => {
      table.string("folderId", 36).nullable();
      table.index("folderId");
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("courses", "folderId")) {
    await knex.schema.alterTable("courses", (table) => {
      table.dropIndex("folderId");
      table.dropColumn("folderId");
    });
  }
  await knex.schema.dropTableIfExists("course_folders");
};

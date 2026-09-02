const { id, timestamps } = require("../helpers");

// Marketing content for the digifunzi-landing site's Bootcamps/Projects pages (GET
// /api/public/bootcamps, /api/public/projects — spec §4.1/§4.2). Deliberately its own tables,
// not the operational `programs`/`courses` tables: those require a real curriculum + hub
// deployment to exist at all, which is the wrong coupling for what is fundamentally marketing
// copy an admin should be able to write/publish without touching curriculum authoring. A
// `referenceId` on a Lead (see the leads migration) is a bare string against these ids/slugs —
// no FK, so either side can evolve independently.
exports.up = async function up(knex) {
  await knex.schema
    .createTable("public_bootcamps", (table) => {
      id(table);
      table.string("name", 150).notNullable();
      table.string("slug", 160).notNullable().unique();
      table.text("description").notNullable();
      table.string("coverImage", 500).nullable();
      // Mirrors ProgramService's computeStatus concept, but this is authored directly (a
      // marketing page has no cohort dates to derive it from) rather than computed.
      table.enu("status", ["upcoming", "active", "completed"]).notNullable().defaultTo("upcoming");
      table.date("startDate").nullable();
      table.date("endDate").nullable();
      table.string("educationLevel", 50).nullable();
      table.string("gradeFrom", 30).nullable();
      table.string("gradeTo", 30).nullable();
      // Detail-page-only extras (bootcampDetail() in the frontend's mock fixture) — plain JSON
      // since neither is a real FK-backed relationship here (see module comment above).
      table.json("classes").nullable();
      table.json("courses").nullable();
      table.boolean("isPublished").notNullable().defaultTo(true);
      timestamps(table);
      table.index("slug");
      table.index("status");
      table.index("isPublished");
    })
    .createTable("public_projects", (table) => {
      id(table);
      table.string("name", 150).notNullable();
      table.string("slug", 160).notNullable().unique();
      table.text("description").notNullable();
      table.string("coverImage", 500).nullable();
      table.integer("ageMin").nullable();
      table.integer("ageMax").nullable();
      table.integer("sessionCount").nullable();
      table.json("requirements").nullable();
      table.json("modules").nullable();
      table.boolean("isPublished").notNullable().defaultTo(true);
      timestamps(table);
      table.index("slug");
      table.index("isPublished");
    });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("public_projects");
  await knex.schema.dropTableIfExists("public_bootcamps");
};

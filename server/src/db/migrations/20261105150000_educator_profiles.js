const { id, fk } = require("../helpers");

// The educator's performance profile (modules/educator-profiles/), 5 Nov 2026:
//   - teachers: what the educator writes about themself (`profileAboutDraft`), the version an admin
//     approved (`profileAbout` — the only one ever shown publicly), whether they want a public profile
//     (`profileOptIn`) and whether it's published (`profilePublic`, with its link `profileSlug`).
//   - educator_stats: the figures worked out from the system's own records (hours from attendance ×
//     timetable, sessions, learners, courses, parent ratings, QA, reliability…), one JSON per educator,
//     refreshed nightly (npm run educators:stats) and on demand.
//   - mentor_requests: a parent asking, in the parent portal, for a published educator to teach their
//     child — to the admins, who mark it handled. Nothing comes from the website.
exports.up = async function up(knex) {
  const add = async (column, build) => {
    if (!(await knex.schema.hasColumn("teachers", column))) await knex.schema.alterTable("teachers", build);
  };
  await add("profileAbout", (t) => t.json("profileAbout").nullable());
  await add("profileAboutDraft", (t) => t.json("profileAboutDraft").nullable());
  await add("profileOptIn", (t) => t.boolean("profileOptIn").notNullable().defaultTo(false));
  await add("profilePublic", (t) => t.boolean("profilePublic").notNullable().defaultTo(false));
  await add("profileSlug", (t) => t.string("profileSlug", 90).nullable().unique());
  await add("profilePublishedAt", (t) => t.datetime("profilePublishedAt").nullable());
  await add("profileApprovedBy", (t) => t.string("profileApprovedBy", 36).nullable());
  await add("profileReviewNote", (t) => t.string("profileReviewNote", 500).nullable());

  if (!(await knex.schema.hasTable("educator_stats"))) {
    await knex.schema.createTable("educator_stats", (table) => {
      table.string("teacherId", 36).primary();
      table.json("stats").notNullable();
      table.datetime("computedAt").notNullable();
    });
  }
  if (!(await knex.schema.hasTable("mentor_requests"))) {
    await knex.schema.createTable("mentor_requests", (table) => {
      id(table);
      fk(table, "ownerAdminId").nullable();
      fk(table, "parentUserId").notNullable();
      fk(table, "learnerId").notNullable();
      fk(table, "teacherId").notNullable();
      table.string("note", 1000).nullable();
      table.string("status", 10).notNullable().defaultTo("open"); // open | handled
      table.string("handledBy", 36).nullable();
      table.datetime("handledAt").nullable();
      table.datetime("createdAt").notNullable();
      table.index("teacherId");
      table.index("ownerAdminId");
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("mentor_requests");
  await knex.schema.dropTableIfExists("educator_stats");
  for (const column of ["profileAbout", "profileAboutDraft", "profileOptIn", "profilePublic", "profileSlug", "profilePublishedAt", "profileApprovedBy", "profileReviewNote"]) {
    if (await knex.schema.hasColumn("teachers", column)) await knex.schema.alterTable("teachers", (t) => t.dropColumn(column));
  }
};

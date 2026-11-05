const { id, fk } = require("../helpers");

// Parents review the mentors (educators) teaching their children (modules/mentor-reviews/) — and a
// TOT learner their trainers, the same way.
//   - mentor_reviews: one per learner, educator, course and stage ("mid" while the course runs,
//     "end" once its final report is out) — overall 1–5, each aspect 1–5 (`ratings`), a comment,
//     a conduct concern (to the admins at once), consent to quote it on the website. Admins can
//     hide a comment (`hidden` — its ratings still count), feature a consented one on the website,
//     and mark a concern resolved.
//   - mentor_review_settings: one row per workspace — the aspects, how many sessions before a
//     review, the mid-course prompt, and whether hubs see their educators' averages.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("mentor_reviews"))) {
    await knex.schema.createTable("mentor_reviews", (table) => {
      id(table);
      fk(table, "ownerAdminId").nullable();
      fk(table, "reviewerUserId").notNullable();
      table.string("reviewerKind", 10).notNullable().defaultTo("parent"); // parent | tot
      fk(table, "learnerId").notNullable();
      fk(table, "teacherId").notNullable();
      fk(table, "classId").nullable();
      fk(table, "courseId").notNullable();
      fk(table, "hubId").nullable();
      table.string("stage", 5).notNullable(); // mid | end
      table.tinyint("overall").notNullable();
      table.json("ratings").nullable();
      table.text("comment").nullable();
      table.boolean("concern").notNullable().defaultTo(false);
      table.text("concernText").nullable();
      table.datetime("concernResolvedAt").nullable();
      table.string("concernResolvedBy", 36).nullable();
      table.boolean("websiteConsent").notNullable().defaultTo(false);
      table.boolean("featured").notNullable().defaultTo(false);
      table.boolean("hidden").notNullable().defaultTo(false);
      table.string("hiddenBy", 36).nullable();
      table.datetime("createdAt").notNullable();
      table.datetime("updatedAt").nullable();
      table.unique(["learnerId", "teacherId", "courseId", "stage"]);
      table.index("teacherId");
      table.index("ownerAdminId");
      table.index("hubId");
    });
  }
  if (!(await knex.schema.hasTable("mentor_review_settings"))) {
    await knex.schema.createTable("mentor_review_settings", (table) => {
      table.string("ownerAdminId", 36).primary();
      table.json("settings").notNullable();
      table.datetime("updatedAt").nullable();
    });
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("mentor_review_settings");
  await knex.schema.dropTableIfExists("mentor_reviews");
};

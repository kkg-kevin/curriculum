// Reports & Analytics, round two (10 Nov 2026):
//   learner_followups   what staff did about a learner at risk — messaged the parent, told the
//                       class's educators, booked a parent check-in, or marked them followed up
//                       (with a note). The at-risk list shows the latest one.
//   report_views        a published report opened by the family: one row per report per login
//                       (parent or the child's own), first and last time, how many times — what
//                       Parent engagement counts.
// New tables (newer collation) — never SQL-joined to the older ones.
const { id, fk } = require("../helpers");

exports.up = async (knex) => {
  if (await knex.schema.hasTable("learner_followups")) return;
  await knex.schema.createTable("learner_followups", (t) => {
    id(t);
    fk(t, "ownerAdminId").nullable();
    fk(t, "hubId").nullable();
    fk(t, "learnerId").notNullable();
    t.string("action", 30).notNullable(); // parent_message | educator_told | checkin | followed_up
    t.text("note").nullable();
    t.json("reasons").nullable(); // the at-risk flags at the time
    fk(t, "createdBy").nullable();
    t.string("createdByName", 160).nullable();
    t.dateTime("createdAt").notNullable();
    t.index(["learnerId", "createdAt"]);
    t.index("ownerAdminId");
  });
  await knex.schema.createTable("report_views", (t) => {
    id(t);
    fk(t, "reportId").notNullable();
    fk(t, "learnerId").notNullable();
    fk(t, "userId").notNullable();
    t.string("viewer", 12).notNullable(); // parent | learner
    t.integer("views").notNullable().defaultTo(1);
    t.dateTime("firstViewedAt").notNullable();
    t.dateTime("lastViewedAt").notNullable();
    t.unique(["reportId", "userId"]);
    t.index("learnerId");
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTableIfExists("report_views");
  await knex.schema.dropTableIfExists("learner_followups");
};

// Placing a learner by age (30 Oct 2026).
//
//   learners.statedAge / statedAgeOn   an age given without a date of birth (an older website
//                               enrolment, a shop checkout, staff who don't know the date) and the
//                               day it was given — the learner's age today is worked out from the
//                               two (shared/utils/age.js's learnerAge). A date of birth always wins.
//   learner_hub_links.stageSource      who set the stage at that hub: "age" (worked out from the age —
//                               moved again when the age is corrected), "diagnostic" or "staff"
//                               (never moved by age). Null on older rows: left where they are.
exports.up = async function up(knex) {
  if (!(await knex.schema.hasColumn("learners", "statedAge"))) {
    await knex.schema.alterTable("learners", (table) => {
      table.integer("statedAge").nullable();
      table.string("statedAgeOn", 10).nullable();
    });
  }
  if (!(await knex.schema.hasColumn("learner_hub_links", "stageSource"))) {
    await knex.schema.alterTable("learner_hub_links", (table) => {
      table.string("stageSource", 20).nullable();
    });
  }
};

exports.down = async function down(knex) {
  if (await knex.schema.hasColumn("learner_hub_links", "stageSource")) {
    await knex.schema.alterTable("learner_hub_links", (table) => table.dropColumn("stageSource"));
  }
  if (await knex.schema.hasColumn("learners", "statedAge")) {
    await knex.schema.alterTable("learners", (table) => {
      table.dropColumn("statedAge");
      table.dropColumn("statedAgeOn");
    });
  }
};

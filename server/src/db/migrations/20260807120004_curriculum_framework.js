const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema
    .createTable("academic_year_groups", (table) => {
      id(table);
      fk(table, "curriculumId").notNullable();
      table.string("label", 100).notNullable();
      table.date("startDate").nullable();
      table.date("endDate").nullable();
      timestamps(table);
      table.index("curriculumId");
    })
    .createTable("academic_year_versions", (table) => {
      id(table);
      fk(table, "yearGroupId").notNullable();
      fk(table, "curriculumId").notNullable();
      table.integer("versionNumber").notNullable();
      table.enu("status", ["draft", "published", "inactive"]).notNullable().defaultTo("draft");
      table.boolean("isCurrent").notNullable().defaultTo(false);
      table.json("periods").nullable();
      timestamps(table);
      table.index("yearGroupId");
      table.index("curriculumId");
      table.index("status");
    })
    .createTable("age_categories", (table) => {
      id(table);
      fk(table, "curriculumId").notNullable();
      table.string("name", 100).notNullable();
      table.string("description", 500).nullable();
      table.integer("minAge").nullable();
      table.integer("maxAge").nullable();
      fk(table, "diagnosticAssessmentId").nullable();
      table.string("ageRange", 30).nullable();
      table.integer("order").notNullable().defaultTo(0);
      timestamps(table);
      table.index("curriculumId");
    })
    .createTable("assessment_types", (table) => {
      id(table);
      fk(table, "curriculumId").notNullable();
      table.string("name", 150).notNullable();
      table.string("description", 1000).nullable();
      table.enu("behaviorType", ["diagnostic", "formative", "summative"]).notNullable();
      table.float("progressionWeight").notNullable().defaultTo(1.0);
      fk(table, "learningAreaId").nullable();
      table.json("evidenceWeights").nullable();
      table.float("typeWeight").nullable();
      timestamps(table);
      table.index("curriculumId");
    })
    .createTable("curriculum_competency_links", (table) => {
      id(table);
      fk(table, "curriculumId").notNullable();
      fk(table, "competencyId").notNullable();
      table.float("minimumThreshold").notNullable().defaultTo(60);
      timestamps(table, { updatedAt: false });
      table.unique(["curriculumId", "competencyId"]);
    })
    .createTable("evidence_types", (table) => {
      id(table);
      fk(table, "curriculumId").notNullable();
      table.string("name", 150).notNullable();
      table.string("description", 500).nullable();
      table.enu("category", ["quiz", "exam", "project", "assignment", "observation"]).nullable();
      table.float("defaultContribution").notNullable().defaultTo(0);
      table.integer("minItemCount").notNullable().defaultTo(0);
      timestamps(table);
      table.index("curriculumId");
    })
    .createTable("learning_areas", (table) => {
      // Curriculum-scoped — distinct from the global `learning_areas_catalog` table.
      id(table);
      fk(table, "curriculumId").notNullable();
      table.string("name", 100).notNullable();
      table.string("description", 500).nullable();
      table.string("color", 7).notNullable().defaultTo("#25476a");
      table.json("courses").nullable();
      table.json("courseSequence").nullable();
      fk(table, "diagnosticAssessmentId").nullable();
      table.integer("minAge").nullable();
      table.integer("maxAge").nullable();
      timestamps(table);
      table.index("curriculumId");
    })
    .createTable("progress_levels", (table) => {
      id(table);
      fk(table, "curriculumId").notNullable();
      table.string("name", 100).notNullable();
      table.string("description", 500).nullable();
      table.float("minScore").notNullable().defaultTo(0);
      table.float("maxScore").notNullable().defaultTo(100);
      table.integer("order").notNullable().defaultTo(0);
      timestamps(table);
      table.index("curriculumId");
    })
    .createTable("progression_ladder_rungs", (table) => {
      id(table);
      fk(table, "curriculumId").notNullable();
      table.string("label", 100).notNullable();
      table.string("ageRange", 30).nullable().defaultTo("");
      table.integer("order").notNullable();
      table.json("assignments").nullable();
      timestamps(table);
      table.index("curriculumId");
    })
    .createTable("indicator_achievements", (table) => {
      id(table);
      fk(table, "curriculumId").notNullable();
      fk(table, "competencyId").notNullable();
      fk(table, "indicatorId").notNullable();
      table.float("marksEarned").notNullable();
      timestamps(table);
      table.unique(["curriculumId", "indicatorId"]);
      table.index("competencyId");
    })
    .createTable("learner_journeys", (table) => {
      id(table);
      fk(table, "learnerId").notNullable();
      fk(table, "curriculumId").notNullable();
      fk(table, "learningAreaId").notNullable();
      fk(table, "currentCourseId").nullable();
      table.json("history").nullable();
      timestamps(table);
      table.unique(["learnerId", "learningAreaId"]);
      table.index("curriculumId");
    })
    .createTable("performance_bands", (table) => {
      id(table);
      fk(table, "curriculumId").notNullable();
      table.string("name", 100).notNullable();
      table.string("description", 1000).nullable();
      table.float("minScore").notNullable().defaultTo(0);
      table.float("maxScore").notNullable().defaultTo(100);
      table.json("competencyIds").nullable();
      table.json("indicatorContributions").nullable();
      table.float("advancementThreshold").notNullable().defaultTo(0);
      fk(table, "learningAreaId").nullable();
      fk(table, "courseId").nullable();
      table.integer("order").notNullable().defaultTo(0);
      timestamps(table, { updatedAt: false }); // model never stamps updatedAt, even on update()
      table.index("curriculumId");
      table.index("learningAreaId");
      table.index("courseId");
    })
    .createTable("curriculum_versions", (table) => {
      id(table);
      fk(table, "curriculumId").notNullable();
      fk(table, "academicYearId").nullable();
      table.integer("versionNumber").notNullable();
      table.string("status", 30).notNullable().defaultTo("inactive");
      table.boolean("isCurrent").notNullable().defaultTo(false);
      fk(table, "versionOf").nullable();
      table.json("content").nullable();
      timestamps(table);
      table.index("curriculumId");
    });
};

exports.down = async function down(knex) {
  await knex.schema
    .dropTableIfExists("curriculum_versions")
    .dropTableIfExists("performance_bands")
    .dropTableIfExists("learner_journeys")
    .dropTableIfExists("indicator_achievements")
    .dropTableIfExists("progression_ladder_rungs")
    .dropTableIfExists("progress_levels")
    .dropTableIfExists("learning_areas")
    .dropTableIfExists("evidence_types")
    .dropTableIfExists("curriculum_competency_links")
    .dropTableIfExists("assessment_types")
    .dropTableIfExists("age_categories")
    .dropTableIfExists("academic_year_versions")
    .dropTableIfExists("academic_year_groups");
};

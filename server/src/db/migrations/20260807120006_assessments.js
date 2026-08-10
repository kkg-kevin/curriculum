const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema
    .createTable("assessments", (table) => {
      id(table);
      table.string("name", 150).notNullable();
      table.enu("type", ["quiz", "exam", "project", "assignment", "observation"]).notNullable();
      table.text("description", "mediumtext").nullable();
      table.text("instructions", "mediumtext").nullable();
      table.enu("structureType", ["structured", "unstructured", "mixed"]).notNullable().defaultTo("mixed");
      table.text("overview", "mediumtext").nullable();
      table.json("sections").nullable();
      table.json("items").nullable();
      table.json("rubric").nullable();
      table.json("indicators").nullable();
      table.json("deliverables").nullable();
      table.json("milestones").nullable();
      // Legacy artifact: server/data/assessments.json is shared with a now-dead
      // competency-framework model that filtered on curriculumId presence — kept here so
      // any such rows migrate cleanly, not read by the real builder.
      fk(table, "curriculumId").nullable();
      timestamps(table);
      table.index("type");
    })
    .createTable("assessment_competency_links", (table) => {
      id(table);
      fk(table, "assessmentId").notNullable();
      fk(table, "competencyId").notNullable();
      timestamps(table, { updatedAt: false });
      table.index("assessmentId");
      table.index("competencyId");
    })
    .createTable("assessment_inventory_links", (table) => {
      id(table);
      fk(table, "assessmentId").notNullable();
      fk(table, "inventoryItemId").notNullable();
      table.float("quantity").notNullable().defaultTo(1);
      timestamps(table, { updatedAt: false });
      table.unique(["assessmentId", "inventoryItemId"]);
    })
    .createTable("assessment_learning_area_links", (table) => {
      id(table);
      fk(table, "assessmentId").notNullable();
      fk(table, "learningAreaId").notNullable();
      timestamps(table, { updatedAt: false });
      table.index("assessmentId");
      table.index("learningAreaId");
    })
    .createTable("assessment_issues", (table) => {
      id(table);
      fk(table, "assessmentId").notNullable();
      // Course-attached issue shape: sessionId/courseId/classId set.
      fk(table, "sessionId").nullable();
      fk(table, "courseId").nullable();
      fk(table, "classId").nullable();
      fk(table, "issuedBy").nullable();
      table.string("dueDate", 20).nullable();
      // Standalone diagnostic-issue shape: learnerId/learningAreaId/ageCategoryId set instead.
      fk(table, "learnerId").nullable();
      fk(table, "learningAreaId").nullable();
      fk(table, "ageCategoryId").nullable();
      table.datetime("issuedAt").notNullable(); // model stamps issuedAt, not createdAt/updatedAt
      table.index(["assessmentId", "sessionId", "classId"], "idx_assessment_issues_course_shape");
      table.index(["assessmentId", "learnerId", "learningAreaId", "ageCategoryId"], "idx_assessment_issues_standalone_shape");
      table.index("issuedBy");
    })
    .createTable("assessment_submissions", (table) => {
      id(table);
      fk(table, "issueId").notNullable();
      fk(table, "assessmentId").notNullable();
      fk(table, "learnerId").notNullable();
      fk(table, "classId").nullable();
      table.string("status", 20).notNullable().defaultTo("pending");
      table.json("answers").nullable();
      table.float("autoScore").nullable();
      table.float("autoMax").nullable();
      table.json("autoItemResults").nullable();
      table.float("manualScore").nullable();
      table.float("totalScore").nullable();
      table.float("maxScore").nullable();
      table.boolean("requiresManualGrading").notNullable().defaultTo(false);
      table.json("itemFeedback").nullable();
      table.string("overallFeedback", 5000).nullable();
      table.datetime("submittedAt").nullable();
      table.datetime("gradedAt").nullable();
      fk(table, "gradedBy").nullable();
      table.boolean("reportPublished").notNullable().defaultTo(false);
      table.datetime("reportPublishedAt").nullable();
      // Sometimes holds the sentinel "system-backfill" instead of a real users.id.
      table.string("reportPublishedBy", 36).nullable();
      timestamps(table);
      table.unique(["issueId", "learnerId"]);
      table.index("assessmentId");
      table.index("learnerId");
      table.index("classId");
      table.index("status");
    });
};

exports.down = async function down(knex) {
  await knex.schema
    .dropTableIfExists("assessment_submissions")
    .dropTableIfExists("assessment_issues")
    .dropTableIfExists("assessment_learning_area_links")
    .dropTableIfExists("assessment_inventory_links")
    .dropTableIfExists("assessment_competency_links")
    .dropTableIfExists("assessments");
};

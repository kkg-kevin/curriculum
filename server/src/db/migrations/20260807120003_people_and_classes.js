const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema
    .createTable("learners", (table) => {
      id(table);
      table.string("firstName", 100).notNullable();
      table.string("lastName", 100).notNullable();
      table.enu("gender", ["male", "female", "other"]).nullable();
      table.string("guardianName", 150).notNullable();
      table.string("guardianPhone", 30).notNullable();
      table.string("guardianEmail", 255).nullable();
      table.string("dateOfBirth", 20).nullable();
      table.string("nationality", 100).nullable();
      table.string("languages", 255).nullable();
      table.string("username", 30).nullable();
      fk(table, "currentRungId").nullable(); // legacy Progression Ladder placement, mostly unused
      table.string("photo", 500).nullable();
      table.string("registrationNumber", 30).nullable();
      table.datetime("portalOnboardingCompletedAt").nullable();
      timestamps(table);
      table.index("username");
      table.index("guardianEmail");
      table.index("registrationNumber");
    })
    .createTable("teachers", (table) => {
      id(table);
      table.string("firstName", 80).notNullable();
      table.string("lastName", 80).notNullable();
      table.string("email", 255).nullable();
      table.string("phone", 20).nullable();
      table.enu("status", ["active", "inactive", "on_leave"]).notNullable().defaultTo("active");
      table.enu("employmentType", ["part_time", "full_time"]).nullable();
      table.integer("teacherLevel").nullable();
      table.enu("paymentTerms", ["hourly", "daily"]).nullable();
      table.string("photo", 500).nullable();
      table.json("qualifiedCourseIds").nullable();
      timestamps(table);
      table.index("email");
      table.index("status");
    })
    .createTable("classes", (table) => {
      id(table);
      fk(table, "schoolId").notNullable();
      fk(table, "curriculumId").notNullable();
      table.string("gradeId", 100).notNullable();
      table.string("gradeName", 150).notNullable();
      table.string("academicYear", 50).notNullable();
      table.integer("capacity").nullable();
      table.enu("status", ["active", "inactive"]).notNullable().defaultTo("active");
      table.string("tag", 50).nullable();
      table.string("streamName", 100).nullable();
      fk(table, "classTeacherId").nullable(); // legacy, superseded by class_course_teacher_links
      timestamps(table);
      table.index("schoolId");
      table.index("curriculumId");
      table.index("status");
    })
    .createTable("learner_hub_links", (table) => {
      id(table);
      fk(table, "learnerId").notNullable();
      fk(table, "hubId").notNullable();
      fk(table, "classId").nullable();
      table.string("admissionNumber", 50).nullable();
      table.enu("status", ["active", "inactive", "transferred", "graduated"]).notNullable().defaultTo("active");
      fk(table, "currentStageId").nullable();
      fk(table, "currentBandId").nullable();
      table.datetime("onboardingCompletedAt").nullable();
      timestamps(table);
      table.unique(["learnerId", "hubId"]);
      table.index("hubId");
      table.index("classId");
      table.index("admissionNumber");
    })
    .createTable("teacher_hub_links", (table) => {
      id(table);
      fk(table, "teacherId").notNullable();
      fk(table, "hubId").notNullable();
      timestamps(table, { updatedAt: false });
      table.unique(["teacherId", "hubId"]);
      table.index("hubId");
    })
    .createTable("class_course_teacher_links", (table) => {
      id(table);
      fk(table, "classId").notNullable();
      fk(table, "courseId").notNullable();
      fk(table, "teacherId").notNullable();
      table.boolean("isPrimary").notNullable().defaultTo(false);
      timestamps(table, { updatedAt: false });
      table.unique(["classId", "courseId", "teacherId"]);
      table.index("classId");
      table.index("teacherId");
    });
};

exports.down = async function down(knex) {
  await knex.schema
    .dropTableIfExists("class_course_teacher_links")
    .dropTableIfExists("teacher_hub_links")
    .dropTableIfExists("learner_hub_links")
    .dropTableIfExists("classes")
    .dropTableIfExists("teachers")
    .dropTableIfExists("learners");
};

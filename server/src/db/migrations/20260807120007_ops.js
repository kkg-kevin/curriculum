const { id, fk, timestamps } = require("../helpers");

exports.up = async function up(knex) {
  await knex.schema
    .createTable("attendance", (table) => {
      id(table);
      fk(table, "classId").notNullable();
      table.date("date").notNullable();
      fk(table, "learnerId").notNullable();
      table.enu("status", ["present", "absent", "late", "excused"]).notNullable();
      table.string("notes", 300).nullable();
      fk(table, "markedBy").nullable();
      timestamps(table);
      table.unique(["classId", "date", "learnerId"]);
      table.index("learnerId");
      table.index("date");
    })
    .createTable("reports", (table) => {
      id(table);
      fk(table, "learnerId").notNullable();
      fk(table, "courseId").notNullable();
      fk(table, "classId").notNullable();
      fk(table, "sessionId").nullable(); // null = course-level final report
      fk(table, "hubId").nullable();
      table.enu("status", ["draft", "published"]).notNullable().defaultTo("draft");
      table.datetime("generatedAt").nullable();
      table.string("generatedBy", 36).nullable(); // real users.id, or the sentinel "system"
      table.datetime("publishedAt").nullable();
      table.string("publishedBy", 36).nullable(); // real users.id, or the sentinel "system"
      table.string("remarks", 5000).nullable().defaultTo("");
      table.json("content").nullable();
      timestamps(table);
      // MySQL unique indexes treat NULL as distinct, so this doesn't fully block duplicate
      // course-level (sessionId=NULL) reports the way the app's own findOne() null-safe
      // check does — acceptable for now, app-level findOne()/upsert logic stays authoritative.
      table.unique(["learnerId", "courseId", "classId", "sessionId"]);
      table.index("classId");
      table.index("status");
    })
    .createTable("timetable_slots", (table) => {
      id(table);
      fk(table, "classId").notNullable();
      fk(table, "courseId").notNullable();
      fk(table, "teacherId").nullable();
      table.enu("dayOfWeek", ["monday", "tuesday", "wednesday", "thursday", "friday"]).notNullable();
      table.string("startTime", 5).notNullable();
      table.string("endTime", 5).notNullable();
      table.string("room", 100).nullable();
      timestamps(table);
      table.index("classId");
      table.index("teacherId");
      table.index("dayOfWeek");
    })
    .createTable("timetable_course_schedules", (table) => {
      id(table);
      fk(table, "classId").notNullable();
      fk(table, "courseId").notNullable();
      table.date("startDate").notNullable();
      timestamps(table);
      table.unique(["classId", "courseId"]);
    })
    .createTable("programs", (table) => {
      id(table);
      fk(table, "curriculumId").notNullable();
      fk(table, "hubId").notNullable();
      table.date("startDate").notNullable();
      table.date("endDate").notNullable();
      table.json("classIds").nullable();
      timestamps(table);
      table.index("curriculumId");
      table.index("hubId");
    });
};

exports.down = async function down(knex) {
  await knex.schema
    .dropTableIfExists("programs")
    .dropTableIfExists("timetable_course_schedules")
    .dropTableIfExists("timetable_slots")
    .dropTableIfExists("reports")
    .dropTableIfExists("attendance");
};

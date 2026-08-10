// Plain DATETIME has no sub-second precision — MySQL rounds every write to the nearest whole
// second. Confirmed via a full data-fidelity audit that this wasn't just cosmetic: several
// competencies created within the same second (938ms/952ms/963ms apart) landed on an identical
// stored timestamp and came back from `ORDER BY createdAt` in a different relative order than
// the original JSON file had them in. DATETIME(3) (millisecond precision) fixes this — every JS
// Date object written already carries milliseconds, so this just stops them being discarded.
const ALTERS = [
  ["academic_year_groups", "createdAt", false], ["academic_year_groups", "updatedAt", true],
  ["academic_year_versions", "createdAt", false], ["academic_year_versions", "updatedAt", true],
  ["age_categories", "createdAt", false], ["age_categories", "updatedAt", true],
  ["assessment_competency_links", "createdAt", false],
  ["assessment_inventory_links", "createdAt", false],
  ["assessment_issues", "issuedAt", false],
  ["assessment_learning_area_links", "createdAt", false],
  ["assessment_submissions", "createdAt", false], ["assessment_submissions", "gradedAt", true],
  ["assessment_submissions", "reportPublishedAt", true], ["assessment_submissions", "submittedAt", true],
  ["assessment_submissions", "updatedAt", true],
  ["assessment_types", "createdAt", false], ["assessment_types", "updatedAt", true],
  ["assessments", "createdAt", false], ["assessments", "updatedAt", true],
  ["attendance", "createdAt", false], ["attendance", "updatedAt", true],
  ["branches", "createdAt", false], ["branches", "updatedAt", true],
  ["class_course_teacher_links", "createdAt", false],
  ["classes", "createdAt", false], ["classes", "updatedAt", true],
  ["competencies", "createdAt", false], ["competencies", "updatedAt", true],
  ["competency_indicators", "createdAt", false], ["competency_indicators", "updatedAt", true],
  ["course_competency_links", "createdAt", false],
  ["course_curriculum_links", "createdAt", false],
  ["course_inventory_links", "createdAt", false],
  ["course_learning_area_links", "createdAt", false],
  ["course_modules", "createdAt", false], ["course_modules", "updatedAt", true],
  ["course_sessions", "createdAt", false], ["course_sessions", "updatedAt", true],
  ["courses", "createdAt", false], ["courses", "updatedAt", true],
  ["curricula", "createdAt", false], ["curricula", "updatedAt", true],
  ["curriculum_competency_indicators", "createdAt", false], ["curriculum_competency_indicators", "updatedAt", true],
  ["curriculum_competency_links", "createdAt", false],
  ["curriculum_versions", "createdAt", false], ["curriculum_versions", "updatedAt", true],
  ["evidence_types", "createdAt", false], ["evidence_types", "updatedAt", true],
  ["indicator_achievements", "createdAt", false], ["indicator_achievements", "updatedAt", true],
  ["inventory", "createdAt", false], ["inventory", "updatedAt", true],
  ["learner_hub_links", "createdAt", false], ["learner_hub_links", "onboardingCompletedAt", true],
  ["learner_hub_links", "updatedAt", true],
  ["learner_journeys", "createdAt", false], ["learner_journeys", "updatedAt", true],
  ["learners", "createdAt", false], ["learners", "portalOnboardingCompletedAt", true],
  ["learners", "updatedAt", true],
  ["learning_areas", "createdAt", false], ["learning_areas", "updatedAt", true],
  ["learning_areas_catalog", "createdAt", false], ["learning_areas_catalog", "updatedAt", true],
  ["learning_hubs", "createdAt", false], ["learning_hubs", "updatedAt", true],
  ["performance_bands", "createdAt", false],
  ["programs", "createdAt", false], ["programs", "updatedAt", true],
  ["progress_levels", "createdAt", false], ["progress_levels", "updatedAt", true],
  ["progression_ladder_rungs", "createdAt", false], ["progression_ladder_rungs", "updatedAt", true],
  ["reports", "createdAt", false], ["reports", "generatedAt", true],
  ["reports", "publishedAt", true], ["reports", "updatedAt", true],
  ["system_levels", "createdAt", false], ["system_levels", "updatedAt", true],
  ["teacher_hub_links", "createdAt", false],
  ["teachers", "createdAt", false], ["teachers", "updatedAt", true],
  ["timetable_course_schedules", "createdAt", false], ["timetable_course_schedules", "updatedAt", true],
  ["timetable_slots", "createdAt", false], ["timetable_slots", "updatedAt", true],
  ["users", "createdAt", false], ["users", "updatedAt", true],
];

exports.up = async function up(knex) {
  for (const [table, column, nullable] of ALTERS) {
    await knex.raw(
      `ALTER TABLE \`${table}\` MODIFY \`${column}\` DATETIME(3) ${nullable ? "NULL" : "NOT NULL"}`
    );
  }
};

exports.down = async function down(knex) {
  for (const [table, column, nullable] of ALTERS) {
    await knex.raw(
      `ALTER TABLE \`${table}\` MODIFY \`${column}\` DATETIME ${nullable ? "NULL" : "NOT NULL"}`
    );
  }
};

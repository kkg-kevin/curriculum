// Learning Areas → Pathways. A pure rename — no columns added or dropped, every existing row's
// values carried over by MySQL's in-place RENAME. See the plan/handoff: a "Pathway" is the
// reframed Learning Area (name, description, courses, diagnostic, age range, placement bands),
// and the old global "Learning Area catalog" becomes the reusable "Pathway template" library.
//
// Renamed:
//   learning_areas                 -> pathways                    (curriculum-scoped roadmap)
//   learning_areas_catalog         -> pathway_templates           (global reusable library)
//   course_learning_area_links     -> course_pathway_links
//   assessment_learning_area_links -> assessment_pathway_links
//   learner_journeys               -> learner_pathways
//   performance_bands.learningAreaId       -> pathwayId
//   learner_pathways.learningAreaId        -> pathwayId
//   assessment_issues.learningAreaId       -> pathwayId
//   assessment_types.learningAreaId        -> pathwayId  (dead column — renamed for consistency)
//   course_pathway_links.learningAreaId    -> pathwayId
//   assessment_pathway_links.learningAreaId-> pathwayId
//
// The compound named index on assessment_issues includes a renamed column, so it's dropped and
// recreated by hand — renameColumn alone can't update an index's own definition.

const COLUMN_RENAMES = [
  ["performance_bands", "learningAreaId", "pathwayId"],
  ["assessment_types", "learningAreaId", "pathwayId"],
];

exports.up = async function up(knex) {
  // 1. Tables. Order matters only for readability — none of these have DB-level FKs (see
  //    db/helpers.js: referential integrity is enforced in the app layer, not by constraints).
  await knex.schema.renameTable("learning_areas", "pathways");
  await knex.schema.renameTable("learning_areas_catalog", "pathway_templates");
  await knex.schema.renameTable("course_learning_area_links", "course_pathway_links");
  await knex.schema.renameTable("assessment_learning_area_links", "assessment_pathway_links");
  await knex.schema.renameTable("learner_journeys", "learner_pathways");

  // 2. The assessment_issues compound index names one of the columns we're about to rename —
  //    drop it first, rename the column, recreate it. The single-column .index("learningAreaId")
  //    entries on the other tables are auto-carried by MySQL's RENAME COLUMN, no action needed.
  await knex.schema.alterTable("assessment_issues", (t) => {
    t.dropIndex(
      ["assessmentId", "learnerId", "learningAreaId", "ageCategoryId"],
      "idx_assessment_issues_standalone_shape"
    );
  });
  await knex.schema.alterTable("assessment_issues", (t) => {
    t.renameColumn("learningAreaId", "pathwayId");
  });
  await knex.schema.alterTable("assessment_issues", (t) => {
    t.index(
      ["assessmentId", "learnerId", "pathwayId", "ageCategoryId"],
      "idx_assessment_issues_standalone_shape"
    );
  });

  // 3. learner_pathways carries a unique (learnerId, learningAreaId). MySQL keeps a unique index
  //    across a RENAME COLUMN, but its generated name still references the old column, which is
  //    only cosmetic — leave it. The column rename itself is what matters.
  await knex.schema.alterTable("learner_pathways", (t) => {
    t.renameColumn("learningAreaId", "pathwayId");
  });

  // 4. course_pathway_links / assessment_pathway_links — freshly renamed tables above.
  await knex.schema.alterTable("course_pathway_links", (t) => {
    t.renameColumn("learningAreaId", "pathwayId");
  });
  await knex.schema.alterTable("assessment_pathway_links", (t) => {
    t.renameColumn("learningAreaId", "pathwayId");
  });

  // 5. Remaining plain column renames.
  for (const [table, from, to] of COLUMN_RENAMES) {
    // eslint-disable-next-line no-await-in-loop
    await knex.schema.alterTable(table, (t) => t.renameColumn(from, to));
  }
};

exports.down = async function down(knex) {
  for (const [table, from, to] of COLUMN_RENAMES) {
    // eslint-disable-next-line no-await-in-loop
    await knex.schema.alterTable(table, (t) => t.renameColumn(to, from));
  }

  await knex.schema.alterTable("assessment_pathway_links", (t) => {
    t.renameColumn("pathwayId", "learningAreaId");
  });
  await knex.schema.alterTable("course_pathway_links", (t) => {
    t.renameColumn("pathwayId", "learningAreaId");
  });
  await knex.schema.alterTable("learner_pathways", (t) => {
    t.renameColumn("pathwayId", "learningAreaId");
  });

  await knex.schema.alterTable("assessment_issues", (t) => {
    t.dropIndex(
      ["assessmentId", "learnerId", "pathwayId", "ageCategoryId"],
      "idx_assessment_issues_standalone_shape"
    );
  });
  await knex.schema.alterTable("assessment_issues", (t) => {
    t.renameColumn("pathwayId", "learningAreaId");
  });
  await knex.schema.alterTable("assessment_issues", (t) => {
    t.index(
      ["assessmentId", "learnerId", "learningAreaId", "ageCategoryId"],
      "idx_assessment_issues_standalone_shape"
    );
  });

  await knex.schema.renameTable("learner_pathways", "learner_journeys");
  await knex.schema.renameTable("assessment_pathway_links", "assessment_learning_area_links");
  await knex.schema.renameTable("course_pathway_links", "course_learning_area_links");
  await knex.schema.renameTable("pathway_templates", "learning_areas_catalog");
  await knex.schema.renameTable("pathways", "learning_areas");
};

// Two clean-ups to issued assessments (6 Nov 2026):
//
// 1. A learner finishing a session's other sections used to be given their own copy of an
//    assessment their class had already been issued (issueOnSessionComplete), so it showed twice
//    in their list. That copy is removed when nothing is lost by it: no reissue was made from it,
//    and either they never opened it (it goes) or they never opened the class issue (their work
//    moves onto the class issue, so it's marked and counted there). A copy both were opened on is
//    left as it is. Copies for learners not in any class that issued it are left too.
//
// 2. One reissue per attempt per learner: UNIQUE (reissuedFromIssueId, learnerId), so two
//    reissues sent at the same moment make one. Skipped (with a message) if an installation
//    already has such duplicates — nothing is deleted to make room for it.

const INDEX = "assessment_issues_one_reissue_per_attempt";

exports.up = async function up(knex) {
  const copies = await knex("assessment_issues")
    .whereNotNull("learnerId").whereNotNull("sessionId")
    .whereNull("classId").whereNull("reissuedFromIssueId").whereNull("pathwayId").whereNull("ageCategoryId")
    .where((w) => w.whereNull("issuedBy").orWhereNot("issuedBy", "website"));

  let removed = 0;
  let moved = 0;
  for (const copy of copies) {
    const classIds = await knex("learner_hub_links")
      .where({ learnerId: copy.learnerId, status: "active" }).whereNotNull("classId").pluck("classId");
    if (!classIds.length) continue;
    const classIssue = await knex("assessment_issues")
      .where({ assessmentId: copy.assessmentId, sessionId: copy.sessionId })
      .whereIn("classId", classIds).orderBy("issuedAt").first();
    if (!classIssue) continue;
    const madeFrom = await knex("assessment_issues").where({ reissuedFromIssueId: copy.id }).first("id");
    if (madeFrom) continue;

    const work = await knex("assessment_submissions").where({ issueId: copy.id });
    if (work.length) {
      const onClassIssue = await knex("assessment_submissions").where({ issueId: classIssue.id, learnerId: copy.learnerId }).first("id");
      if (onClassIssue || work.some((s) => s.learnerId !== copy.learnerId)) continue;
      await knex("assessment_submissions").where({ issueId: copy.id }).update({ issueId: classIssue.id, classId: classIssue.classId });
      moved += 1;
    }
    await knex("assessment_issues").where({ id: copy.id }).del();
    removed += 1;
  }
  if (removed) console.log(`[migrate] removed ${removed} duplicate self-issued assessment(s), ${moved} with work moved onto the class issue`);

  const duplicates = await knex("assessment_issues")
    .whereNotNull("reissuedFromIssueId").whereNotNull("learnerId")
    .select("reissuedFromIssueId", "learnerId").count("* as n")
    .groupBy("reissuedFromIssueId", "learnerId").having("n", ">", 1);
  if (duplicates.length) {
    console.warn(`[migrate] ${duplicates.length} attempt(s) already have two reissues for one learner — one-reissue-per-attempt key not added`);
    return;
  }
  const [indexes] = await knex.raw("SHOW INDEX FROM assessment_issues WHERE Key_name = ?", [INDEX]);
  if (!indexes.length) {
    await knex.schema.alterTable("assessment_issues", (table) => {
      table.unique(["reissuedFromIssueId", "learnerId"], { indexName: INDEX });
    });
  }
};

exports.down = async function down(knex) {
  const [indexes] = await knex.raw("SHOW INDEX FROM assessment_issues WHERE Key_name = ?", [INDEX]);
  if (indexes.length) {
    await knex.schema.alterTable("assessment_issues", (table) => table.dropUnique(["reissuedFromIssueId", "learnerId"], INDEX));
  }
};

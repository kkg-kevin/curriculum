// Indexes for lookups that ran without one (17 Nov 2026 optimisation pass). Fine on today's data,
// but these tables grow every day and are read on busy pages:
//   assessment_issues (classId, sessionId)  what a class was given — teacher screens, reports,
//                                           counted work, Curriculum coverage
//   assessment_issues (learnerId)           one learner's individual (re)issues
//   reports (hubId)                         a hub's reports (analytics, staff learner page)
//   audit_log (actorUserId, action)         last sign-ins per person (Reports & Analytics → Logins,
//                                           Parent engagement, affiliates) — the log grows fastest
// Indexes only: no data changes. Idempotent — each is skipped when an index of that name exists.

const INDEXES = [
  { table: "assessment_issues", columns: ["classId", "sessionId"], name: "assessment_issues_classid_sessionid_index" },
  { table: "assessment_issues", columns: ["learnerId"], name: "assessment_issues_learnerid_index" },
  { table: "reports", columns: ["hubId"], name: "reports_hubid_index" },
  { table: "audit_log", columns: ["actorUserId", "action"], name: "audit_log_actoruserid_action_index" },
];

async function hasIndex(knex, table, name) {
  const [rows] = await knex.raw(
    "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1",
    [table, name],
  );
  return rows.length > 0;
}

exports.up = async function up(knex) {
  for (const { table, columns, name } of INDEXES) {
    if (!(await knex.schema.hasTable(table))) continue;
    if (await hasIndex(knex, table, name)) continue;
    await knex.schema.alterTable(table, (t) => { t.index(columns, name); });
  }
};

exports.down = async function down(knex) {
  for (const { table, name } of INDEXES) {
    if (!(await knex.schema.hasTable(table))) continue;
    if (!(await hasIndex(knex, table, name))) continue;
    await knex.schema.alterTable(table, (t) => { t.dropIndex([], name); });
  }
};

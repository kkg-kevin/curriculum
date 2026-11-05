const { id, fk } = require("../helpers");

// An issued assessment revoked for chosen learners only (assessment-revocation.model.js): one row
// per (class issue, learner). It covers that learner's every attempt — the class issue and any
// reissue made from it — so the assessment leaves their list, can't be opened, handed in or
// marked, stops counting in their reports and is no longer required of them. Their work is kept;
// deleting the row ("Give back") restores everything. Revoking for the whole class still deletes
// the issue itself. assessmentId / classId / sessionId are copied from the issue so reports can
// ask "what's revoked for this learner in this session" without walking issues.
exports.up = async function up(knex) {
  if (await knex.schema.hasTable("assessment_revocations")) return;
  await knex.schema.createTable("assessment_revocations", (table) => {
    id(table);
    fk(table, "issueId").notNullable();
    fk(table, "learnerId").notNullable();
    fk(table, "assessmentId").notNullable();
    fk(table, "classId").nullable();
    fk(table, "sessionId").nullable();
    table.string("revokedBy", 36).nullable();
    table.timestamp("revokedAt").notNullable().defaultTo(knex.fn.now());
    table.unique(["issueId", "learnerId"]);
    table.index("learnerId");
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists("assessment_revocations");
};

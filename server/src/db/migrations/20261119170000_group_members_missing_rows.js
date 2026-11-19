// Group assessments (19 Nov 2026): a group member who never opened a group assessment had no
// submission row, so when the group's work was handed in and marked, only the members who had
// opened it got the marks, the report and a finished session. The code now gives every member a row
// (assessment-submission.service.js ensureGroupRows); this does the same once for work already
// handed in or marked: each current member of the group, active in the class, issued it, not revoked
// for them, and without a row gets a copy of the group's row. Their session reports are then rebuilt
// (best effort — the Reports page rebuilds them too). No notices are sent.

const COPY = [
  "assessmentId", "classId", "status", "answers", "autoScore", "autoMax", "autoItemResults", "manualScore",
  "totalScore", "maxScore", "requiresManualGrading", "itemFeedback", "overallFeedback", "submittedAt", "gradedAt",
  "gradedBy", "indicatorBreakdown", "milestoneProgress", "reportPublished", "reportPublishedAt", "reportPublishedBy",
];
const RANK = { graded: 3, submitted: 2, in_progress: 1 };
const parseList = (v) => { if (Array.isArray(v)) return v; try { const out = JSON.parse(v); return Array.isArray(out) ? out : null; } catch { return null; } };

exports.up = async function up(knex) {
  if (!(await knex.schema.hasTable("assessment_issues")) || !(await knex.schema.hasTable("class_group_members"))) return;
  const { randomUUID } = require("crypto");
  const issues = await knex("assessment_issues").where({ groupMode: true }).whereNotNull("classId").select("id", "classId", "courseId", "sessionId", "assessmentId", "forLearnerIds");
  const refresh = [];
  for (const issue of issues) {
    const rows = await knex("assessment_submissions").where({ issueId: issue.id });
    const byGroup = new Map();
    for (const r of rows.filter((x) => x.groupId && ["submitted", "graded"].includes(x.status))) {
      const held = byGroup.get(r.groupId);
      if (!held || (RANK[r.status] || 0) > (RANK[held.status] || 0)) byGroup.set(r.groupId, r);
    }
    if (!byGroup.size) continue;
    const have = new Set(rows.map((r) => r.learnerId));
    const active = new Set(await knex("learner_hub_links").where({ classId: issue.classId, status: "active" }).pluck("learnerId"));
    const chosen = parseList(issue.forLearnerIds);
    const revoked = new Set(await knex.schema.hasTable("assessment_revocations")
      ? await knex("assessment_revocations").where({ issueId: issue.id }).pluck("learnerId") : []);
    const added = [];
    for (const [groupId, group] of byGroup) {
      const members = await knex("class_group_members").where({ groupId }).pluck("learnerId");
      for (const learnerId of members) {
        if (have.has(learnerId) || !active.has(learnerId) || revoked.has(learnerId) || (chosen && !chosen.includes(learnerId))) continue;
        const copy = { id: randomUUID(), issueId: issue.id, learnerId, groupId, createdAt: new Date(), updatedAt: new Date() };
        for (const field of COPY) copy[field] = group[field] === undefined ? null : group[field];
        for (const field of ["answers", "autoItemResults", "itemFeedback", "indicatorBreakdown", "milestoneProgress"]) {
          if (copy[field] != null && typeof copy[field] !== "string") copy[field] = JSON.stringify(copy[field]);
        }
        await knex("assessment_submissions").insert(copy);
        have.add(learnerId);
        added.push(learnerId);
      }
    }
    if (added.length && issue.courseId) refresh.push({ classId: issue.classId, courseId: issue.courseId, sessionId: issue.sessionId || null, assessmentId: issue.assessmentId, learnerIds: added });
  }
  // Their session reports — best effort; the Reports page brings them up to date as well.
  for (const r of refresh) {
    try {
      await require("../../modules/reports/report.service").refreshSessionReportsForAssessment(r);
    } catch (err) {
      console.error("[migration] group report rebuild skipped:", err.message);
    }
  }
};

// Nothing to undo: the rows added are the group's own marked work for its members.
exports.down = async function down() {};

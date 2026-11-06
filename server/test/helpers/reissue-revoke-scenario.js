// The reissue / revoke flow end to end, against whatever database `db` points at. Used by
// test/reissue-revoke.db.test.js (a throwaway *_test database). Every row it adds is removed by
// the returned cleanup, which the caller must run.
const assert = require("node:assert/strict");
const crypto = require("crypto");

async function reissueRevokeScenario(t, db) {
  const Service = require("../../src/modules/assessments/submissions/assessment-submission.service");
  const CountedWork = require("../../src/modules/assessments/submissions/counted-work");

  const id = () => crypto.randomUUID();
  const ids = { assessment: id(), other: id(), chosen: id(), course: id(), session: id(), hub: id(), class: id(), A: id(), B: id(), C: id(), classIssue: id() };
  const now = new Date();
  const learners = [ids.A, ids.B, ids.C];

  const cleanup = async () => {
    await db("assessment_submissions").whereIn("learnerId", learners).del();
    await db("assessment_revocations").whereIn("learnerId", learners).del();
    await db("assessment_issues").whereIn("assessmentId", [ids.assessment, ids.other, ids.chosen]).del();
    await db("reports").whereIn("learnerId", learners).del().catch(() => {});
    await db("notifications").whereIn("recipientId", learners).del().catch(() => {});
    await db("learner_hub_links").whereIn("learnerId", learners).del();
    await db("learners").whereIn("id", learners).del();
    await db("classes").where({ id: ids.class }).del();
    await db("course_sessions").where({ id: ids.session }).del();
    await db("assessments").whereIn("id", [ids.assessment, ids.other, ids.chosen]).del();
  };

  try {
    for (const [aid, name] of [[ids.assessment, "Reissue test"], [ids.other, "Not in the session"], [ids.chosen, "Chosen learners test"]]) {
      await db("assessments").insert({ id: aid, name, type: "quiz", items: JSON.stringify([]), ownerAdminId: ids.hub, createdAt: now, updatedAt: now });
    }
    await db("course_sessions").insert({
      id: ids.session, courseId: ids.course, order: 1, title: "Test session", createdAt: now, updatedAt: now,
      assessmentAttachments: JSON.stringify([{ assessmentId: ids.assessment, mode: "individual" }, { assessmentId: ids.chosen, mode: "individual" }]),
    });
    await db("classes").insert({ id: ids.class, schoolId: ids.hub, curriculumId: id(), gradeId: id(), gradeName: "Test", academicYear: "2026", createdAt: now });
    // C joins the class later (below).
    for (const lid of [ids.A, ids.B]) {
      await db("learners").insert({ id: lid, firstName: "Test", lastName: lid.slice(0, 4), guardianName: "-", guardianPhone: "-", createdAt: now });
      await db("learner_hub_links").insert({ id: id(), learnerId: lid, hubId: ids.hub, classId: ids.class, status: "active", createdAt: now });
    }
    await db("assessment_issues").insert({ id: ids.classIssue, assessmentId: ids.assessment, sessionId: ids.session, courseId: ids.course, classId: ids.class, issuedBy: "test", issuedAt: now });

    const handIn = async (issueId, learnerId) => {
      const sub = await Service.getOrCreateSubmission({ issueId, learnerId });
      return Service.submit(sub.id, []);
    };
    const counted = async (learnerId) => (await CountedWork.sortLearnerWork(learnerId)).counted.map((e) => e.submission.id);

    const a1 = await handIn(ids.classIssue, ids.A);
    assert.equal(a1.status, "graded");
    assert.deepEqual(await counted(ids.A), [a1.id]);

    let reissueA;
    await t.test("reissue only to a learner whose latest attempt is marked, once", async () => {
      const first = await Service.reissueToLearners({ issueId: ids.classIssue, learnerIds: [ids.A, ids.B], reissuedBy: "test" });
      assert.equal(first.reissued.length, 1);
      assert.equal(first.reissued[0].learnerId, ids.A);
      assert.match(first.skipped[0].reason, /Hasn't handed it in/);
      reissueA = first.reissued[0].issueId;
      const again = await Service.reissueToLearners({ issueId: ids.classIssue, learnerIds: [ids.A], reissuedBy: "test" });
      assert.equal(again.reissued.length, 0);
      assert.match(again.skipped[0].reason, /Already reissued/);
    });

    await t.test("two reissues sent at the same moment make one", async () => {
      await handIn(ids.classIssue, ids.B);
      const results = await Promise.allSettled([1, 2].map(() => Service.reissueToLearner({ issueId: ids.classIssue, learnerId: ids.B, reissuedBy: "test" })));
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal((await db("assessment_issues").where({ reissuedFromIssueId: ids.classIssue, learnerId: ids.B })).length, 1);
    });

    let a2;
    await t.test("the reissued attempt counts in place of the first, even after the first is marked again", async () => {
      // Before they start it, the reissue already replaces the first attempt on their list.
      const listed = await Service.getIssuedRowsForLearner(ids.A);
      assert.equal(listed.find((r) => r.issue.id === ids.classIssue)?.replacedBy, reissueA);
      assert.ok(!listed.find((r) => r.issue.id === reissueA)?.replacedBy);
      a2 = await handIn(reissueA, ids.A);
      assert.equal(a2.status, "graded");
      assert.deepEqual(await counted(ids.A), [a2.id]);
      await Service.grade(a1.id, { manualScore: 0, gradedBy: "test" });
      assert.deepEqual(await counted(ids.A), [a2.id]);
    });

    await t.test("the roster carries each learner's attempts and why they can't be reissued", async () => {
      const { roster } = await Service.getRosterForIssue(reissueA);
      const rowA = roster.find((r) => r.learner.id === ids.A);
      const rowB = roster.find((r) => r.learner.id === ids.B);
      assert.equal(rowA.attempts.length, 2);
      assert.equal(rowA.reissueBlocker, null);
      assert.match(rowB.reissueBlocker, /waiting for them/);
    });

    await t.test("revoked for a learner: nothing counts, nothing opens; giving it back restores it", async () => {
      await Service.revokeForLearners({ issueId: reissueA, learnerIds: [ids.A], revokedBy: "test" });
      assert.deepEqual(await counted(ids.A), []);
      await assert.rejects(Service.getOrCreateSubmission({ issueId: reissueA, learnerId: ids.A }), { statusCode: 409 });
      await assert.rejects(Service.issueOnSessionComplete({ assessmentId: ids.assessment, learnerId: ids.A, courseId: ids.course, sessionId: ids.session }), { statusCode: 409 });
      assert.equal((await Service.getIssuedRowsForLearner(ids.A)).length, 0);
      await Service.restoreForLearners({ issueId: ids.classIssue, learnerIds: [ids.A] });
      assert.deepEqual(await counted(ids.A), [a2.id]);
    });

    await t.test("a learner finishing a session gets their class's issue, never a copy or another assessment", async () => {
      const issue = await Service.issueOnSessionComplete({ assessmentId: ids.assessment, learnerId: ids.A, courseId: ids.course, sessionId: ids.session });
      assert.equal(issue.id, ids.classIssue);
      await assert.rejects(Service.issueOnSessionComplete({ assessmentId: ids.other, learnerId: ids.A, courseId: ids.course, sessionId: ids.session }), { statusCode: 404 });
      assert.equal((await db("assessment_issues").where({ learnerId: ids.A }).whereNull("reissuedFromIssueId")).length, 0);
    });

    await t.test("work counts in its own session only", async () => {
      const graded = await CountedWork.publishedGradedBySession(ids.A);
      assert.ok(graded.forSession(ids.session).has(ids.assessment));
      assert.ok(!graded.forSession(id()).has(ids.assessment));
    });

    await t.test("a written question can't be handed in blank", async () => {
      await db("assessments").where({ id: ids.chosen }).update({ items: JSON.stringify([{ id: "w1", kind: "shortAnswer", question: "Why?", points: 2 }]) });
      const issue = await Service.issueAssessment({ assessmentId: ids.chosen, sessionId: ids.session, courseId: ids.course, classId: ids.class, issuedBy: "test", learnerIds: [ids.A] });
      const sub = await Service.getOrCreateSubmission({ issueId: issue.id, learnerId: ids.A });
      await assert.rejects(Service.submit(sub.id, [{ itemId: "w1", response: "  " }]), { statusCode: 400, message: /question 1/ });
      const handed = await Service.submit(sub.id, [{ itemId: "w1", response: "Because it loops." }]);
      assert.equal(handed.status, "submitted");
      // Back to a fresh issue for the chosen-learner checks below.
      await db("assessment_submissions").where({ issueId: issue.id }).del();
      await db("assessment_issues").where({ id: issue.id }).del();
      await db("assessments").where({ id: ids.chosen }).update({ items: JSON.stringify([]) });
    });

    await t.test("issued to chosen learners: only they see it, take it and are asked for it", async () => {
      const issue = await Service.issueAssessment({ assessmentId: ids.chosen, sessionId: ids.session, courseId: ids.course, classId: ids.class, issuedBy: "test", learnerIds: [ids.B] });
      assert.deepEqual(issue.forLearnerIds, [ids.B]);
      const has = async (learnerId) => (await Service.getIssuedRowsForLearner(learnerId)).some((r) => r.issue.id === issue.id);
      assert.equal(await has(ids.B), true);
      assert.equal(await has(ids.A), false);
      await assert.rejects(Service.getOrCreateSubmission({ issueId: issue.id, learnerId: ids.A }), { statusCode: 403 });
      const { roster } = await Service.getRosterForIssue(issue.id);
      assert.deepEqual(roster.map((r) => r.learner.id), [ids.B]);
      const ReportService = require("../../src/modules/reports/report.service");
      const summary = await ReportService.getSessionSummaryForClass(ids.class, ids.session);
      const required = (lid) => summary.learnerRows.find((r) => r.learner.id === lid).requiredCount;
      assert.equal(required(ids.B), required(ids.A) + 1, "not asked of a learner it wasn't issued to");
    });

    await t.test("a learner joining later gets the whole-class issues, not the chosen-learner ones", async () => {
      await db("learners").insert({ id: ids.C, firstName: "Test", lastName: "late", guardianName: "-", guardianPhone: "-", createdAt: new Date() });
      await db("learner_hub_links").insert({ id: id(), learnerId: ids.C, hubId: ids.hub, classId: ids.class, status: "active", createdAt: new Date() });
      const listed = (await Service.getIssuedRowsForLearner(ids.C)).map((r) => r.issue.assessmentId);
      assert.ok(listed.includes(ids.assessment));
      assert.ok(!listed.includes(ids.chosen));
    });

    await t.test("issuing again adds chosen learners; to the whole class clears the list", async () => {
      const more = await Service.issueAssessment({ assessmentId: ids.chosen, sessionId: ids.session, courseId: ids.course, classId: ids.class, issuedBy: "test", learnerIds: [ids.A] });
      assert.deepEqual([...more.forLearnerIds].sort(), [ids.A, ids.B].sort());
      const all = await Service.issueAssessment({ assessmentId: ids.chosen, sessionId: ids.session, courseId: ids.course, classId: ids.class, issuedBy: "test" });
      assert.equal(all.forLearnerIds, null);
      assert.ok((await Service.getIssuedRowsForLearner(ids.C)).some((r) => r.issue.assessmentId === ids.chosen));
    });

    await t.test("revoked for everyone: every attempt goes and the work stops counting", async () => {
      await Service.revokeIssue(reissueA);
      assert.equal((await db("assessment_issues").where({ assessmentId: ids.assessment })).length, 0);
      assert.equal((await CountedWork.sortLearnerWork(ids.A)).live.length, 0);
      assert.equal((await db("assessment_submissions").where({ learnerId: ids.A })).length, 2, "the work itself is kept");
    });

    await t.test("after revoking for everyone the session isn't stuck: it can be filed not submitted", async () => {
      const ReportService = require("../../src/modules/reports/report.service");
      const report = await ReportService.markSessionNotSubmitted({ classId: ids.class, courseId: ids.course, sessionId: ids.session, learnerId: ids.A, actorId: "test" });
      assert.equal(report.content.notSubmitted, true);
    });
  } finally {
    await cleanup();
  }
}

module.exports = { reissueRevokeScenario };

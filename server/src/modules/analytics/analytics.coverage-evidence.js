// Minimum evidence (17 Nov 2026) — part of Curriculum coverage. A curriculum's evidence types can
// set a minimum count ("at least 2 projects in a course"). For every class + course in view and
// every evidence type with a minimum:
//   planned   assessments of that type attached to the course's sessions (the course design)
//   issued    of those (or others of that type issued in the course), how many the class was given
//   done      issued and fully marked: every learner it was issued to has a marked submission or a
//             "not submitted" session report (a group issue: something marked and nothing waiting)
//   remaining minimum − done
// Which evidence type an assessment counts as: shared/utils/evidence-types.js (its tag, else its
// type's category when exactly one evidence type has it). Diagnostics and surveys never count.

const db = require("../../config/db");
const { inChunks } = require("./analytics.utils");
const { getSessionAssessmentIds } = require("../courses/sessionAssessment.utils");
const { resolveEvidenceType } = require("../../shared/utils/evidence-types");

const json = (v) => {
  if (v == null || typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return null; }
};
const chosenOf = (issue) => {
  const ids = json(issue.forLearnerIds);
  return Array.isArray(ids) && ids.length ? ids : null;
};

const REASONS = {
  ambiguous: (r) => `More than one evidence type has this type (${r.candidates.join(", ")}) — choose one`,
  tag_not_here: () => "Its evidence type isn't in this curriculum — choose another",
};

// cellsByClass: Map classId → [{ courseId, courseName }]. Returns
//   { forCell(classId, courseId) → [line], summary: [...], needsChoice: [...] }
async function loadEvidence(classes, cellsByClass) {
  const curriculumIds = [...new Set(classes.map((c) => c.curriculumId))];
  const evidenceTypes = curriculumIds.length ? await db("evidence_types").whereIn("curriculumId", curriculumIds) : [];
  const typesByCurriculum = new Map();
  for (const et of evidenceTypes) {
    if (!typesByCurriculum.has(et.curriculumId)) typesByCurriculum.set(et.curriculumId, []);
    typesByCurriculum.get(et.curriculumId).push(et);
  }
  const tracked = (curriculumId) => (typesByCurriculum.get(curriculumId) || []).filter((et) => et.minItemCount > 0);
  const inScope = classes.filter((c) => tracked(c.curriculumId).length);
  const empty = { forCell: () => [], summary: [], needsChoice: [] };
  if (!inScope.length) return empty;

  const classIds = inScope.map((c) => c.id);
  const courseIds = [...new Set(inScope.flatMap((c) => (cellsByClass.get(c.id) || []).map((x) => x.courseId)))];
  const [sessions, issuesRaw, activeLinks, curricula] = await Promise.all([
    inChunks(courseIds, (ids) => db("course_sessions").whereIn("courseId", ids).select("id", "courseId", "assessmentIds", "assessmentAttachments")),
    inChunks(classIds, (ids) => db("assessment_issues").whereIn("classId", ids)
      .whereNull("ageCategoryId").whereNull("pathwayId").whereNull("publicAttemptId")
      .select("id", "assessmentId", "classId", "courseId", "sessionId", "forLearnerIds", "learnerId", "groupMode", "reissuedFromIssueId")),
    inChunks(classIds, (ids) => db("learner_hub_links").whereIn("classId", ids).where({ status: "active" }).select("classId", "learnerId")),
    db("curricula").whereIn("id", curriculumIds).select("id", "name"),
  ]);
  const curriculumName = new Map(curricula.map((c) => [c.id, c.name]));

  const sessionsByCourse = new Map();
  const courseOfSession = new Map();
  for (const s of sessions) {
    const ids = getSessionAssessmentIds({ assessmentIds: json(s.assessmentIds), assessmentAttachments: json(s.assessmentAttachments) });
    if (!sessionsByCourse.has(s.courseId)) sessionsByCourse.set(s.courseId, []);
    sessionsByCourse.get(s.courseId).push({ id: s.id, assessmentIds: ids });
    courseOfSession.set(s.id, s.courseId);
  }
  const assessmentIds = [...new Set([...sessions.flatMap((s) => getSessionAssessmentIds({ assessmentIds: json(s.assessmentIds), assessmentAttachments: json(s.assessmentAttachments) })), ...issuesRaw.map((i) => i.assessmentId)])];
  const assessments = await inChunks(assessmentIds, (ids) => db("assessments").whereIn("id", ids).select("id", "name", "type", "evidenceType"));
  const assessmentById = new Map(assessments.map((a) => [a.id, a]));

  // Marking state, keyed on each issue's original (a reissue's work counts for the issue it redoes).
  const issueById = new Map(issuesRaw.map((i) => [i.id, i]));
  const rootOf = (issue) => {
    let cur = issue;
    for (let n = 0; n < 10 && cur?.reissuedFromIssueId && issueById.has(cur.reissuedFromIssueId); n += 1) cur = issueById.get(cur.reissuedFromIssueId);
    return cur;
  };
  const submissions = await inChunks(issuesRaw.map((i) => i.id), (ids) => db("assessment_submissions").whereIn("issueId", ids).select("issueId", "learnerId", "status"));
  const graded = new Set();
  const marked = new Map();
  const waiting = new Map();
  for (const s of submissions) {
    const root = rootOf(issueById.get(s.issueId));
    if (!root) continue;
    if (s.status === "graded") {
      graded.add(`${root.id}:${s.learnerId}`);
      marked.set(root.id, (marked.get(root.id) || 0) + 1);
    } else if (s.status === "submitted") waiting.set(root.id, (waiting.get(root.id) || 0) + 1);
  }
  const notSubmittedRows = await inChunks(classIds, (ids) => db("reports").whereIn("classId", ids).where({ status: "published" }).whereNotNull("sessionId")
    .whereRaw("content LIKE ?", ["%notSubmitted%"]).select("classId", "sessionId", "learnerId", "content"));
  const notSubmitted = new Set(notSubmittedRows.filter((r) => json(r.content)?.notSubmitted).map((r) => `${r.classId}:${r.sessionId}:${r.learnerId}`));
  const learnersOf = new Map();
  for (const l of activeLinks) {
    if (!learnersOf.has(l.classId)) learnersOf.set(l.classId, []);
    learnersOf.get(l.classId).push(l.learnerId);
  }
  const fullyMarked = (issue) => {
    if (issue.groupMode) return (marked.get(issue.id) || 0) > 0 && !(waiting.get(issue.id) || 0);
    const targets = issue.learnerId ? [issue.learnerId] : chosenOf(issue) || learnersOf.get(issue.classId) || [];
    if (!targets.length) return false;
    return targets.every((l) => graded.has(`${issue.id}:${l}`) || (issue.sessionId && notSubmitted.has(`${issue.classId}:${issue.sessionId}:${l}`)));
  };
  const rootIssues = issuesRaw.filter((i) => !i.reissuedFromIssueId || !issueById.has(i.reissuedFromIssueId));

  const lines = new Map();
  const summary = new Map();
  const needsChoice = new Map();
  for (const cls of inScope) {
    const types = typesByCurriculum.get(cls.curriculumId) || [];
    const minimums = tracked(cls.curriculumId);
    const resolve = (assessmentId) => resolveEvidenceType(assessmentById.get(assessmentId), types);
    for (const { courseId, courseName } of cellsByClass.get(cls.id) || []) {
      const courseSessions = sessionsByCourse.get(courseId) || [];
      const sessionIds = new Set(courseSessions.map((s) => s.id));
      const attached = [...new Set(courseSessions.flatMap((s) => s.assessmentIds))].filter((id) => assessmentById.has(id));
      const issues = rootIssues.filter((i) => i.classId === cls.id && (i.courseId === courseId || (i.sessionId && sessionIds.has(i.sessionId))));
      for (const id of attached) {
        const r = resolve(id);
        if (!r.evidenceType && REASONS[r.reason]) {
          const a = assessmentById.get(id);
          const key = `${id}:${cls.curriculumId}`;
          if (!needsChoice.has(key)) needsChoice.set(key, { key, assessmentId: id, name: a.name, type: a.type, curriculumName: curriculumName.get(cls.curriculumId) || "", reason: REASONS[r.reason](r) });
        }
      }
      const cellLines = minimums.map((et) => {
        const isType = (id) => resolve(id).evidenceType?.id === et.id;
        const planned = attached.filter(isType).length;
        const issuedIds = new Set(issues.filter((i) => isType(i.assessmentId)).map((i) => i.assessmentId));
        const doneIds = new Set(issues.filter((i) => issuedIds.has(i.assessmentId) && fullyMarked(i)).map((i) => i.assessmentId));
        const done = doneIds.size;
        const line = {
          evidenceTypeId: et.id, name: et.name, minimum: et.minItemCount, planned, issued: issuedIds.size, done,
          remaining: Math.max(0, et.minItemCount - done), met: done >= et.minItemCount, plannedShort: planned < et.minItemCount,
        };
        const k = `${cls.curriculumId}:${et.id}`;
        const s = summary.get(k) || {
          key: k, curriculumName: curriculumName.get(cls.curriculumId) || "", name: et.name, category: et.category || null, minimum: et.minItemCount,
          classCourses: 0, met: 0, short: 0, done: 0, needed: 0, remaining: 0, plannedShortCourses: new Set(),
        };
        s.classCourses += 1;
        s[line.met ? "met" : "short"] += 1;
        s.done += Math.min(done, et.minItemCount);
        s.needed += et.minItemCount;
        s.remaining += line.remaining;
        if (line.plannedShort) s.plannedShortCourses.add(courseName || courseId);
        summary.set(k, s);
        return line;
      });
      lines.set(`${cls.id}:${courseId}`, cellLines);
    }
  }

  return {
    forCell: (classId, courseId) => lines.get(`${classId}:${courseId}`) || [],
    summary: [...summary.values()].map(({ plannedShortCourses, ...s }) => ({ ...s, plannedShort: [...plannedShortCourses] }))
      .sort((a, b) => a.curriculumName.localeCompare(b.curriculumName) || a.name.localeCompare(b.name)),
    needsChoice: [...needsChoice.values()],
  };
}

module.exports = { loadEvidence };

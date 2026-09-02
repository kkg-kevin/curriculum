const ClassModel   = require("./class.model");
const LearnerHubLinkModel = require("../learners/learner-hub-link.model");
const ClassCourseTeacherLinkModel = require("./class-course-teacher-link.model");
const TimetableModel = require("../timetable/timetable.model");
const CourseScheduleModel = require("../timetable/course-schedule.model");
const SessionSkipModel = require("../timetable/session-skip.model");
const AttendanceModel = require("../attendance/attendance.model");
const AssessmentIssueModel = require("../assessments/submissions/assessment-issue.model");
const ClassGroupService = require("./groups/class-group.service");
const CurriculumModel = require("../curriculum/curriculum.model");
const CurriculumVersionService = require("../curriculum/versions/curriculum-versions.service");
const ReportService = require("../reports/report.service");
const TimetableService = require("../timetable/timetable.service");
const SessionOccurrenceService = require("../timetable/session-occurrence.service");

// Tag is unique across every class, system-wide (not just within one hub) — it's how a specific
// class instance gets referenced unambiguously in reports/attendance even though many hubs can
// share the same gradeId/gradeName off the same curriculum. excludeId skips the record being
// updated so re-saving a class's own unchanged tag doesn't collide with itself.
async function assertTagAvailable(tag, excludeId) {
  if (!tag) return;
  const all = await ClassModel.findAll();
  const others = all.filter((c) => c.id !== excludeId);
  if (others.some((c) => c.tag && c.tag.toLowerCase() === tag.toLowerCase())) {
    const err = new Error("A class with this tag already exists");
    err.statusCode = 409;
    throw err;
  }
}

// A grade's first class at a hub for a given year needs no stream label — it's the only one.
// Any additional class in that same (schoolId, gradeId, academicYear) group must be told apart
// with a streamName, and that name can't repeat another stream already in the group, so the
// Classes grid never shows two identically-labeled cards for the same grade.
async function assertStreamAvailable(schoolId, gradeId, academicYear, streamName, excludeId) {
  const forSchool = await ClassModel.findAll({ schoolId });
  const group = forSchool.filter(
    (c) => c.id !== excludeId && c.gradeId === gradeId && c.academicYear === academicYear
  );
  if (group.length === 0) return;
  const norm = (s) => (s || "").trim().toLowerCase();
  if (!norm(streamName)) {
    const err = new Error("A class for this grade already exists at this hub — give this one a stream name to tell them apart");
    err.statusCode = 409;
    throw err;
  }
  if (group.some((c) => norm(c.streamName) === norm(streamName))) {
    const err = new Error("A class with this grade and stream already exists");
    err.statusCode = 409;
    throw err;
  }
}

// Finds this class's grade in its own curriculum's grade list and takes the next entry as "the
// next grade" — the curriculum's classes[] array has no explicit order field, so array position
// is the only sequencing signal available (assumes grades are authored in progression order).
// Next academic year is just +1 on this class's own year, matching how Set Up Year always mints
// one class per grade per year. Never creates the target class — only looks up whether Set Up
// Year has already created it, same shell assertStreamAvailable's uniqueness check assumes.
async function resolveNextClass(cls) {
  const curriculum = await CurriculumModel.findById(cls.curriculumId);
  const grades = curriculum?.classes || [];
  const idx = grades.findIndex((g) => g.id === cls.gradeId);
  if (idx === -1 || idx === grades.length - 1) {
    return { nextGradeId: null, nextGradeName: null, nextAcademicYear: null, nextClass: null };
  }
  const nextGrade = grades[idx + 1];
  const nextAcademicYear = String(Number(cls.academicYear) + 1);
  const siblings = await ClassModel.findAll({ schoolId: cls.schoolId });
  const nextClass = siblings.find((c) => c.gradeId === nextGrade.id && c.academicYear === nextAcademicYear) || null;
  return { nextGradeId: nextGrade.id, nextGradeName: nextGrade.name, nextAcademicYear, nextClass };
}

const ClassService = {
  async createClass(data) {
    await assertTagAvailable(data.tag, null);
    await assertStreamAvailable(data.schoolId, data.gradeId, data.academicYear, data.streamName, null);
    return ClassModel.create(data);
  },

  async getAllClasses(filters) {
    const classes = await ClassModel.findAll(filters);
    const classIds = classes.map((c) => c.id);
    const links = await LearnerHubLinkModel.findByClassIds(classIds);
    const countMap = {};
    for (const l of links) {
      if (!l.classId) continue;
      countMap[l.classId] = (countMap[l.classId] || 0) + 1;
    }
    return classes.map((c) => ({ ...c, learnerCount: countMap[c.id] || 0 }));
  },

  async getClassById(id) {
    const record = await ClassModel.findById(id);
    if (!record) {
      const err = new Error("Class not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async updateClass(id, data) {
    if (data.tag !== undefined) await assertTagAvailable(data.tag, id);
    if (data.streamName !== undefined) {
      const existing = await ClassModel.findById(id);
      if (existing) await assertStreamAvailable(existing.schoolId, existing.gradeId, existing.academicYear, data.streamName, id);
    }
    const record = await ClassModel.update(id, data);
    if (!record) {
      const err = new Error("Class not found");
      err.statusCode = 404;
      throw err;
    }
    return record;
  },

  async bulkCreateClasses(items) {
    // Bulk-created items (Set Up Year, Program deployment) never carry a tag today, but guard
    // against both a collision with an already-saved class and a duplicate within this same
    // batch, same as a one-at-a-time create would catch.
    const seen = new Set();
    for (const item of items) {
      if (!item.tag) continue;
      const key = item.tag.toLowerCase();
      if (seen.has(key)) {
        const err = new Error("A class with this tag already exists");
        err.statusCode = 409;
        throw err;
      }
      seen.add(key);
      await assertTagAvailable(item.tag, null);
    }
    // Set Up Year / Program deployment each create exactly one class per grade per batch, so
    // there's never a same-grade collision within the batch itself — only against classes that
    // already exist from an earlier run.
    for (const item of items) {
      await assertStreamAvailable(item.schoolId, item.gradeId, item.academicYear, item.streamName, null);
    }
    return Promise.all(items.map((item) => ClassModel.create(item)));
  },

  // A learner has "completed" this class's grade once every course the grade's curriculum
  // version assigns to it is `ready` per ReportService.getReadinessForClassCourses — the exact
  // signal the Reports page already uses for "this course's final report can be generated"
  // (every session-attached assessment graded+published), reused here rather than building a
  // second completion tracker. A grade with zero courses, or any course with zero gradeable
  // content, can never read as ready — inherited from isCourseReadyForLearner, not special-cased.
  async getPromotionReadiness(classId) {
    const cls = await ClassService.getClassById(classId);
    const nextInfo = await resolveNextClass(cls);
    const courses = await CurriculumVersionService.getCurrentCourses(cls.curriculumId, cls.gradeId);
    const courseIds = courses.map((c) => c.id);
    const links = await LearnerHubLinkModel.findByClassId(classId);
    const activeLearnerIds = links.filter((l) => l.status === "active").map((l) => l.learnerId);

    let learners = activeLearnerIds.map((learnerId) => ({ learnerId, ready: false, completedCourses: 0, totalCourses: courseIds.length }));
    if (courseIds.length > 0 && activeLearnerIds.length > 0) {
      const readinessByCourse = await ReportService.getReadinessForClassCourses(classId, courseIds);
      learners = activeLearnerIds.map((learnerId) => {
        const completedCourses = courseIds.filter((courseId) =>
          (readinessByCourse[courseId] || []).find((r) => r.learner.id === learnerId)?.ready
        ).length;
        return { learnerId, completedCourses, totalCourses: courseIds.length, ready: completedCourses === courseIds.length };
      });
    }

    return { ...nextInfo, totalCourses: courseIds.length, learners };
  },

  // The four-metric close-out checklist for a class's academic year — the gate the Promotion
  // panel and the class-detail "completion" panel both read. Each metric is derived live, never
  // stored: nothing here is a flag someone sets, it's all computed from the same records the
  // rest of the app already writes.
  //
  //   1. sessionsTaught    — every past session occurrence marked taught (or cancelled).
  //   2. grading           — every session-attached assessment graded+published for every
  //                          active learner (ReportService's existing readiness signal).
  //   3. attendanceClosed  — every past session occurrence has attendance either taken or
  //                          consciously locked as not-marked (never left as "not_taken").
  //   4. reports           — every (learner, non-empty session) pair has a published session
  //                          report — a real one, or a filed "not submitted" one.
  //
  // Metrics 1 & 3 come from SessionOccurrenceService; 2 & 4 from ReportService. `unresolved`
  // lists the concrete work items still blocking 2 & 4 so the UI can link straight to them.
  async getCompletionStatus(classId) {
    const cls = await ClassService.getClassById(classId);
    const courses = await CurriculumVersionService.getCurrentCourses(cls.curriculumId, cls.gradeId);
    const courseIds = courses.map((c) => c.id);

    const links = await LearnerHubLinkModel.findByClassId(classId);
    const activeLearnerIds = links.filter((l) => l.status === "active").map((l) => l.learnerId);

    const occurrence = await SessionOccurrenceService.getOccurrenceCompletion(
      classId,
      (args) => TimetableService.resolveCalendar(args)
    );

    // Grading + reports readiness, per course, reusing the exact signal the Reports page uses.
    let readinessByCourse = {};
    if (courseIds.length > 0 && activeLearnerIds.length > 0) {
      readinessByCourse = await ReportService.getReadinessForClassCourses(classId, courseIds);
    }
    const allRows = courseIds.flatMap((id) => readinessByCourse[id] || []);
    // "Grading done" = every per-learner row across every course is `ready` (its own readiness
    // flag already means every session-attached assessment graded AND published).
    const gradingTotal = allRows.length;
    const gradingReady = allRows.filter((r) => r.ready).length;

    const unresolved = (courseIds.length > 0 && activeLearnerIds.length > 0)
      ? await ReportService.getUnresolvedSessionWork(classId, courseIds)
      : { needsGrading: [], notSubmitted: [] };

    const metrics = {
      sessionsTaught: {
        done: occurrence.sessionsTaught.pendingCount === 0 && occurrence.sessionsTaught.total > 0,
        ...occurrence.sessionsTaught,
      },
      attendanceClosed: {
        done: occurrence.attendanceClosed.pendingCount === 0 && occurrence.attendanceClosed.total > 0,
        ...occurrence.attendanceClosed,
      },
      grading: {
        done: gradingTotal > 0 && gradingReady === gradingTotal && unresolved.needsGrading.length === 0,
        total: gradingTotal,
        ready: gradingReady,
        pendingCount: unresolved.needsGrading.length,
      },
      reports: {
        done: gradingTotal > 0 && unresolved.needsGrading.length === 0 && unresolved.notSubmitted.length === 0,
        pendingCount: unresolved.notSubmitted.length,
      },
    };

    // A class with no active learners, or a grade with no courses, has nothing to complete —
    // treated as "not applicable" rather than "complete" so it never reads as a finished year
    // that just has no content.
    const applicable = courseIds.length > 0 && activeLearnerIds.length > 0 && occurrence.sessionsTaught.total > 0;
    const complete = applicable && Object.values(metrics).every((m) => m.done);

    return {
      classId,
      applicable,
      complete,
      metrics,
      unresolved,
      totalCourses: courseIds.length,
      activeLearners: activeLearnerIds.length,
    };
  },

  // Re-resolves readiness/next-class server-side rather than trusting whatever the client sends
  // — a stale or manipulated request can never move an unready or unenrolled learner. Only ever
  // moves a learner INTO an already-existing class shell (Set Up Year's job, not this one's).
  async promoteLearners(classId, learnerIds) {
    const readiness = await ClassService.getPromotionReadiness(classId);
    if (!readiness.nextClass) {
      const err = new Error(
        readiness.nextGradeId
          ? `Set up classes for ${readiness.nextAcademicYear} first`
          : "This is the final grade — there's no next class to promote into"
      );
      err.statusCode = 409;
      throw err;
    }
    const readyById = new Map(readiness.learners.map((l) => [l.learnerId, l.ready]));
    const links = await LearnerHubLinkModel.findByClassId(classId);
    const linkByLearnerId = new Map(links.map((l) => [l.learnerId, l]));

    const promoted = [];
    const skipped = [];
    for (const learnerId of learnerIds) {
      const link = linkByLearnerId.get(learnerId);
      if (!link) { skipped.push({ learnerId, reason: "Not enrolled in this class" }); continue; }
      if (!readyById.get(learnerId)) { skipped.push({ learnerId, reason: "Hasn't completed every course yet" }); continue; }
      await LearnerHubLinkModel.update(link.id, { classId: readiness.nextClass.id });
      promoted.push(learnerId);
    }
    return { promoted, skipped, nextClass: readiness.nextClass };
  },

  async deleteClass(id) {
    const deleted = await ClassModel.delete(id);
    if (!deleted) {
      const err = new Error("Class not found");
      err.statusCode = 404;
      throw err;
    }
    // Learners enrolled here stay enrolled at the hub, just no longer placed in a class.
    await LearnerHubLinkModel.clearClassId(id);
    await ClassCourseTeacherLinkModel.deleteByClassId(id);
    await TimetableModel.deleteByClassId(id);
    await CourseScheduleModel.deleteByClassId(id);
    await SessionSkipModel.deleteByClassId(id);
    await AttendanceModel.deleteByClassId(id);
    await SessionOccurrenceService.deleteAllForClass(id);
    await ClassGroupService.deleteAllForClass(id);
    // Only class-owned issues (no learnerId — see AssessmentIssueModel's own comment) go with the
    // class, mirroring learner.service.js's deleteLearner doing the exact opposite: it removes
    // learner-targeted issues and leaves class-owned ones alone. Learner-targeted submissions/issues
    // that merely reference this classId are real graded work belonging to a learner, not the class,
    // so they're deliberately left in place — same tolerance already relied on by revokeIssue().
    const issues = await AssessmentIssueModel.findAll({ classId: id });
    await Promise.all(issues.filter((i) => i.learnerId == null).map((i) => AssessmentIssueModel.delete(i.id)));
    return { message: "Class deleted successfully" };
  },
};

module.exports = ClassService;

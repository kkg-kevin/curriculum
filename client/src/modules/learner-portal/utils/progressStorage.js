import { SECTIONS } from "../../courses/sectionConfig";

const STORAGE_KEY = "digifunzi.learner-progress";

function readStore() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeStore(data) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function normalizeEmail(email) {
  return (email || "guest").toLowerCase();
}

export function getLearnerProgress(email) {
  const key = normalizeEmail(email);
  const data = readStore();
  return data[key] || { courses: {} };
}

export function setLearnerProgress(email, progress) {
  const key = normalizeEmail(email);
  const data = readStore();
  data[key] = progress;
  writeStore(data);
}

export function updateCourseProgress(email, courseId, courseName, status) {
  const progress = getLearnerProgress(email);
  const next = {
    ...progress,
    courses: {
      ...(progress.courses || {}),
      [courseId]: {
        courseName: courseName || progress.courses?.[courseId]?.courseName || `Course ${courseId}`,
        status,
        updatedAt: new Date().toISOString(),
      },
    },
  };

  setLearnerProgress(email, next);
  return next;
}

export function getCourseProgress(email, courseId) {
  const progress = getLearnerProgress(email);
  return progress.courses?.[courseId] || null;
}

export function getProgressSummary(email) {
  const progress = getLearnerProgress(email);
  const courses = Object.values(progress.courses || {});
  const completed = courses.filter((course) => course.status === "completed").length;
  const inProgress = courses.filter((course) => course.status === "in-progress").length;
  const started = completed + inProgress;
  const total = courses.length;

  return {
    total,
    completed,
    inProgress,
    started,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

/* ── Section-level completion (per session, per section) ─────────────────
   A section is marked complete the moment a learner opens it — every
   session always exposes the same fixed set of SECTIONS regardless of
   whether each one has content, so `sessionCount * SECTIONS.length` is an
   exact (not approximate) total, letting course-card completion be computed
   from `course.sessionCount` alone without fetching that course's sessions. */

export function getCourseSectionProgress(email, courseId) {
  const progress = getLearnerProgress(email);
  return (progress.sectionProgress || {})[courseId] || {};
}

export function isSectionComplete(email, courseId, sessionId, sectionKey) {
  const sessionProgress = getCourseSectionProgress(email, courseId)[sessionId];
  return !!sessionProgress?.[sectionKey];
}

export function markSectionComplete(email, courseId, sessionId, sectionKey) {
  const progress = getLearnerProgress(email);
  if (progress.sectionProgress?.[courseId]?.[sessionId]?.[sectionKey]) return progress;

  const sectionProgress = progress.sectionProgress || {};
  const courseProgress = sectionProgress[courseId] || {};
  const sessionProgress = courseProgress[sessionId] || {};

  const next = {
    ...progress,
    sectionProgress: {
      ...sectionProgress,
      [courseId]: {
        ...courseProgress,
        [sessionId]: { ...sessionProgress, [sectionKey]: new Date().toISOString() },
      },
    },
  };

  setLearnerProgress(email, next);
  return next;
}

export function getSessionCompletion(email, courseId, sessionId) {
  const sessionProgress = getCourseSectionProgress(email, courseId)[sessionId] || {};
  const completed = SECTIONS.filter((s) => sessionProgress[s.key]).length;
  return { completed, total: SECTIONS.length, percent: Math.round((completed / SECTIONS.length) * 100) };
}

export function countCompletedSections(email, courseId) {
  const courseProgress = getCourseSectionProgress(email, courseId);
  return Object.values(courseProgress).reduce((sum, sessionMap) => sum + Object.keys(sessionMap).length, 0);
}

export function getCourseCompletionPercent(email, courseId, sessionCount) {
  const totalSections = (sessionCount || 0) * SECTIONS.length;
  if (!totalSections) return 0;
  return Math.min(100, Math.round((countCompletedSections(email, courseId) / totalSections) * 100));
}

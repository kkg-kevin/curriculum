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

// Real, section-driven aggregate across a course list — the single source of truth for
// "how much has this learner actually done," used by Dashboard, My Courses, and Progress so
// they can never disagree with each other the way a separate self-reported status ever could.
export function summarizeCoursesProgress(email, courses) {
  const withPercent = (courses || []).map((c) => ({ ...c, percent: getCourseCompletionPercent(email, c.id, c.sessionCount ?? 0) }));
  const completed = withPercent.filter((c) => c.percent === 100).length;
  const inProgress = withPercent.filter((c) => c.percent > 0 && c.percent < 100).length;
  const total = withPercent.length;
  const avgPercent = total ? Math.round(withPercent.reduce((sum, c) => sum + c.percent, 0) / total) : 0;

  return { courses: withPercent, total, completed, inProgress, notStarted: total - completed - inProgress, percent: avgPercent };
}

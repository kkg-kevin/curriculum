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

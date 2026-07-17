// A School-role user manages the same class/teacher/learner records as Admin, but scoped
// under /school-portal instead of the cross-school admin console. These helpers pick the
// right base path so every card/breadcrumb/redirect stays inside whichever tree the current
// user is allowed in, instead of bouncing them back out via RoleRoute.

export function classesListPath(role, schoolId) {
  return role === "school" ? `/school-portal/classes/${schoolId}` : "/classes";
}

export function classPath(role, id, action) {
  return role === "school" ? `/school-portal/classes/${id}/${action}` : `/classes/${id}/${action}`;
}

export function teachersListPath(role, schoolId) {
  return role === "school" ? `/school-portal/teachers/${schoolId}` : "/teachers";
}

export function teacherPath(role, id, action) {
  return role === "school" ? `/school-portal/teachers/${id}/${action}` : `/teachers/${id}/${action}`;
}

export function teacherCreatePath(role, schoolId) {
  const base = role === "school" ? "/school-portal/teachers/create" : "/teachers/create";
  return schoolId ? `${base}?schoolId=${schoolId}` : base;
}

export function learnersListPath(role, schoolId) {
  return role === "school" ? `/school-portal/learners/${schoolId}` : "/learners";
}

export function learnerPath(role, id, action) {
  return role === "school" ? `/school-portal/learners/${id}/${action}` : `/learners/${id}/${action}`;
}

export function learnerCreatePath(role, schoolId) {
  const base = role === "school" ? "/school-portal/learners/create" : "/learners/create";
  return schoolId ? `${base}?schoolId=${schoolId}` : base;
}

export function classCreatePath(role, schoolId) {
  const base = role === "school" ? "/school-portal/classes/create" : "/classes/create";
  return schoolId ? `${base}?schoolId=${schoolId}` : base;
}

// A school views its own profile in-portal; admin views any school through the cross-school
// directory.
export function schoolViewPath(role, schoolId) {
  return role === "school" ? "/school-portal/profile" : `/locations/${schoolId}/view`;
}

// Course content is read-only for Teacher/Learner/School (their own routes never reach the
// admin session editor) but shares the exact same viewer page (SectionViewPage) across all roles.

export function courseCatalogPath(role) {
  if (role === "teacher") return "/teacher-portal/course-content";
  if (role === "school") return "/school-portal/curriculum";
  return "/learner-portal/courses";
}

export function courseHomePath(role, courseId) {
  if (role === "teacher") return `/teacher-portal/course-content/${courseId}`;
  if (role === "learner") return `/learner-portal/courses/${courseId}`;
  if (role === "school") return `/school-portal/curriculum/${courseId}`;
  return `/courses/${courseId}/view`;
}

export function sectionPath(role, courseId, sessionId, sectionKey, itemId) {
  const base = role === "teacher" ? `/teacher-portal/course-content/${courseId}`
    : role === "learner" ? `/learner-portal/courses/${courseId}`
    : role === "school" ? `/school-portal/curriculum/${courseId}`
    : `/courses/${courseId}`;
  return `${base}/sessions/${sessionId}/sections/${sectionKey}${itemId ? `/${itemId}` : ""}`;
}

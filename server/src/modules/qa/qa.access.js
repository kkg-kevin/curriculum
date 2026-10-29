const db = require("../../config/db");
const { adminIdsOf } = require("../../shared/utils/organisation");
const SupervisorService = require("../claims/supervisor.service");
const { visibleToVisited } = require("./qa.rules");

// Who sees what in quality assurance.
//
//   admin       the workspace's admins, and staff whose role grants "Quality assurance" (the admin
//               app, /qa) — every educator, template, schedule and visit of the workspace.
//   supervisor  the educators assigned to them (the educator form's supervisor, teachers.supervisorId)
//               and any visit they're the reviewer of; templates are the workspace's, shared.
//   educator    their own visits: an announced one beforehand, every one once its report is in —
//               the full report, and their reply. A surprise visit stays hidden until then.
//   hub         the hub's own login: visits at that hub, on the same terms as the educator, but
//               only a summary of each report (the score, per section, the strengths and the areas
//               to improve — not each item, the overall remarks or the educator's reply).

function contextOf(req) {
  const base = { userId: req.user.id };
  if (req.user.role === "school") return { ...base, kind: "hub", ownerAdminId: req.ownSchool?.ownerAdminId || null, hubId: req.ownSchool?.id || null };
  if (req.user.role === "teacher") return { ...base, kind: "educator", teacherId: req.ownTeacher?.id || null, ownerAdminId: null };
  if (req.user.role === "supervisor") return { ...base, kind: "supervisor", ownerAdminId: req.user.invitedByAdminId || null };
  return { ...base, kind: "admin", ownerAdminId: req.ownerAdminId };
}

const isReviewerKind = (ctx) => ctx.kind === "admin" || ctx.kind === "supervisor";

const teacherName = (t) => [t?.firstName, t?.lastName].filter(Boolean).join(" ").trim() || t?.email || "Educator";

// The workspace's educators: added by it, linked to one of its hubs, or teaching a class at one.
async function workspaceTeacherIds(ownerAdminId) {
  const hubIds = await db("learning_hubs").where({ ownerAdminId }).pluck("id");
  const hubs = hubIds.length ? hubIds : ["__none__"];
  const [created, linked, teaching] = await Promise.all([
    db("teachers").where({ createdByAdminId: ownerAdminId }).pluck("id"),
    db("teacher_hub_links").whereIn("hubId", hubs).distinct("teacherId").pluck("teacherId"),
    db("class_course_teacher_links").whereIn("classId", db("classes").whereIn("schoolId", hubs).select("id")).distinct("teacherId").pluck("teacherId"),
  ]);
  return [...new Set([...created, ...linked, ...teaching])];
}

// The educators this reviewer may plan visits for: a supervisor's own; an admin's whole workspace.
async function reviewableTeacherIds(ctx) {
  if (ctx.kind === "supervisor") return db("teachers").where({ supervisorId: ctx.userId }).pluck("id");
  if (ctx.kind === "admin") return workspaceTeacherIds(ctx.ownerAdminId);
  return [];
}

async function assertReviewable(ctx, teacherId) {
  const ids = await reviewableTeacherIds(ctx);
  if (!ids.includes(teacherId)) {
    throw Object.assign(new Error(ctx.kind === "supervisor" ? "You can only plan visits for the educators assigned to you" : "Educator not found"), { statusCode: ctx.kind === "supervisor" ? 403 : 404 });
  }
}

// The hubs (of this workspace) an educator works at: linked to, or teaching a class at.
async function hubsOfTeacher(teacherId, ownerAdminId) {
  const ids = [...new Set([
    ...(await db("teacher_hub_links").where({ teacherId }).pluck("hubId")),
    ...(await db("classes").whereIn("id", db("class_course_teacher_links").where({ teacherId }).select("classId")).pluck("schoolId")),
  ].filter(Boolean))];
  if (!ids.length) return [];
  return db("learning_hubs").whereIn("id", ids).where({ ownerAdminId }).select("id", "name").orderBy("name", "asc");
}

// Who can review for the workspace: its admins and its supervisors. A supervisor reviews for
// themselves only, so they're offered just that.
async function reviewerOptions(ctx) {
  if (ctx.kind === "supervisor") {
    const me = await db("users").where({ id: ctx.userId }).first("id", "name", "email");
    return me ? [{ id: me.id, name: me.name || me.email, kind: "supervisor" }] : [];
  }
  const adminIds = await adminIdsOf(ctx.ownerAdminId);
  const [admins, supervisors] = await Promise.all([
    adminIds.length ? db("users").whereIn("id", adminIds).whereNull("deactivatedAt").select("id", "name", "email") : [],
    SupervisorService.list(ctx.ownerAdminId),
  ]);
  return [
    ...supervisors.map((s) => ({ id: s.id, name: s.name || s.email, kind: "supervisor" })),
    ...admins.filter((a) => !supervisors.some((s) => s.id === a.id)).map((a) => ({ id: a.id, name: a.name || a.email, kind: "admin" })),
  ].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

// Whether this person may see (and, as a reviewer, work on) one visit. `teacher` is the visited
// educator's row (for their supervisor).
function canSeeVisit(ctx, visit, teacher) {
  if (ctx.kind === "admin") return visit.ownerAdminId === ctx.ownerAdminId;
  if (ctx.kind === "supervisor") return visit.ownerAdminId === ctx.ownerAdminId && (visit.reviewerId === ctx.userId || teacher?.supervisorId === ctx.userId);
  if (ctx.kind === "educator") return Boolean(ctx.teacherId) && visit.teacherId === ctx.teacherId && visibleToVisited(visit);
  if (ctx.kind === "hub") return Boolean(ctx.hubId) && visit.hubId === ctx.hubId && visibleToVisited(visit);
  return false;
}

// Writing the review, moving or cancelling the visit: the workspace's admins, the visit's reviewer,
// and the educator's supervisor.
function canWorkOnVisit(ctx, visit, teacher) {
  return isReviewerKind(ctx) && canSeeVisit(ctx, visit, teacher);
}

module.exports = {
  contextOf, isReviewerKind, teacherName, workspaceTeacherIds, reviewableTeacherIds, assertReviewable, hubsOfTeacher, reviewerOptions, canSeeVisit, canWorkOnVisit,
};

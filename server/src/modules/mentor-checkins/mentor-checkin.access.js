const db = require("../../config/db");
const { can } = require("../access/access.service");

// Who sees what in parent–mentor check-ins.
//
//   manager     the workspace's admins, and staff whose role grants "mentor-checkins" (the admin
//               app, /mentor-checkins): every round, its schedule and every report; with create /
//               edit, setting rounds up, moving a family's time, cancelling, and the templates.
//   educator    (teacher portal) the check-ins of the rounds they're an educator on — every family's
//               time; they write the report (any of the round's educators).
//   parent      (/parent, a parent's own email login — never a child's username login) their own
//               check-ins: when, Join, confirm or pick another free time, read and approve the report.
//   hub         the hub's own login (hub portal): its classes' schedules — times and where each
//               stands, never the reports.
//   supervisor  (supervisor portal) the schedules of rounds with one of their educators
//               (teachers.supervisorId) — never the reports.
//
// Every list and record is checked per record in mentor-checkin.service.js against this.

const lower = (v) => String(v || "").trim().toLowerCase();

async function contextOf(req) {
  const { role } = req.user;
  const base = { userId: req.user.id };
  if (role === "admin") {
    const isStaff = req.user.actualRole === "collaborator";
    const permissions = req.user.permissions || null;
    return {
      ...base, kind: "manager", ownerAdminId: req.ownerAdminId, isStaff,
      canManage: !isStaff || can(permissions, "mentor-checkins", "create") || can(permissions, "mentor-checkins", "edit"),
      canSeeReports: true,
    };
  }
  if (role === "supervisor") {
    const teacherIds = await db("teachers").where({ supervisorId: req.user.id }).pluck("id");
    return { ...base, kind: "supervisor", ownerAdminId: req.user.invitedByAdminId || null, teacherIds };
  }
  if (role === "school" && !req.user.hubLead) {
    return { ...base, kind: "hub", hubIds: (req.ownSchools || (req.ownSchool ? [req.ownSchool] : [])).map((h) => h.id), hubId: req.ownSchool?.id || null };
  }
  if (role === "teacher") {
    const teacherIds = req.user.email ? await db("teachers").whereRaw("LOWER(email) = ?", [lower(req.user.email)]).pluck("id") : [];
    return { ...base, kind: "educator", teacherIds, canSeeReports: true };
  }
  if (role === "learner" && !req.user.username && !req.user.totLearner) {
    return { ...base, kind: "parent", canSeeReports: true };
  }
  return null;
}

// Whether this person may read this round (and its schedule).
function canSeeRound(ctx, round) {
  if (!ctx || !round) return false;
  const educators = round.educatorIds || [];
  switch (ctx.kind) {
    case "manager": return round.ownerAdminId === ctx.ownerAdminId;
    case "supervisor": return round.ownerAdminId === ctx.ownerAdminId && educators.some((id) => ctx.teacherIds.includes(id));
    case "hub": return ctx.hubIds.includes(round.hubId);
    case "educator": return educators.some((id) => ctx.teacherIds.includes(id));
    default: return false;
  }
}

// Whether this person may read this check-in, and how much of it.
function meetingAccess(ctx, round, meeting) {
  if (!ctx || !round || !meeting) return null;
  if (ctx.kind === "parent") return meeting.parentUserId === ctx.userId ? { report: true, asParent: true } : null;
  if (!canSeeRound(ctx, round)) return null;
  return { report: ctx.kind === "manager" || ctx.kind === "educator", asEducator: ctx.kind === "educator", asManager: ctx.kind === "manager" };
}

module.exports = { contextOf, canSeeRound, meetingAccess };

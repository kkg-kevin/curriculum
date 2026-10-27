const db = require("../../config/db");
const { can } = require("../access/access.service");
const { adminIdsOf } = require("../../shared/utils/organisation");

// Who sees what in hub check-ins.
//
//   managers  the workspace's admins, and staff whose role can view "checkins-manage" (the admin
//             app, /checkins) — every hub, the schedules.
//   everyone  else: a hub's Account Manager and Training Lead, named on the hub itself (an educator,
//             say). They work in the hub portal — a "school" session with req.user.hubLead (see
//             account-roles.js) — and see only the hubs they're on: those hubs' check-ins and
//             earlier reports. An educator's own session (the teacher portal) can only ask what's
//             due, for the sign-in pop-up.
//   the hub   itself (its own login in the hub portal): its own check-ins and reports, read only.
//
// A check-in's report is written by its Account Manager or Training Lead, or a manager.

function contextOf(req) {
  // The hub's own login (the hub portal, not as an Account Manager / Training Lead): its own
  // check-ins and their reports, read only — the hub it's working in (req.ownSchool).
  if (req.user.role === "school" && !req.user.hubLead) {
    return {
      userId: req.user.id,
      ownerAdminId: req.ownSchool?.ownerAdminId || null,
      hubId: req.ownSchool?.id || null,
      isHub: true,
      isStaff: false,
      isManager: false,
      canManageSchedules: false,
    };
  }
  // An Account Manager / Training Lead in the hub portal, or an educator in the teacher portal.
  if (req.user.hubLead || req.user.role === "teacher") {
    return {
      userId: req.user.id,
      ownerAdminId: req.ownSchool?.ownerAdminId || null,
      isStaff: true,
      isManager: false,
      canManageSchedules: false,
    };
  }
  const isStaff = req.user.actualRole === "collaborator";
  const permissions = req.user.permissions || null;
  return {
    userId: req.user.id,
    ownerAdminId: req.ownerAdminId,
    isStaff,
    isManager: !isStaff || can(permissions, "checkins-manage", "view"),
    canManageSchedules: !isStaff || can(permissions, "checkins-manage", "edit") || can(permissions, "checkins-manage", "create"),
  };
}

// The hubs a non-manager is assigned to, on any schedule or session in the workspace.
async function assignedHubIds(ctx) {
  const [fromSchedules, fromSessions] = await Promise.all([
    db("checkin_schedules").where({ ownerAdminId: ctx.ownerAdminId }).where((w) => w.where({ accountManagerId: ctx.userId }).orWhere({ trainingLeadId: ctx.userId })).distinct("hubId").pluck("hubId"),
    db("checkin_sessions").where({ ownerAdminId: ctx.ownerAdminId }).where((w) => w.where({ accountManagerId: ctx.userId }).orWhere({ trainingLeadId: ctx.userId })).distinct("hubId").pluck("hubId"),
  ]);
  return [...new Set([...fromSchedules, ...fromSessions])];
}

const isAssignedTo = (ctx, session) => session.accountManagerId === ctx.userId || session.trainingLeadId === ctx.userId;

// Who can be a hub's Account Manager or Training Lead: the workspace's admins, and its educators
// who have a login (created by the workspace, or teaching at one of its hubs). The id is the
// login's (users.id) — what check-ins and the hub record.
async function workspacePeople(ownerAdminId) {
  const adminIds = await adminIdsOf(ownerAdminId);
  const owners = [...new Set([ownerAdminId, ...adminIds])];
  const hubIds = await db("learning_hubs").where({ ownerAdminId }).pluck("id");
  const teachers = await db("teachers")
    .where((w) => w.whereIn("createdByAdminId", owners).orWhereIn("id", db("teacher_hub_links").whereIn("hubId", hubIds.length ? hubIds : ["__none__"]).select("teacherId")))
    .whereNotNull("email")
    .select("email", "status");
  const emails = [...new Set(teachers.filter((t) => (t.status || "active") !== "inactive").map((t) => String(t.email).toLowerCase()))];
  const [admins, educators] = await Promise.all([
    adminIds.length ? db("users").whereIn("id", adminIds).whereNull("deactivatedAt").select("id", "name", "email") : [],
    emails.length ? db("users").whereIn(db.raw("LOWER(email)"), emails).whereNot({ role: "admin" }).whereNull("deactivatedAt").select("id", "name", "email") : [],
  ]);
  const people = [
    ...admins.map((u) => ({ id: u.id, name: u.name || u.email, email: u.email, kind: "admin", roleName: "Admin", canUseCheckins: true, isManager: true })),
    ...educators.map((u) => ({ id: u.id, name: u.name || u.email, email: u.email, kind: "educator", roleName: "Educator", canUseCheckins: true, isManager: false })),
  ];
  return people.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

module.exports = { contextOf, assignedHubIds, isAssignedTo, workspacePeople };

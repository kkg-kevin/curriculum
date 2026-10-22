const db = require("../../config/db");
const AccessService = require("../access/access.service");
const { can } = require("../access/access.service");
const { adminIdsOf } = require("../../shared/utils/organisation");

// Who sees what in hub check-ins. The route-level gate is the existing staff-role check (scope.
// middleware.js + access.registry.js: "checkins" to take part, "checkins-manage" for schedules and
// the overview). On top of that, every record is checked here against the person:
//
//   managers  the workspace owner (any admin of it), or staff whose role can view "checkins-manage"
//             — every hub in the workspace.
//   everyone  else (an Account Manager or Training Lead): only hubs they are assigned to on a
//             schedule or a session — those hubs' check-ins, history and actions — plus any action
//             assigned to them anywhere.
//
// A session's report is written by its assigned Account Manager and Training Lead, or a manager.

function contextOf(req) {
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

// People who can be put on a check-in or given an action: the workspace's admins and its active
// staff. `canUseCheckins` says whether their role lets them open Hub check-ins at all.
async function workspacePeople(ownerAdminId) {
  const adminIds = await adminIdsOf(ownerAdminId);
  const [admins, staff] = await Promise.all([
    adminIds.length ? db("users").whereIn("id", adminIds).whereNull("deactivatedAt").select("id", "name", "email", "role") : [],
    db("users").where({ role: "collaborator", invitedByAdminId: ownerAdminId }).whereNull("deactivatedAt").select("id", "name", "email", "role", "roleId", "allowedModules", "invitedByAdminId"),
  ]);
  const people = admins.map((u) => ({ id: u.id, name: u.name || u.email, email: u.email, kind: "admin", roleName: "Admin", canUseCheckins: true, isManager: true }));
  for (const user of staff) {
    const permissions = await AccessService.permissionsFor(user);
    const role = user.roleId ? await db("access_roles").where({ id: user.roleId }).select("name").first() : null;
    people.push({
      id: user.id, name: user.name || user.email, email: user.email, kind: "staff", roleName: role?.name || null,
      canUseCheckins: can(permissions, "checkins", "view") || can(permissions, "checkins-manage", "view"),
      isManager: can(permissions, "checkins-manage", "view"),
    });
  }
  return people.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

// Who hears about missed check-ins, critical hubs and escalations: the workspace's admins (one
// _notify to the owner id reaches them all) and staff who manage check-ins.
async function managerRecipientIds(ownerAdminId) {
  const people = await workspacePeople(ownerAdminId);
  return [ownerAdminId, ...people.filter((p) => p.kind === "staff" && p.isManager).map((p) => p.id)];
}

module.exports = { contextOf, assignedHubIds, isAssignedTo, workspacePeople, managerRecipientIds };

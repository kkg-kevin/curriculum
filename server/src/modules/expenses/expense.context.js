const asyncHandler = require("express-async-handler");
const db = require("../../config/db");
const TeacherModel = require("../teachers/teacher.model");
const AccessService = require("../access/access.service");
const { can } = require("../access/access.service");
const { CLAIMANT_ROLES } = require("./expense.rules");

// Who is asking, for every /api/expenses request. Expenses are for the people who work for the
// organisation — admins, staff, educators and supervisors — whichever of their sign-ins they use.
// Anyone of those may claim their own; this router therefore does NOT go through attachOwnRecords
// (which would refuse a staff member whose role lacks the Expenses module from claiming at all).
// Reviewing and paying are decided here instead:
//   admins                          see, approve and pay every claim of the workspace
//   staff, Expenses → View          see every claim of the workspace
//   staff, Expenses → Edit          also approve and pay (never their own)
//   supervisors                     decide the claims of the educators assigned to them
// sets req.ownerAdminId (the workspace) and req.expense.

// An admin id → the organisation key it works under (users.organisationId, else itself).
async function workspaceKeyOf(adminId) {
  if (!adminId) return null;
  const admin = await db("users").where({ id: adminId }).first("id", "organisationId");
  return admin?.organisationId || adminId;
}

// An educator has no workspace column of their own: the admin who created them, else the
// workspace of a hub they're linked to, else their supervisor's.
async function workspaceOfTeacher(teacher) {
  if (!teacher) return null;
  if (teacher.createdByAdminId) return workspaceKeyOf(teacher.createdByAdminId);
  const link = await db("teacher_hub_links").where({ teacherId: teacher.id }).first("hubId");
  if (link) {
    const hub = await db("learning_hubs").where({ id: link.hubId }).first("ownerAdminId");
    if (hub?.ownerAdminId) return workspaceKeyOf(hub.ownerAdminId);
  }
  if (teacher.supervisorId) {
    const sup = await db("users").where({ id: teacher.supervisorId }).first("invitedByAdminId");
    if (sup?.invitedByAdminId) return workspaceKeyOf(sup.invitedByAdminId);
  }
  return null;
}

const refuse = (status, message) => Object.assign(new Error(message), { statusCode: status });

const expenseContext = asyncHandler(async (req, res, next) => {
  const { role, id: userId } = req.user;
  if (!CLAIMANT_ROLES.includes(role)) throw refuse(403, "Expenses are for people who work for the organisation.");

  let ownerAdminId = null;
  let teacher = null;
  let permissions = null;
  if (role === "admin") ownerAdminId = req.user.organisationId || userId;
  if (role === "collaborator" || role === "supervisor") ownerAdminId = await workspaceKeyOf(req.user.invitedByAdminId);
  if (role === "collaborator") {
    permissions = await AccessService.permissionsFor(req.user);
    req.user.actualRole = "collaborator";
    req.user.permissions = permissions;
  }
  if (role === "teacher") {
    const teachers = await TeacherModel.findAll({ email: req.user.email });
    teacher = teachers.find((t) => !["inactive", "removed"].includes(t.status || "active")) || null;
    if (!teacher) throw refuse(403, "No active educator profile is linked to this account.");
    ownerAdminId = await workspaceOfTeacher(teacher);
  }
  if (!ownerAdminId) throw refuse(403, "This account isn't part of a workspace that can pay expenses back.");

  req.ownerAdminId = ownerAdminId;
  req.expense = {
    userId,
    role,
    ownerAdminId,
    teacher,
    canViewAll: role === "admin" || (role === "collaborator" && can(permissions, "expenses", "view")),
    canApprove: role === "admin" || (role === "collaborator" && can(permissions, "expenses", "edit")),
  };
  next();
});

module.exports = { expenseContext, workspaceKeyOf, workspaceOfTeacher };

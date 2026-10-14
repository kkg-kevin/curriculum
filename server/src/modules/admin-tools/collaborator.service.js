const UserModel = require("../auth/user.model");
const AuthService = require("../auth/auth.service");
const { MODULE_KEYS } = require("./module-registry");
const AccessService = require("../access/access.service");
const AccessRoleModel = require("../access/access-role.model");
const { releaseIfLeftover } = require("../auth/leftover-login");

// How an account type reads in "this email is already used by …".
const ACCOUNT_LABELS = {
  admin: "an admin",
  teacher: "an educator",
  school: "a learning hub",
  learner: "a learner or parent",
  supervisor: "a claims supervisor",
  curriculumAdmin: "a curriculum admin",
};

function sanitize(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

const CollaboratorService = {
  // Invites (or, if this email already collaborates with the SAME admin, resets the password of)
  // a collaborator into the calling admin's tenant. Deliberately does NOT reuse
  // AuthService.setOrCreatePassword as-is: that helper resets an existing same-role account's
  // password purely on email + role matching, with no notion of WHICH admin is doing the
  // inviting — fine for curriculumAdmin (one delegate, effectively one relationship to update),
  // but wrong here, where a second admin could otherwise "invite" (and silently take over) an
  // email that already collaborates with a DIFFERENT admin's tenant. So the cross-tenant check
  // runs first, before any password is touched.
  async invite({ name, email, password, invitedByAdminId, allowedModules, roleId }) {
    let existing = await UserModel.findByEmail(email);
    // An account no record points at any more (its educator, hub or learner was deleted, or the
    // workspace that invited it is gone) is invisible everywhere — free its email instead of
    // refusing. Checked only after the role, so nothing is removed for an invite that then fails.
    const isOtherAccount = existing && (existing.role !== "collaborator" || existing.invitedByAdminId !== invitedByAdminId);
    if (roleId) await AccessService.assertOwnRole(invitedByAdminId, roleId);
    if (isOtherAccount && (await releaseIfLeftover(existing))) existing = null;
    if (existing && existing.role !== "collaborator") {
      const err = new Error(`This email is already used by ${ACCOUNT_LABELS[existing.role] || `a ${existing.role}`} login — staff need an email of their own`);
      err.statusCode = 409;
      throw err;
    }
    if (existing && existing.invitedByAdminId !== invitedByAdminId) {
      const err = new Error("This email is already a staff member of another workspace");
      err.statusCode = 409;
      throw err;
    }
    // Omitted (undefined) means "every module" — matches how a pre-existing collaborator's NULL
    // db value is interpreted everywhere else (see scope.middleware.js, Sidebar.jsx). The invite
    // UI always sends an explicit array in practice; this default only matters for a caller that
    // bypasses it (e.g. direct API use).
    const modules = allowedModules === undefined ? MODULE_KEYS : allowedModules;
    const user = await AuthService.setOrCreatePassword({ name, email, password, role: "collaborator" });
    // Re-inviting an existing collaborator (password reset) also updates their module grant, so
    // editing access is possible through a re-invite, not only the dedicated PATCH endpoint below.
    const access = roleId ? { roleId } : { allowedModules: modules, roleId: null };
    const updated = await UserModel.update(user.id, existing ? access : { invitedByAdminId, ...access });
    return sanitize(updated);
  },

  async listForAdmin(invitedByAdminId) {
    const users = (await UserModel.findAll({ invitedByAdminId })).filter((u) => u.role === "collaborator");
    const roles = new Map((await AccessRoleModel.findAll(invitedByAdminId)).map((r) => [r.id, r]));
    return users.map((u) => {
      const role = roles.get(u.roleId);
      return { ...sanitize(u), role: role ? { id: role.id, name: role.name } : null };
    });
  },

  // Gives a staff member a different role — takes effect on their next request.
  async updateRole(id, invitedByAdminId, roleId) {
    const user = await UserModel.findById(id);
    if (!user || user.role !== "collaborator" || user.invitedByAdminId !== invitedByAdminId) {
      const err = new Error("Collaborator not found");
      err.statusCode = 404;
      throw err;
    }
    await AccessService.assertOwnRole(invitedByAdminId, roleId);
    return sanitize(await UserModel.update(id, { roleId }));
  },

  // Edits an existing collaborator's module grant — same ownership check shape as revoke() below.
  // Takes effect on the collaborator's very next request: scope.middleware.js's attachOwnRecords
  // reads req.user.allowedModules fresh every request (via protect's per-request UserModel/
  // AuthService lookup), never a cached/JWT-baked value.
  async updateModules(id, invitedByAdminId, allowedModules) {
    const user = await UserModel.findById(id);
    if (!user || user.role !== "collaborator" || user.invitedByAdminId !== invitedByAdminId) {
      const err = new Error("Collaborator not found");
      err.statusCode = 404;
      throw err;
    }
    // Clears any role so the module list actually applies (a role always takes precedence).
    const updated = await UserModel.update(id, { allowedModules, roleId: null });
    return sanitize(updated);
  },

  // Revoking just deletes the account outright (not a soft "unassign", unlike curriculumAdmin's
  // unassign-in-place) — a collaborator has no other purpose or identity once removed, same as
  // there being no "former collaborator, still logged in" state worth preserving.
  async revoke(id, invitedByAdminId) {
    const user = await UserModel.findById(id);
    if (!user || user.role !== "collaborator" || user.invitedByAdminId !== invitedByAdminId) {
      const err = new Error("Collaborator not found");
      err.statusCode = 404;
      throw err;
    }
    await UserModel.delete(id);
    return { message: "Collaborator removed" };
  },
};

module.exports = CollaboratorService;

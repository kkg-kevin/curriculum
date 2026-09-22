const UserModel = require("../auth/user.model");
const AuthService = require("../auth/auth.service");
const { MODULE_KEYS } = require("./module-registry");

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
  async invite({ name, email, password, invitedByAdminId, allowedModules }) {
    const existing = await UserModel.findByEmail(email);
    if (existing && existing.role !== "collaborator") {
      const err = new Error(`This email is already registered as a ${existing.role} account`);
      err.statusCode = 409;
      throw err;
    }
    if (existing && existing.invitedByAdminId !== invitedByAdminId) {
      const err = new Error("This email already collaborates with a different admin");
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
    const updated = await UserModel.update(user.id, existing ? { allowedModules: modules } : { invitedByAdminId, allowedModules: modules });
    return sanitize(updated);
  },

  async listForAdmin(invitedByAdminId) {
    const users = await UserModel.findAll({ invitedByAdminId });
    return users.filter((u) => u.role === "collaborator").map(sanitize);
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
    const updated = await UserModel.update(id, { allowedModules });
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

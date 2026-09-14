const UserModel = require("../auth/user.model");
const AuthService = require("../auth/auth.service");

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
  async invite({ name, email, password, invitedByAdminId }) {
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
    const user = await AuthService.setOrCreatePassword({ name, email, password, role: "collaborator" });
    if (!existing) {
      const updated = await UserModel.update(user.id, { invitedByAdminId });
      return sanitize(updated);
    }
    return sanitize(user);
  },

  async listForAdmin(invitedByAdminId) {
    const users = await UserModel.findAll({ invitedByAdminId });
    return users.filter((u) => u.role === "collaborator").map(sanitize);
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

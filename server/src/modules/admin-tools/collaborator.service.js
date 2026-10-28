const UserModel = require("../auth/user.model");
const AuthService = require("../auth/auth.service");
const { MODULE_KEYS } = require("./module-registry");
const AccessService = require("../access/access.service");
const AccessRoleModel = require("../access/access-role.model");
const { rolesOf } = require("../auth/account-roles");

function sanitize(user) {
  const { passwordHash, ...safe } = user;
  return safe;
}

const isOwnStaff = (user, invitedByAdminId) => Boolean(user) && rolesOf(user).includes("collaborator") && user.invitedByAdminId === invitedByAdminId;

const CollaboratorService = {
  // Makes this email staff of the calling admin's workspace (AuthService.addWorkspaceRole). An
  // email that already signs in — an educator, a parent — keeps its one login and password and
  // gains the Staff role; a password is needed only for a brand-new login (one given for an
  // existing login becomes its password for every role). Inviting this workspace's own staff
  // member again updates their access (and password, when given). Staff of another workspace,
  // admins and curriculum admins are refused.
  async invite({ name, email, password, invitedByAdminId, allowedModules, roleId }) {
    if (roleId) await AccessService.assertOwnRole(invitedByAdminId, roleId);
    // Omitted (undefined) means "every module" — matches how a pre-existing collaborator's NULL
    // db value is interpreted everywhere else (see scope.middleware.js, Sidebar.jsx). The invite
    // UI always sends an explicit array in practice; this default only matters for a caller that
    // bypasses it (e.g. direct API use).
    const modules = allowedModules === undefined ? MODULE_KEYS : allowedModules;
    const user = await AuthService.addWorkspaceRole({ name, email, password, role: "collaborator", ownerAdminId: invitedByAdminId });
    const access = roleId ? { roleId } : { allowedModules: modules, roleId: null };
    const updated = await UserModel.update(user.id, access);
    return { ...sanitize(updated), linked: !user.created };
  },

  async listForAdmin(invitedByAdminId) {
    const users = (await UserModel.findAll({ invitedByAdminId })).filter((u) => rolesOf(u).includes("collaborator"));
    const roles = new Map((await AccessRoleModel.findAll(invitedByAdminId)).map((r) => [r.id, r]));
    return users.map((u) => {
      const role = roles.get(u.roleId);
      return { ...sanitize(u), role: role ? { id: role.id, name: role.name } : null };
    });
  },

  // Gives a staff member a different role — takes effect on their next request.
  async updateRole(id, invitedByAdminId, roleId) {
    const user = await UserModel.findById(id);
    if (!isOwnStaff(user, invitedByAdminId)) {
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
    if (!isOwnStaff(user, invitedByAdminId)) {
      const err = new Error("Collaborator not found");
      err.statusCode = 404;
      throw err;
    }
    // Clears any role so the module list actually applies (a role always takes precedence).
    const updated = await UserModel.update(id, { allowedModules, roleId: null });
    return sanitize(updated);
  },

  // Removing a staff member takes the Staff role off their login. A login that only ever was staff
  // goes; one that is also an educator, a hub or a parent stays for those, with the same password.
  async revoke(id, invitedByAdminId) {
    const user = await UserModel.findById(id);
    if (!isOwnStaff(user, invitedByAdminId)) {
      const err = new Error("Collaborator not found");
      err.statusCode = 404;
      throw err;
    }
    await AuthService.dropRole(user, "collaborator");
    return { message: "Collaborator removed" };
  },
};

module.exports = CollaboratorService;

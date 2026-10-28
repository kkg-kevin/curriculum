const db = require("../../config/db");
const UserModel = require("../auth/user.model");
const AuthService = require("../auth/auth.service");
const { rolesOf } = require("../auth/account-roles");

// Claim supervisors: accounts that exist only to review the claims of the educators assigned to
// them (see the 20261008090000 migration). Created and managed by the workspace's admin; an
// educator is given one on the educator form.

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

const isSupervisor = (user) => Boolean(user) && rolesOf(user).includes("supervisor");

const publicShape = (user, educators = 0) => ({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, educators });

const SupervisorService = {
  async list(ownerAdminId) {
    const users = (await UserModel.findAll({ invitedByAdminId: ownerAdminId })).filter(isSupervisor);
    if (!users.length) return [];
    const rows = await db("teachers").whereIn("supervisorId", users.map((u) => u.id)).select("supervisorId").count({ count: "*" }).groupBy("supervisorId");
    const counts = new Map(rows.map((r) => [r.supervisorId, Number(r.count)]));
    return users.map((u) => publicShape(u, counts.get(u.id) || 0)).sort((a, b) => a.name.localeCompare(b.name));
  },

  // The supervisor with this id in this workspace — or a 404. Every write goes through it, so a
  // supervisor can never be reached from another workspace.
  async getOwned(id, ownerAdminId) {
    const user = id ? await UserModel.findById(id) : null;
    if (!isSupervisor(user) || user.invitedByAdminId !== ownerAdminId) fail("Supervisor not found", 404);
    return user;
  },

  // An email that already signs in (an educator, a staff member of this workspace) keeps its one
  // login and password and gains the Supervisor role; a password is needed only for a new login.
  async create(ownerAdminId, { name, email, password }) {
    const existing = await UserModel.findByEmail(email);
    if (existing && isSupervisor(existing) && existing.invitedByAdminId === ownerAdminId) fail("A supervisor with this email already exists", 409);
    const user = await AuthService.addWorkspaceRole({ name, email, password, role: "supervisor", ownerAdminId });
    return { ...publicShape(user), linked: !user.created };
  },

  async update(id, ownerAdminId, { name, password }) {
    const user = await SupervisorService.getOwned(id, ownerAdminId);
    if (password) await AuthService.setOrCreatePassword({ name: name || user.name, email: user.email, password, role: "supervisor" });
    const updated = name && name !== user.name ? await UserModel.update(id, { name }) : await UserModel.findById(id);
    return publicShape(updated);
  },

  // Removing a supervisor must not strand anything: their educators go back to having none, and
  // claims waiting on them pass to the admin to approve instead.
  async remove(id, ownerAdminId) {
    await SupervisorService.getOwned(id, ownerAdminId);
    await db("teachers").where({ supervisorId: id }).update({ supervisorId: null, updatedAt: new Date() });
    await db("teacher_claims").where({ supervisorId: id, status: "pending_supervisor" }).update({ status: "pending_admin", supervisorId: null, supervisorName: null, updatedAt: new Date() });
    // Only the Supervisor role goes — a login that is also an educator or staff stays for those.
    await AuthService.dropRole(await UserModel.findById(id), "supervisor");
    return { message: "Supervisor removed" };
  },
};

module.exports = SupervisorService;

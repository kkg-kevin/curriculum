const db = require("../../config/db");
const UserModel = require("../auth/user.model");
const UserSessionModel = require("../auth/user-session.model");
const AuthService = require("../auth/auth.service");

// Claim supervisors: accounts that exist only to review the claims of the educators assigned to
// them (see the 20261008090000 migration). Created and managed by the workspace's admin; an
// educator is given one on the educator form.

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

const publicShape = (user, educators = 0) => ({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt, educators });

const SupervisorService = {
  async list(ownerAdminId) {
    const users = (await UserModel.findAll({ invitedByAdminId: ownerAdminId })).filter((u) => u.role === "supervisor");
    if (!users.length) return [];
    const rows = await db("teachers").whereIn("supervisorId", users.map((u) => u.id)).select("supervisorId").count({ count: "*" }).groupBy("supervisorId");
    const counts = new Map(rows.map((r) => [r.supervisorId, Number(r.count)]));
    return users.map((u) => publicShape(u, counts.get(u.id) || 0)).sort((a, b) => a.name.localeCompare(b.name));
  },

  // The supervisor with this id in this workspace — or a 404. Every write goes through it, so a
  // supervisor can never be reached from another workspace.
  async getOwned(id, ownerAdminId) {
    const user = id ? await UserModel.findById(id) : null;
    if (!user || user.role !== "supervisor" || user.invitedByAdminId !== ownerAdminId) fail("Supervisor not found", 404);
    return user;
  },

  // A supervisor login is its own account: an email already used by an educator, staff member or
  // anyone else can't double as one.
  async create(ownerAdminId, { name, email, password }) {
    const existing = await UserModel.findByEmail(email);
    if (existing) fail(existing.role === "supervisor" ? "A supervisor with this email already exists" : `This email is already registered as a ${existing.role} account — a supervisor needs an email of their own`, 409);
    const user = await AuthService.createUser({ name, email, password, role: "supervisor" });
    return publicShape(await UserModel.update(user.id, { invitedByAdminId: ownerAdminId }));
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
    await UserSessionModel.deleteByUserId(id);
    await UserModel.delete(id);
    return { message: "Supervisor removed" };
  },
};

module.exports = SupervisorService;

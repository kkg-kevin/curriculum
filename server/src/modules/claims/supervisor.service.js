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

const publicShape = (user, educators = 0, extra = {}) => ({
  id: user.id, name: user.name, email: user.email, phone: user.phone || null, jobTitle: user.jobTitle || null, photo: user.photo || null,
  createdAt: user.createdAt, educators, deactivated: Boolean(user.deactivatedAt), ...extra,
});
const fullName = (t) => [t?.firstName, t?.lastName].filter(Boolean).join(" ").trim();

// The workspace's educators: made by it, or linked to one of its hubs (as the Educators list).
async function workspaceTeacherIds(ownerAdminId) {
  const hubIds = await db("learning_hubs").where({ ownerAdminId }).whereNot({ status: "removed" }).pluck("id");
  const [created, linked] = await Promise.all([
    db("teachers").where({ createdByAdminId: ownerAdminId }).pluck("id"),
    hubIds.length ? db("teacher_hub_links").whereIn("hubId", hubIds).distinct("teacherId").pluck("teacherId") : [],
  ]);
  return new Set([...created, ...linked]);
}

const lower = (s) => String(s || "").trim().toLowerCase();

// A supervisor never looks after their own educator record (the same person, by email).
async function refuseSelf(userId, teacherIds) {
  if (!teacherIds.length) return;
  const user = await db("users").where({ id: userId }).first("email");
  if (!user?.email) return;
  const own = await db("teachers").whereIn("id", teacherIds).whereRaw("LOWER(email) = ?", [lower(user.email)]).first("firstName", "lastName");
  if (own) fail(`${fullName(own)} can't supervise themselves — leave their own educator record out`, 400);
}

// Each supervisor's last sign-in (the activity log's "login").
async function lastSignIns(userIds) {
  if (!userIds.length) return new Map();
  const rows = await db("audit_log").whereIn("actorUserId", userIds).where({ action: "login" }).groupBy("actorUserId").select("actorUserId").max({ at: "createdAt" });
  return new Map(rows.map((r) => [r.actorUserId, r.at]));
}

const SupervisorService = {
  async list(ownerAdminId) {
    const users = (await UserModel.findAll({ invitedByAdminId: ownerAdminId })).filter(isSupervisor);
    if (!users.length) return [];
    const ids = users.map((u) => u.id);
    const [rows, waiting, signIns] = await Promise.all([
      db("teachers").whereIn("supervisorId", ids).whereNot({ status: "removed" }).select("supervisorId").count({ count: "*" }).groupBy("supervisorId"),
      db("teacher_claims").whereIn("supervisorId", ids).where({ status: "pending_supervisor" }).select("supervisorId").count({ count: "*" }).groupBy("supervisorId"),
      lastSignIns(ids),
    ]);
    const counts = new Map(rows.map((r) => [r.supervisorId, Number(r.count)]));
    const pending = new Map(waiting.map((r) => [r.supervisorId, Number(r.count)]));
    return users.map((u) => publicShape(u, counts.get(u.id) || 0, { claimsWaiting: pending.get(u.id) || 0, lastSignInAt: signIns.get(u.id) || null, otherRoles: rolesOf(u).filter((r) => r !== "supervisor") }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  // One supervisor's page (People -> Supervisors -> a supervisor, 17 Nov 2026): who they are, their
  // educators, and what's waiting on them.
  async get(id, ownerAdminId) {
    const user = await SupervisorService.getOwned(id, ownerAdminId);
    const teachers = await db("teachers").where({ supervisorId: id }).whereNot({ status: "removed" })
      .orderBy([{ column: "firstName" }, { column: "lastName" }]).select("id", "firstName", "lastName", "email", "photo", "status");
    const tIds = teachers.map((t) => t.id);
    const [hubLinks, waiting, decided, signIns] = await Promise.all([
      tIds.length ? db("teacher_hub_links as l").join("learning_hubs as h", "h.id", "l.hubId").whereIn("l.teacherId", tIds).select("l.teacherId", "h.name") : [],
      db("teacher_claims").where({ supervisorId: id, status: "pending_supervisor" }).count({ n: "*" }).first(),
      db("teacher_claims").where({ supervisorId: id }).whereNot({ status: "pending_supervisor" }).count({ n: "*" }).first(),
      lastSignIns([id]),
    ]);
    const hubsOf = (tid) => [...new Set(hubLinks.filter((l) => l.teacherId === tid).map((l) => l.name))];
    return {
      ...publicShape(user, teachers.length, { claimsWaiting: Number(waiting?.n || 0), claimsDecided: Number(decided?.n || 0), lastSignInAt: signIns.get(id) || null }),
      otherRoles: rolesOf(user).filter((r) => r !== "supervisor"),
      educatorList: teachers.map((t) => ({ id: t.id, name: fullName(t), email: t.email || null, photo: t.photo || null, status: t.status || "active", hubs: hubsOf(t.id) })),
    };
  },

  // The workspace's educators to choose from, each with the supervisor they have now (if any).
  async educatorOptions(ownerAdminId) {
    const ids = [...(await workspaceTeacherIds(ownerAdminId))];
    if (!ids.length) return [];
    const teachers = await db("teachers").whereIn("id", ids).whereNotIn("status", ["removed"])
      .select("id", "firstName", "lastName", "email", "photo", "status", "supervisorId");
    const supIds = [...new Set(teachers.map((t) => t.supervisorId).filter(Boolean))];
    const sups = supIds.length ? await db("users").whereIn("id", supIds).select("id", "name") : [];
    const supName = new Map(sups.map((u) => [u.id, u.name]));
    return teachers.map((t) => ({
      id: t.id, name: fullName(t) || "Educator", email: t.email || null, photo: t.photo || null, status: t.status || "active",
      supervisorId: t.supervisorId || null, supervisorName: t.supervisorId ? supName.get(t.supervisorId) || null : null,
    })).sort((a, b) => a.name.localeCompare(b.name));
  },

  // Exactly these educators are theirs: the listed ones move to them (from another supervisor, if
  // any); ones no longer listed have no supervisor. Claims already sent stay with whoever they
  // were sent to.
  async setEducators(id, ownerAdminId, teacherIds = []) {
    await SupervisorService.getOwned(id, ownerAdminId);
    const allowed = await workspaceTeacherIds(ownerAdminId);
    const wanted = [...new Set(teacherIds)];
    if (wanted.some((t) => !allowed.has(t))) fail("Some of those educators aren't in your workspace", 404);
    await refuseSelf(id, wanted);
    const now = new Date();
    await db.transaction(async (trx) => {
      await trx("teachers").where({ supervisorId: id }).whereNotIn("id", wanted.length ? wanted : ["-"]).update({ supervisorId: null, updatedAt: now });
      if (wanted.length) await trx("teachers").whereIn("id", wanted).update({ supervisorId: id, updatedAt: now });
    });
    return SupervisorService.get(id, ownerAdminId);
  },

  // People already here who could become a supervisor (Add supervisor → "Someone already here",
  // 17 Nov 2026): the workspace's educators who sign in, and its staff — not admins, not anyone
  // switched off, not those already supervisors here. They keep their one login and password and
  // choose Educator / Staff or Supervisor when they sign in (users.extraRoles).
  async candidates(ownerAdminId) {
    const teacherIds = [...(await workspaceTeacherIds(ownerAdminId))];
    const teachers = teacherIds.length
      ? await db("teachers").whereIn("id", teacherIds).whereNot({ status: "removed" }).whereNotNull("email").select("id", "email", "firstName", "lastName", "photo", "phone")
      : [];
    const emails = [...new Set(teachers.map((t) => lower(t.email)).filter(Boolean))];
    const [educatorLogins, staff] = await Promise.all([
      emails.length ? db("users").whereRaw(`LOWER(email) IN (${emails.map(() => "?").join(",")})`, emails).whereNull("deactivatedAt").whereNull("removedAt") : [],
      db("users").where({ invitedByAdminId: ownerAdminId }).whereNull("deactivatedAt").whereNull("removedAt"),
    ]);
    const teacherByEmail = new Map(teachers.map((t) => [lower(t.email), t]));
    const people = new Map();
    for (const u of [...educatorLogins, ...staff]) {
      const roles = rolesOf(u);
      if (people.has(u.id) || roles.some((r) => r === "admin" || r === "curriculumAdmin")) continue;
      if (roles.includes("supervisor") && u.invitedByAdminId === ownerAdminId) continue;
      const teacher = teacherByEmail.get(lower(u.email));
      const isEducator = roles.includes("teacher") && !!teacher;
      const isStaff = roles.includes("collaborator") && u.invitedByAdminId === ownerAdminId;
      if (!isEducator && !isStaff) continue;
      people.set(u.id, {
        id: u.id, name: u.name || fullName(teacher), email: u.email, phone: u.phone || teacher?.phone || null, photo: u.photo || teacher?.photo || null,
        jobTitle: u.jobTitle || null, roles: [isEducator && "teacher", isStaff && "collaborator"].filter(Boolean), teacherId: isEducator ? teacher.id : null,
      });
    }
    return [...people.values()].sort((a, b) => a.name.localeCompare(b.name));
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
  // Optional (17 Nov 2026): a phone and a job title on the account, and the educators they look
  // after, all in the same step.
  async create(ownerAdminId, { name, email, password, phone, jobTitle, teacherIds = [] }) {
    const existing = await UserModel.findByEmail(email);
    if (existing && isSupervisor(existing) && existing.invitedByAdminId === ownerAdminId) fail("A supervisor with this email already exists", 409);
    if (teacherIds.length) {
      const allowed = await workspaceTeacherIds(ownerAdminId);
      if (teacherIds.some((t) => !allowed.has(t))) fail("Some of those educators aren't in your workspace", 404);
      if (existing) await refuseSelf(existing.id, teacherIds);
    }
    // Someone who already signs in keeps their own password — a password typed here is only for a
    // new login (it would otherwise quietly replace theirs).
    const user = await AuthService.addWorkspaceRole({ name, email, password: existing ? undefined : password, role: "supervisor", ownerAdminId });
    // A login that already existed keeps its own details unless they're empty.
    const details = {};
    if (phone && (user.created || !user.phone)) details.phone = phone;
    if (jobTitle && (user.created || !user.jobTitle)) details.jobTitle = jobTitle;
    if (Object.keys(details).length) await UserModel.update(user.id, details);
    if (teacherIds.length) await SupervisorService.setEducators(user.id, ownerAdminId, teacherIds);
    return { ...publicShape(await UserModel.findById(user.id), teacherIds.length), linked: !user.created };
  },

  async update(id, ownerAdminId, { name, password, phone, jobTitle }) {
    const user = await SupervisorService.getOwned(id, ownerAdminId);
    if (password) await AuthService.setOrCreatePassword({ name: name || user.name, email: user.email, password, role: "supervisor" });
    const changes = {};
    if (name && name !== user.name) changes.name = name;
    if (phone !== undefined) changes.phone = phone || null;
    if (jobTitle !== undefined) changes.jobTitle = jobTitle || null;
    const updated = Object.keys(changes).length ? await UserModel.update(id, changes) : await UserModel.findById(id);
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

const db = require("../../config/db");
const UserSessionModel = require("../auth/user-session.model");

// Settings → People & sharing → Users: every login that belongs to one admin's workspace, what
// kind of account it is, what it is attached to, when it was last used, and whether it is
// switched on. Owner-only (mounted under /api/admin-tools).
//
// `users` has no workspace column for most account types — a login is tied to its workspace
// through the record it signs in as (the same links scope.middleware.js's attachOwnRecords and
// audit.service.js's workspace lookup follow, read here in the other direction):
//   admin            the owner themself
//   collaborator     users.invitedByAdminId (staff — access comes from their role)
//   supervisor       users.invitedByAdminId
//   curriculumAdmin  curricula.curriculumAdminId on one of the owner's curricula
//   school           users.email = the email of one of the owner's hubs
//   teacher          users.email = an educator the owner created or who works at one of their hubs
//   learner          users.username = a learner's username (the child's own login), or
//                    users.email = a learner's guardianEmail (the parent's login)

const INACTIVE_AFTER_DAYS = 30;

const TYPE_LABELS = {
  admin: "Admin (owner)",
  collaborator: "Staff",
  supervisor: "Supervisor",
  curriculumAdmin: "Curriculum admin",
  school: "Learning hub",
  teacher: "Educator",
  learner: "Learner",
  parent: "Parent",
};

const lower = (value) => String(value || "").trim().toLowerCase();
const fullName = (person) => `${person.firstName || ""} ${person.lastName || ""}`.trim();
const listOf = (names) => [...new Set(names.filter(Boolean))].join(", ");

function fail(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

// The hubs, educators and learners of a workspace — "of a workspace" meaning created by its
// admin, or attached to one of its hubs (both links exist; older records have only the second).
async function workspacePeople(ownerAdminId) {
  const hubs = await db("learning_hubs").where({ ownerAdminId }).select("id", "name", "email", "status", "parentHubId");
  const hubIds = hubs.map((h) => h.id);
  const hubNameById = new Map(hubs.map((h) => [h.id, h.name]));

  const teacherLinks = hubIds.length ? await db("teacher_hub_links").whereIn("hubId", hubIds).select("teacherId", "hubId") : [];
  const teachers = await db("teachers")
    .where({ createdByAdminId: ownerAdminId })
    .orWhereIn("id", teacherLinks.map((l) => l.teacherId))
    .select("id", "firstName", "lastName", "email", "status");

  const learnerLinks = hubIds.length ? await db("learner_hub_links").whereIn("hubId", hubIds).select("learnerId", "hubId") : [];
  const learners = await db("learners")
    .where({ createdByAdminId: ownerAdminId })
    .orWhereIn("id", learnerLinks.map((l) => l.learnerId))
    .select("id", "firstName", "lastName", "username", "guardianEmail", "accountStatus");

  const hubsOf = (links, key, id) => listOf(links.filter((l) => l[key] === id).map((l) => hubNameById.get(l.hubId)));
  return {
    hubs,
    teachers: teachers.map((t) => ({ ...t, hubNames: hubsOf(teacherLinks, "teacherId", t.id) })),
    learners: learners.map((l) => ({ ...l, hubNames: hubsOf(learnerLinks, "learnerId", l.id) })),
  };
}

function statusOf(user, lastActiveAt, now) {
  if (user.deactivatedAt) return "deactivated";
  if (!lastActiveAt) return "never";
  const days = (now - new Date(lastActiveAt).getTime()) / 86400000;
  return days > INACTIVE_AFTER_DAYS ? "inactive" : "active";
}

const WorkspaceUsersService = {
  async list(ownerAdminId) {
    const { hubs, teachers, learners } = await workspacePeople(ownerAdminId);
    const curricula = await db("curricula").where({ ownerAdminId }).whereNotNull("curriculumAdminId").select("name", "curriculumAdminId");
    const roles = await db("access_roles").where({ ownerAdminId }).select("id", "name");
    const roleNameById = new Map(roles.map((r) => [r.id, r.name]));

    const hubsByEmail = new Map();
    hubs.filter((h) => h.email).forEach((h) => { const k = lower(h.email); hubsByEmail.set(k, [...(hubsByEmail.get(k) || []), h]); });
    const teachersByEmail = new Map();
    teachers.filter((t) => t.email).forEach((t) => { const k = lower(t.email); teachersByEmail.set(k, [...(teachersByEmail.get(k) || []), t]); });
    const learnerByUsername = new Map(learners.filter((l) => l.username).map((l) => [lower(l.username), l]));
    const childrenByGuardian = new Map();
    learners.filter((l) => l.guardianEmail).forEach((l) => { const k = lower(l.guardianEmail); childrenByGuardian.set(k, [...(childrenByGuardian.get(k) || []), l]); });

    const emails = [...new Set([...hubsByEmail.keys(), ...teachersByEmail.keys(), ...childrenByGuardian.keys()])];
    const usernames = [...learnerByUsername.keys()];
    const curriculumAdminIds = curricula.map((c) => c.curriculumAdminId);

    const candidates = await db("users")
      .where({ id: ownerAdminId })
      .orWhere({ invitedByAdminId: ownerAdminId })
      .orWhereIn("id", curriculumAdminIds)
      .orWhere((q) => q.whereIn("role", ["school", "teacher", "learner"]).whereIn(db.raw("LOWER(email)"), emails.length ? emails : [""]))
      .orWhere((q) => q.where({ role: "learner" }).whereIn(db.raw("LOWER(username)"), usernames.length ? usernames : [""]))
      .select("id", "name", "email", "username", "role", "roleId", "photo", "createdAt", "deactivatedAt", "invitedByAdminId");

    // Last time each account did anything the activity log records (a sign-in included). Failed
    // sign-in attempts aren't the account being used.
    const lastActive = new Map();
    for (let i = 0; i < candidates.length; i += 500) {
      const rows = await db("audit_log")
        .whereIn("actorUserId", candidates.slice(i, i + 500).map((u) => u.id))
        .whereNot({ action: "login_failed" })
        .groupBy("actorUserId")
        .select("actorUserId")
        .max({ lastActiveAt: "createdAt" });
      rows.forEach((r) => lastActive.set(r.actorUserId, r.lastActiveAt));
    }

    const now = Date.now();
    const users = [];
    for (const user of candidates) {
      const email = lower(user.email);
      let type = user.role;
      let attachedTo = "";
      let record = null; // { kind, id } — the page that person's own record opens on
      let suspended = false; // their hub / educator / learner record is itself switched off

      if (user.role === "admin") {
        if (user.id !== ownerAdminId) continue;
        attachedTo = "This workspace";
      } else if (user.role === "collaborator" || user.role === "supervisor") {
        if (user.invitedByAdminId !== ownerAdminId) continue;
      } else if (user.role === "curriculumAdmin") {
        attachedTo = listOf(curricula.filter((c) => c.curriculumAdminId === user.id).map((c) => c.name));
        if (!attachedTo) continue;
      } else if (user.role === "school") {
        const own = hubsByEmail.get(email);
        if (!own) continue;
        attachedTo = listOf(own.map((h) => h.name));
        const main = own.find((h) => !h.parentHubId) || own[0];
        record = { kind: "hub", id: main.id };
        suspended = main.status === "inactive";
      } else if (user.role === "teacher") {
        const own = teachersByEmail.get(email);
        if (!own) continue;
        attachedTo = listOf(own.map((t) => t.hubNames));
        record = { kind: "educator", id: own[0].id };
        suspended = !own.some((t) => (t.status || "active") !== "inactive");
      } else if (user.role === "learner") {
        const child = user.username ? learnerByUsername.get(lower(user.username)) : null;
        const children = !user.username ? childrenByGuardian.get(email) : null;
        if (child) {
          attachedTo = child.hubNames;
          record = { kind: "learner", id: child.id };
          suspended = (child.accountStatus || "active") !== "active";
        } else if (children) {
          type = "parent";
          attachedTo = `Parent of ${listOf(children.map(fullName))}`;
          record = { kind: "learner", id: children[0].id };
        } else continue;
      } else continue;

      const lastActiveAt = lastActive.get(user.id) || null;
      users.push({
        id: user.id,
        name: user.name || "",
        email: user.email || "",
        username: user.username || "",
        photo: user.photo || null,
        type,
        typeLabel: TYPE_LABELS[type] || type,
        accessRole: user.role === "collaborator" ? roleNameById.get(user.roleId) || "No role" : null,
        attachedTo,
        record,
        suspended,
        status: statusOf(user, lastActiveAt, now),
        lastActiveAt,
        createdAt: user.createdAt,
        deactivatedAt: user.deactivatedAt || null,
        // The owner can't switch themself off — nobody would be left to switch them back on.
        canDeactivate: user.id !== ownerAdminId,
      });
    }

    users.sort((a, b) => a.name.localeCompare(b.name));
    const count = (key, value) => users.filter((u) => u[key] === value).length;
    return {
      users,
      inactiveAfterDays: INACTIVE_AFTER_DAYS,
      summary: {
        total: users.length,
        byType: Object.keys(TYPE_LABELS)
          .map((type) => ({ type, label: TYPE_LABELS[type], count: count("type", type) }))
          .filter((t) => t.count > 0),
        byStatus: {
          active: count("status", "active"),
          inactive: count("status", "inactive"),
          never: count("status", "never"),
          deactivated: count("status", "deactivated"),
        },
      },
    };
  },

  // Switches a login off (it can't sign in, and anywhere it is signed in is ended now) or back
  // on. Only ever an account in this owner's own workspace, and never the owner's own.
  async setActive(ownerAdminId, userId, active) {
    const { users } = await this.list(ownerAdminId);
    const target = users.find((u) => u.id === userId);
    if (!target) throw fail("User not found", 404);
    if (!target.canDeactivate) throw fail("You can't deactivate your own account", 400);

    await db("users").where({ id: userId }).update({ deactivatedAt: active ? null : new Date() });
    if (!active) await UserSessionModel.deleteByUserId(userId);

    const updated = (await this.list(ownerAdminId)).users.find((u) => u.id === userId);
    return updated;
  },
};

module.exports = WorkspaceUsersService;

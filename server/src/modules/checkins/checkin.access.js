const db = require("../../config/db");
const { can } = require("../access/access.service");
const { adminIdsOf } = require("../../shared/utils/organisation");
const { rolesOf } = require("../auth/account-roles");

// Who sees what in hub check-ins.
//
//   managers  the workspace's admins, and staff whose role can view "checkins-manage" (the admin
//             app, /checkins) — every hub, the schedules.
//   everyone  else: a hub's Account Manager and Training Lead, named on the hub itself (an educator,
//             say). They work in the hub portal — a "school" session with req.user.hubLead (see
//             account-roles.js) — and see only the hubs they're on: those hubs' check-ins and
//             earlier reports. An educator's own session (the teacher portal) can only ask what's
//             due, for the sign-in pop-up.
//   the hub   itself (its own login in the hub portal): its own check-ins and reports, read only.
//   taking    part (6 Nov 2026): the people chosen when the check-ins were set up — our admins and
//             staff, the hub's login, its mentors, parents of its learners (checkin_participants). They
//             see the check-ins they're on, in their own portal (an educator's teacher portal, a
//             parent's /parent), get the pop-up, and read the report once it's in. Nothing else.
//
// A check-in's report is written by its Account Manager or Training Lead, or a manager.

function contextOf(req) {
  // The hub's own login (the hub portal, not as an Account Manager / Training Lead): its own
  // check-ins and their reports, read only — the hub it's working in (req.ownSchool).
  if (req.user.role === "school" && !req.user.hubLead) {
    return {
      userId: req.user.id,
      ownerAdminId: req.ownSchool?.ownerAdminId || null,
      hubId: req.ownSchool?.id || null,
      isHub: true,
      isStaff: false,
      isManager: false,
      canManageSchedules: false,
    };
  }
  // An educator in the teacher portal, or a parent: only the check-ins they take part in (and, for
  // an educator named on a hub, what's due — the pop-up offers to switch to that sign-in).
  if (req.user.role === "learner" || (req.user.role === "teacher" && !req.user.hubLead)) {
    return {
      userId: req.user.id,
      ownerAdminId: req.ownSchool?.ownerAdminId || null,
      isStaff: true,
      isManager: false,
      isParticipantOnly: true,
      canManageSchedules: false,
    };
  }
  // An Account Manager / Training Lead in the hub portal.
  if (req.user.hubLead) {
    return {
      userId: req.user.id,
      ownerAdminId: req.ownSchool?.ownerAdminId || null,
      isStaff: true,
      isManager: false,
      canManageSchedules: false,
    };
  }
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

// Who can be a hub's Account Manager or Training Lead: the workspace's admins, and its educators
// who have a login (created by the workspace, or teaching at one of its hubs). The id is the
// login's (users.id) — what check-ins and the hub record.
async function workspacePeople(ownerAdminId) {
  const adminIds = await adminIdsOf(ownerAdminId);
  const owners = [...new Set([ownerAdminId, ...adminIds])];
  const hubIds = await db("learning_hubs").where({ ownerAdminId }).pluck("id");
  const teachers = await db("teachers")
    .where((w) => w.whereIn("createdByAdminId", owners).orWhereIn("id", db("teacher_hub_links").whereIn("hubId", hubIds.length ? hubIds : ["__none__"]).select("teacherId")))
    .whereNotNull("email")
    .select("email", "status");
  const emails = [...new Set(teachers.filter((t) => (t.status || "active") !== "inactive").map((t) => String(t.email).toLowerCase()))];
  const [admins, educators] = await Promise.all([
    adminIds.length ? db("users").whereIn("id", adminIds).whereNull("deactivatedAt").select("id", "name", "email") : [],
    emails.length ? db("users").whereIn(db.raw("LOWER(email)"), emails).whereNot({ role: "admin" }).whereNull("deactivatedAt").select("id", "name", "email") : [],
  ]);
  const people = [
    ...admins.map((u) => ({ id: u.id, name: u.name || u.email, email: u.email, kind: "admin", roleName: "Admin", canUseCheckins: true, isManager: true })),
    ...educators.map((u) => ({ id: u.id, name: u.name || u.email, email: u.email, kind: "educator", roleName: "Educator", canUseCheckins: true, isManager: false })),
  ];
  return people.sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

// Who can take part in a hub's check-ins, in four groups — each person a login (users.id):
//   team     our side: the workspace's admins and staff;
//   hub      the hub's own login (its email);
//   mentors  educators of the hub (teacher_hub_links) who have a login;
//   parents  parent logins of the learners enrolled at the hub (active), by the learner's guardian
//            email — never a child's own username login.
async function participantOptions(ownerAdminId, hubId) {
  const hub = await db("learning_hubs").where({ id: hubId, ownerAdminId }).first("id", "name", "email");
  if (!hub) return null;
  const adminIds = await adminIdsOf(ownerAdminId);
  const owners = [...new Set([ownerAdminId, ...adminIds])];
  const live = (q) => q.whereNull("deactivatedAt");
  const lower = (v) => String(v || "").trim().toLowerCase();

  const [admins, invited] = await Promise.all([
    adminIds.length ? live(db("users").whereIn("id", adminIds)).select("id", "name", "email") : [],
    live(db("users").whereIn("invitedByAdminId", owners)).select("id", "name", "email", "role", "extraRoles"),
  ]);
  const staff = invited.filter((u) => rolesOf(u).includes("collaborator"));
  const team = [
    ...admins.map((u) => ({ userId: u.id, name: u.name || u.email, email: u.email, detail: "Admin" })),
    ...staff.filter((u) => !adminIds.includes(u.id)).map((u) => ({ userId: u.id, name: u.name || u.email, email: u.email, detail: "Staff" })),
  ];

  const hubUsers = hub.email ? await live(db("users").whereRaw("LOWER(email) = ?", [lower(hub.email)])).select("id", "name", "email", "role", "extraRoles") : [];
  const hubSide = hubUsers.filter((u) => rolesOf(u).includes("school")).map((u) => ({ userId: u.id, name: u.name || hub.name, email: u.email, detail: "Hub login" }));

  const teacherRows = await db("teachers").whereIn("id", db("teacher_hub_links").where({ hubId }).select("teacherId"))
    .whereNotNull("email").select("firstName", "lastName", "email", "status");
  const teacherByEmail = new Map(teacherRows.filter((t) => (t.status || "active") !== "inactive").map((t) => [lower(t.email), t]));
  const mentorUsers = teacherByEmail.size ? await live(db("users").whereIn(db.raw("LOWER(email)"), [...teacherByEmail.keys()])).whereNot({ role: "admin" }).select("id", "name", "email") : [];
  const mentors = mentorUsers.map((u) => {
    const t = teacherByEmail.get(lower(u.email));
    return { userId: u.id, name: [t?.firstName, t?.lastName].filter(Boolean).join(" ") || u.name || u.email, email: u.email, detail: "Mentor" };
  });

  const learners = await db("learners").whereIn("id", db("learner_hub_links").where({ hubId, status: "active" }).select("learnerId"))
    .whereNull("teacherId").whereNotNull("guardianEmail").select("firstName", "lastName", "guardianEmail", "guardianName");
  const childrenByEmail = new Map();
  for (const l of learners) {
    const key = lower(l.guardianEmail);
    if (!key) continue;
    (childrenByEmail.get(key) || childrenByEmail.set(key, []).get(key)).push(l);
  }
  const parentUsers = childrenByEmail.size ? await live(db("users").whereIn(db.raw("LOWER(email)"), [...childrenByEmail.keys()])).whereNull("username").select("id", "name", "email", "role", "extraRoles") : [];
  const parents = parentUsers.filter((u) => rolesOf(u).includes("learner")).map((u) => {
    const kids = childrenByEmail.get(lower(u.email)) || [];
    return { userId: u.id, name: u.name || kids[0]?.guardianName || u.email, email: u.email, detail: `Parent of ${kids.map((k) => k.firstName).filter(Boolean).join(", ") || "a learner"}` };
  });

  const byName = (a, b) => String(a.name).localeCompare(String(b.name));
  return { hubName: hub.name, team: team.sort(byName), hub: hubSide.sort(byName), mentors: mentors.sort(byName), parents: parents.sort(byName) };
}

// Whether this person takes part in this check-in.
async function isParticipant(sessionId, userId) {
  if (!sessionId || !userId) return false;
  return Boolean(await db("checkin_participants").where({ sessionId, userId }).first("id"));
}

module.exports = { contextOf, assignedHubIds, isAssignedTo, workspacePeople, participantOptions, isParticipant };

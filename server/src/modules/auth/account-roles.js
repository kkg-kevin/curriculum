const db = require("../../config/db");
const { isLeftoverLogin } = require("./leftover-login");

// One login, more than one role. users.role is the account's own role; users.extraRoles the
// others it may sign in as. A session runs as ONE of them — the role is in the token (see
// auth.service.js's signToken and auth.middleware.js's protect), so everything downstream still
// sees a single req.user.role.
//
// Roles added to a login found by its email: an educator (teachers.email), a learning hub
// (learning_hubs.email) and a parent (learners/home_learning_households.guardianEmail).
const LINKABLE_ROLES = ["teacher", "school", "learner"];

// Staff and claim supervisors: added to a login by inviting its email (AuthService.addWorkspaceRole).
// Their workspace sits on the login itself (invitedByAdminId, and roleId for staff), so a login is
// staff / supervisor of one workspace only.
const WORKSPACE_ROLES = ["collaborator", "supervisor"];

// Admins and curriculum admins keep a login of their own: never added to another login, and never
// given staff / supervisor on top (they already run their workspace).
const OWN_ONLY_ROLES = ["admin", "curriculumAdmin"];

// An Account Manager / Training Lead: a login named on a learning hub as its Account Manager or
// Training Lead (learning_hubs.accountManagerId / trainingLeadId — an educator, say). It's added
// and taken away by naming them on hubs (modules/checkins/checkin.service.js's syncHubLeadRole),
// never by email. A session as it runs in the hub portal: every hub of the workspace, view only,
// plus their hub check-ins (scope.middleware.js, auth.middleware.js's blockHubLeadWrites).
// Admins never take it — they already do all of that from the admin app.
const HUB_LEAD_ROLE = "hubLead";
const NO_HUB_LEAD = OWN_ONLY_ROLES;
const canBeHubLead = (user) => Boolean(user) && !NO_HUB_LEAD.includes(user.role);

// A TOT learner (5 Nov 2026): an educator in training (TOT — their own learner record,
// learners.teacherId) signs in to their training as a portal of its own — the learner portal, as
// that one learner record — never mixed into the teacher portal. Worked out from the records, never
// stored: a login that is an educator with a learner record of their own can sign in as it. One
// still "in training" (teachers.status — a website TOT sign-up not yet made Active) signs in ONLY as
// it; an Active educator in training chooses at sign-in (Educator or TOT learner) and switches in
// the header. The session runs as "learner" with `totLearner` (auth.service.js's sessionUser).
const TOT_LEARNER_ROLE = "totLearner";

function parseRoles(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

// The extra roles on file, without duplicates or the account's own role. A child's username-only
// login never has any.
const extraRolesOf = (user) =>
  user?.email
    ? [...new Set(parseRoles(user.extraRoles))].filter((r) => r !== user.role && (
      LINKABLE_ROLES.includes(r)
      || (WORKSPACE_ROLES.includes(r) && !OWN_ONLY_ROLES.includes(user.role))
      || (r === HUB_LEAD_ROLE && canBeHubLead(user))
    ))
    : [];

// Every role on file — cheap, no lookups.
const rolesOf = (user) => (user ? [user.role, ...extraRolesOf(user)] : []);

// The roles a session may run as — what `protect` checks a token's role against: the roles on file,
// and for an educator also TOT learner (a session only ever started once availableRoles below
// found their learner record; not stored).
const sessionRolesOf = (user) => {
  const roles = rolesOf(user);
  return roles.includes("teacher") ? [...roles, TOT_LEARNER_ROLE] : roles;
};

// The educator a login is (by its email) and their own learner record (TOT), if any.
async function totTraineeOf(user) {
  if (!user?.email) return { teacher: null, trainee: null };
  const teacher = await db("teachers").whereRaw("LOWER(email) = ?", [user.email.toLowerCase()]).first("id", "status");
  const trainee = teacher ? await db("learners").where({ teacherId: teacher.id }).first() : null;
  return { teacher: teacher || null, trainee: trainee || null };
}

// The roles this login can sign in as right now, its own role first: each extra role whose record
// still exists (an educator, hub or child deleted since leaves its role behind; it is skipped).
// The account's own role is skipped the same way, but only when another role is still live —
// a login is never left with no role at all. An educator in training also gets the TOT learner
// role, right after Educator; still "in training", it's their only way in (see TOT_LEARNER_ROLE).
async function availableRoles(user) {
  if (!user) return [];
  const extras = [];
  for (const role of extraRolesOf(user)) {
    if (!(await isLeftoverLogin({ ...user, role }))) extras.push(role);
  }
  const roles = extras.length && (await isLeftoverLogin(user)) ? extras : [user.role, ...extras];
  if (!roles.includes("teacher")) return roles;
  const { teacher, trainee } = await totTraineeOf(user);
  if (!trainee) return roles;
  // Never a switch to an empty side: still "in training" → TOT learner only (their Educator side has
  // nothing yet); Active → both only while they hold an active place in a TOT class, else Educator only.
  if (teacher?.status === "in_training") return roles.map((r) => (r === "teacher" ? TOT_LEARNER_ROLE : r));
  if (!(await require("../tot/tot.people").hasActiveTotPlace(trainee.id))) return roles;
  return roles.flatMap((r) => (r === "teacher" ? ["teacher", TOT_LEARNER_ROLE] : [r]));
}

// The login without `role`: { role, extraRoles } to save, its own role passing to the next role it
// holds when that's the one going — or null when it has no other role left (the login goes).
// Losing its last staff / supervisor role also clears the workspace that came with it.
function withoutRole(user, role) {
  const rest = rolesOf(user).filter((r) => r !== role);
  const ownRole = user.role === role ? rest.find((r) => r !== HUB_LEAD_ROLE) : user.role;
  if (!ownRole) return null;
  const patch = { role: ownRole, extraRoles: rest.filter((r) => r !== ownRole) };
  if (role === "collaborator") Object.assign(patch, { roleId: null, allowedModules: null });
  if (WORKSPACE_ROLES.includes(role) && !rest.some((r) => WORKSPACE_ROLES.includes(r))) patch.invitedByAdminId = null;
  return patch;
}

module.exports = { LINKABLE_ROLES, WORKSPACE_ROLES, OWN_ONLY_ROLES, HUB_LEAD_ROLE, TOT_LEARNER_ROLE, canBeHubLead, extraRolesOf, rolesOf, sessionRolesOf, availableRoles, totTraineeOf, withoutRole };

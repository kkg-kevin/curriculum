const { isLeftoverLogin } = require("./leftover-login");

// One login, more than one role. users.role is the account's own role; users.extraRoles the
// others it may sign in as. A session runs as ONE of them — the role is in the token (see
// auth.service.js's signToken and auth.middleware.js's protect), so everything downstream still
// sees a single req.user.role.
//
// Only roles whose access comes from a record found by the login's email can be added this way:
// an educator (teachers.email), a learning hub (learning_hubs.email) and a parent
// (learners/home_learning_households.guardianEmail). Staff and supervisors carry their workspace
// on the login itself (invitedByAdminId, roleId), which would clash with an admin's own, so they
// still need an email of their own; admins and curriculum admins are never added to a login.
const LINKABLE_ROLES = ["teacher", "school", "learner"];

// An Account Manager / Training Lead: a login named on a learning hub as its Account Manager or
// Training Lead (learning_hubs.accountManagerId / trainingLeadId — an educator, say). It's added
// and taken away by naming them on hubs (modules/checkins/checkin.service.js's syncHubLeadRole),
// never by email. A session as it runs in the hub portal: every hub of the workspace, view only,
// plus their hub check-ins (scope.middleware.js, auth.middleware.js's blockHubLeadWrites).
// Admins never take it — they already do all of that from the admin app.
const HUB_LEAD_ROLE = "hubLead";
const NO_HUB_LEAD = ["admin", "curriculumAdmin", "collaborator", "supervisor"];
const canBeHubLead = (user) => Boolean(user) && !NO_HUB_LEAD.includes(user.role);

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
    ? [...new Set(parseRoles(user.extraRoles))].filter((r) => r !== user.role && (LINKABLE_ROLES.includes(r) || (r === HUB_LEAD_ROLE && canBeHubLead(user))))
    : [];

// Every role on file — cheap, no lookups. What `protect` checks a token's role against.
const rolesOf = (user) => (user ? [user.role, ...extraRolesOf(user)] : []);

// The roles this login can sign in as right now, its own role first: each extra role whose record
// still exists (an educator, hub or child deleted since leaves its role behind; it is skipped).
// The account's own role is skipped the same way, but only when another role is still live —
// a login is never left with no role at all.
async function availableRoles(user) {
  if (!user) return [];
  const extras = [];
  for (const role of extraRolesOf(user)) {
    if (!(await isLeftoverLogin({ ...user, role }))) extras.push(role);
  }
  if (extras.length && (await isLeftoverLogin(user))) return extras;
  return [user.role, ...extras];
}

module.exports = { LINKABLE_ROLES, HUB_LEAD_ROLE, canBeHubLead, extraRolesOf, rolesOf, availableRoles };

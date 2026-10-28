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

module.exports = { LINKABLE_ROLES, WORKSPACE_ROLES, OWN_ONLY_ROLES, HUB_LEAD_ROLE, canBeHubLead, extraRolesOf, rolesOf, availableRoles, withoutRole };

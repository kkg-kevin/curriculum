const test = require("node:test");
const assert = require("node:assert/strict");
const { LINKABLE_ROLES, WORKSPACE_ROLES, HUB_LEAD_ROLE, extraRolesOf, rolesOf, withoutRole } = require("../src/modules/auth/account-roles");

// One login, several roles — the pure part: which roles are on file, and which may be added.

test("an admin who also teaches holds both roles, own role first", () => {
  const user = { role: "admin", email: "a@x.test", extraRoles: ["teacher"] };
  assert.deepEqual(rolesOf(user), ["admin", "teacher"]);
});

test("extra roles read from a JSON string, without duplicates or the own role", () => {
  const user = { role: "teacher", email: "t@x.test", extraRoles: JSON.stringify(["learner", "teacher", "learner"]) };
  assert.deepEqual(extraRolesOf(user), ["learner"]);
});

test("educator, hub, parent, staff and supervisor roles can be added to a login — never admin", () => {
  assert.deepEqual(LINKABLE_ROLES, ["teacher", "school", "learner"]);
  assert.deepEqual(WORKSPACE_ROLES, ["collaborator", "supervisor"]);
  const user = { role: "teacher", email: "t@x.test", extraRoles: ["admin", "curriculumAdmin", "collaborator", "supervisor", "school"] };
  assert.deepEqual(extraRolesOf(user), ["collaborator", "supervisor", "school"]);
});

test("an admin's or curriculum admin's login never takes staff or supervisor on top", () => {
  assert.deepEqual(extraRolesOf({ role: "admin", email: "a@x.test", extraRoles: ["collaborator", "supervisor", "teacher"] }), ["teacher"]);
  assert.deepEqual(extraRolesOf({ role: "curriculumAdmin", email: "c@x.test", extraRoles: ["collaborator"] }), []);
});

test("an educator named on a hub can also sign in as its Account Manager / Training Lead — an admin never", () => {
  assert.equal(HUB_LEAD_ROLE, "hubLead");
  assert.deepEqual(rolesOf({ role: "teacher", email: "t@x.test", extraRoles: ["hubLead"] }), ["teacher", "hubLead"]);
  assert.deepEqual(extraRolesOf({ role: "admin", email: "a@x.test", extraRoles: ["hubLead", "teacher"] }), ["teacher"]);
  // A staff member who is also an educator takes it too.
  assert.deepEqual(extraRolesOf({ role: "collaborator", email: "s@x.test", extraRoles: ["teacher", "hubLead"] }), ["teacher", "hubLead"]);
});

test("removing staff from a staff + educator login leaves an educator login, workspace cleared", () => {
  const user = { role: "collaborator", email: "s@x.test", extraRoles: ["teacher"], invitedByAdminId: "w1", roleId: "r1" };
  assert.deepEqual(withoutRole(user, "collaborator"), { role: "teacher", extraRoles: [], roleId: null, allowedModules: null, invitedByAdminId: null });
});

test("removing staff keeps the workspace while the login is still that workspace's supervisor", () => {
  const user = { role: "teacher", email: "t@x.test", extraRoles: ["collaborator", "supervisor"], invitedByAdminId: "w1", roleId: "r1" };
  assert.deepEqual(withoutRole(user, "collaborator"), { role: "teacher", extraRoles: ["supervisor"], roleId: null, allowedModules: null });
});

test("removing a login's only role leaves nothing — the login goes", () => {
  assert.equal(withoutRole({ role: "supervisor", email: "s@x.test", invitedByAdminId: "w1" }, "supervisor"), null);
  // An Account Manager / Training Lead sign-in can't stand on its own.
  assert.equal(withoutRole({ role: "collaborator", email: "s@x.test", extraRoles: ["hubLead"] }, "collaborator"), null);
});

test("a child's username-only login never has extra roles", () => {
  const child = { role: "learner", username: "amara01", email: null, extraRoles: ["teacher"] };
  assert.deepEqual(rolesOf(child), ["learner"]);
});

test("no extra roles, or unreadable ones, is just the own role", () => {
  assert.deepEqual(rolesOf({ role: "admin", email: "a@x.test" }), ["admin"]);
  assert.deepEqual(rolesOf({ role: "admin", email: "a@x.test", extraRoles: "not json" }), ["admin"]);
  assert.deepEqual(rolesOf(null), []);
});

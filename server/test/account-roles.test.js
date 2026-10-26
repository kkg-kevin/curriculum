const test = require("node:test");
const assert = require("node:assert/strict");
const { LINKABLE_ROLES, HUB_LEAD_ROLE, extraRolesOf, rolesOf } = require("../src/modules/auth/account-roles");

// One login, several roles — the pure part: which roles are on file, and which may be added.

test("an admin who also teaches holds both roles, own role first", () => {
  const user = { role: "admin", email: "a@x.test", extraRoles: ["teacher"] };
  assert.deepEqual(rolesOf(user), ["admin", "teacher"]);
});

test("extra roles read from a JSON string, without duplicates or the own role", () => {
  const user = { role: "teacher", email: "t@x.test", extraRoles: JSON.stringify(["learner", "teacher", "learner"]) };
  assert.deepEqual(extraRolesOf(user), ["learner"]);
});

test("only educator, hub and parent roles can be added to a login", () => {
  assert.deepEqual(LINKABLE_ROLES, ["teacher", "school", "learner"]);
  const user = { role: "teacher", email: "t@x.test", extraRoles: ["admin", "collaborator", "supervisor", "school"] };
  assert.deepEqual(extraRolesOf(user), ["school"]);
});

test("an educator named on a hub can also sign in as its Account Manager / Training Lead — an admin never", () => {
  assert.equal(HUB_LEAD_ROLE, "hubLead");
  assert.deepEqual(rolesOf({ role: "teacher", email: "t@x.test", extraRoles: ["hubLead"] }), ["teacher", "hubLead"]);
  assert.deepEqual(extraRolesOf({ role: "admin", email: "a@x.test", extraRoles: ["hubLead", "teacher"] }), ["teacher"]);
  assert.deepEqual(extraRolesOf({ role: "collaborator", email: "s@x.test", extraRoles: ["hubLead"] }), []);
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

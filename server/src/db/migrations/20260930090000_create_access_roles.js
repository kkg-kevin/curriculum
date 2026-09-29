const { randomUUID } = require("crypto");
const { id, fk, timestamps } = require("../helpers");

// Staff roles: a named set of permissions ({ moduleKey: ["view","create","edit","delete"] }) that
// an admin assigns to their staff (collaborator) accounts — replacing the per-collaborator
// `users.allowedModules` list. See src/modules/access/.
//
// Existing access is preserved exactly: before roles, a collaborator could view, create and edit
// (never delete, never billing) in the modules they were granted — NULL meaning all of them. Each
// existing collaborator gets a role with precisely those permissions. `allowedModules` is left in
// place (and still honoured for any collaborator without a role) so a rollback loses nothing.
//
// The module list is frozen here on purpose (a migration must not change meaning when app code
// changes later); it's the legacy list from src/modules/access/access.registry.js.
const LEGACY_MODULES = [
  ["learning-hubs", "Learning Hubs"], ["curriculum", "Curriculum"], ["learners", "Learners"],
  ["teachers", "Educators"], ["classes", "Classes"], ["courses", "Courses"],
  ["competitions", "Competitions"], ["bootcamps", "Bootcamps"], ["assessments", "Assessments"],
  ["attendance", "Attendance"], ["timetable", "Timetable"], ["settings", "Settings"],
  ["home-learning", "Home Learning"], ["reports", "Reports"], ["notifications", "Notifications"],
];
const LEGACY_KEYS = LEGACY_MODULES.map(([key]) => key);
const LABELS = Object.fromEntries(LEGACY_MODULES);
const EDIT = ["view", "create", "edit"];

const grant = (keys, actions) => Object.fromEntries(keys.map((key) => [key, actions]));

// Starter roles every admin gets. Ordinary roles — the admin can edit or delete them.
const STARTER_ROLES = [
  {
    name: "Editor — all modules",
    description: "View, add and edit in every teaching and workspace module. No deleting, no billing.",
    permissions: grant(LEGACY_KEYS, EDIT),
  },
  {
    name: "Viewer — read only",
    description: "Can look at everything in the teaching and workspace modules but can't change anything.",
    permissions: grant(LEGACY_KEYS, ["view"]),
  },
  {
    name: "Finance",
    description: "Invoices, payments and hub revenue, with read-only access to learners, hubs and Home Learning.",
    permissions: {
      billing: EDIT,
      "hub-visits": EDIT,
      learners: ["view"],
      "learning-hubs": ["view"],
      "home-learning": ["view"],
    },
  },
];

function parseModules(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return null; }
}

exports.up = async function up(knex) {
  await knex.schema.createTable("access_roles", (table) => {
    id(table);
    fk(table, "ownerAdminId").notNullable();
    table.string("name", 100).notNullable();
    table.string("description", 255).nullable();
    table.json("permissions").notNullable();
    timestamps(table);
    table.index("ownerAdminId");
    table.unique(["ownerAdminId", "name"]);
  });
  await knex.schema.alterTable("users", (table) => {
    table.string("roleId", 36).nullable();
    table.index("roleId");
  });

  const now = new Date();
  const admins = await knex("users").where({ role: "admin" }).select("id");
  const collaborators = await knex("users").where({ role: "collaborator" }).whereNotNull("invitedByAdminId").select("id", "invitedByAdminId", "allowedModules");
  const ownerIds = new Set([...admins.map((a) => a.id), ...collaborators.map((c) => c.invitedByAdminId)]);

  for (const ownerAdminId of ownerIds) {
    const roleIdByName = new Map();
    const addRole = async ({ name, description, permissions }) => {
      if (roleIdByName.has(name)) return roleIdByName.get(name);
      const roleId = randomUUID();
      await knex("access_roles").insert({ id: roleId, ownerAdminId, name, description, permissions: JSON.stringify(permissions), createdAt: now, updatedAt: now });
      roleIdByName.set(name, roleId);
      return roleId;
    };
    for (const role of STARTER_ROLES) await addRole(role);

    for (const collaborator of collaborators.filter((c) => c.invitedByAdminId === ownerAdminId)) {
      const granted = parseModules(collaborator.allowedModules);
      const keys = granted == null ? LEGACY_KEYS : LEGACY_KEYS.filter((key) => granted.includes(key));
      let roleId;
      if (keys.length === LEGACY_KEYS.length) {
        roleId = roleIdByName.get(STARTER_ROLES[0].name);
      } else {
        const labels = keys.map((key) => LABELS[key]).join(", ") || "no modules";
        const name = `Custom: ${labels}`.slice(0, 100);
        roleId = await addRole({
          name,
          description: "Created from this staff member's access before roles existed.",
          permissions: grant(keys, EDIT),
        });
      }
      await knex("users").where({ id: collaborator.id }).update({ roleId });
    }
  }
};

exports.down = async function down(knex) {
  await knex.schema.alterTable("users", (table) => {
    table.dropIndex("roleId");
    table.dropColumn("roleId");
  });
  await knex.schema.dropTableIfExists("access_roles");
};

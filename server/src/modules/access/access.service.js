const AccessRoleModel = require("./access-role.model");
const { ACTIONS, MODULES, MODULE_KEYS, LEGACY_MODULE_KEYS } = require("./access.registry");

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

const grant = (keys, actions) => Object.fromEntries(keys.map((key) => [key, [...actions]]));
const EDIT = ["view", "create", "edit"];

// Starter roles for an admin who has none yet (existing admins got them from the
// 20260930090000 migration). Ordinary roles — editable and deletable.
const STARTER_ROLES = [
  { name: "Editor — all modules", description: "View, add and edit in every teaching and workspace module. No deleting, no billing.", permissions: grant(LEGACY_MODULE_KEYS, EDIT) },
  { name: "Viewer — read only", description: "Can look at everything in the teaching and workspace modules but can't change anything.", permissions: grant(LEGACY_MODULE_KEYS, ["view"]) },
  {
    name: "Finance",
    description: "Invoices, payments and hub revenue, with read-only access to learners, hubs and Home Learning.",
    permissions: { billing: EDIT, "hub-visits": EDIT, learners: ["view"], "learning-hubs": ["view"], "home-learning": ["view"] },
  },
];

/**
 * Cleans a permissions object from the role editor: unknown modules/actions are dropped, actions
 * are kept in canonical order, and any module with an action gets "view" too (you can't edit what
 * you can't see).
 */
function normalisePermissions(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("Permissions must be an object of module → actions");
  const result = {};
  for (const key of MODULE_KEYS) {
    const actions = Array.isArray(input[key]) ? input[key].filter((a) => ACTIONS.includes(a)) : [];
    if (!actions.length) continue;
    result[key] = ACTIONS.filter((a) => a === "view" || actions.includes(a));
  }
  return result;
}

function parseRoleInput(input, { partial = false } = {}) {
  const out = {};
  if (!partial || input.name !== undefined) {
    const name = String(input.name ?? "").trim();
    if (!name) fail("Role name is required");
    if (name.length > 100) fail("Role name must be 100 characters or fewer");
    out.name = name;
  }
  if (!partial || input.description !== undefined) {
    const description = String(input.description ?? "").trim();
    if (description.length > 255) fail("Description must be 255 characters or fewer");
    out.description = description || null;
  }
  if (!partial || input.permissions !== undefined) out.permissions = normalisePermissions(input.permissions);
  return out;
}

async function assertNameFree(ownerAdminId, name, exceptId = null) {
  const clash = await AccessRoleModel.findByName(ownerAdminId, name);
  if (clash && clash.id !== exceptId) fail("A role with this name already exists", 409);
}

const AccessService = {
  modules() {
    return { actions: ACTIONS, modules: MODULES.map(({ key, label, group }) => ({ key, label, group })) };
  },

  async ensureStarterRoles(ownerAdminId) {
    const existing = await AccessRoleModel.findAll(ownerAdminId);
    if (existing.length) return;
    for (const role of STARTER_ROLES) await AccessRoleModel.create({ ...role, ownerAdminId });
  },

  async listRoles(ownerAdminId) {
    await this.ensureStarterRoles(ownerAdminId);
    const roles = await AccessRoleModel.findAll(ownerAdminId);
    const counts = await AccessRoleModel.countStaff(roles.map((r) => r.id));
    return roles.map((role) => ({ ...role, staffCount: counts.get(role.id) || 0 }));
  },

  async createRole(ownerAdminId, input) {
    const data = parseRoleInput(input);
    await assertNameFree(ownerAdminId, data.name);
    return AccessRoleModel.create({ ...data, ownerAdminId });
  },

  async updateRole(ownerAdminId, id, input) {
    const role = await AccessRoleModel.findOwned(id, ownerAdminId);
    if (!role) fail("Role not found", 404);
    const data = parseRoleInput(input, { partial: true });
    if (data.name) await assertNameFree(ownerAdminId, data.name, id);
    return AccessRoleModel.update(id, data);
  },

  async deleteRole(ownerAdminId, id) {
    const role = await AccessRoleModel.findOwned(id, ownerAdminId);
    if (!role) fail("Role not found", 404);
    const inUse = (await AccessRoleModel.countStaff([id])).get(id) || 0;
    if (inUse) fail(`${inUse} staff ${inUse === 1 ? "member has" : "members have"} this role — give them another role first`, 409);
    await AccessRoleModel.delete(id);
    return { message: "Role deleted" };
  },

  // For staff invites/edits: the role must belong to the inviting admin's own workspace.
  async assertOwnRole(ownerAdminId, roleId) {
    const role = await AccessRoleModel.findOwned(roleId, ownerAdminId);
    if (!role) fail("Choose one of your workspace's roles", 400);
    return role;
  },

  /**
   * A staff (collaborator) account's effective permissions; null for every other role (their
   * access is decided by their own portal's rules, not by staff roles).
   *   - With a role: that role's permissions (a role deleted from under them grants nothing).
   *   - Without one (pre-roles account): the legacy rule, unchanged — view/create/edit in the
   *     granted modules, NULL meaning every legacy module.
   */
  async permissionsFor(user) {
    if (!user || user.role !== "collaborator") return null;
    if (user.roleId) {
      const role = await AccessRoleModel.findById(user.roleId);
      return role && role.ownerAdminId === user.invitedByAdminId ? role.permissions || {} : {};
    }
    const granted = user.allowedModules == null ? LEGACY_MODULE_KEYS : LEGACY_MODULE_KEYS.filter((key) => user.allowedModules.includes(key));
    return grant(granted, EDIT);
  },

  async roleSummaryFor(user) {
    if (!user?.roleId) return null;
    const role = await AccessRoleModel.findById(user.roleId);
    return role ? { id: role.id, name: role.name } : null;
  },
};

const can = (permissions, module, action) => Boolean(permissions?.[module]?.includes(action));

module.exports = AccessService;
module.exports.can = can;
module.exports.normalisePermissions = normalisePermissions;

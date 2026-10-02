const db = require("../../config/db");
const UserModel = require("../auth/user.model");
const NotificationService = require("../notifications/notification.service");
const AdminConnectionModel = require("./admin-connection.model");
const { copyBetweenAdmins } = require("./share-copy.service");

// Sharing between admins. Each admin is its own workspace and normally sees nothing of another's.
// Two admins who connect (one asks, the other accepts) can each browse the other's content and
// copy what they want into their own workspace. A copy is theirs: changing it changes nothing for
// the admin it came from, and later changes over there don't reach it. Either admin can end the
// connection; what was already copied stays.
//
// Not to be confused with staff (modules/access/): staff work INSIDE one admin's workspace.

function fail(message, statusCode = 400) {
  throw Object.assign(new Error(message), { statusCode });
}

const stripHtml = (value) => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const count = (value) => (Array.isArray(value) ? value.length : 0);

// What can be shared: the key the client uses → its table, and how a row is summarised in a list.
const KINDS = {
  competencies: { table: "competencies", label: "competency", labelPlural: "competencies", group: "Settings" },
  pathways: { table: "pathway_templates", label: "pathway", group: "Settings" },
  "system-levels": { table: "system_levels", label: "system level", group: "Settings" },
  items: { table: "items", label: "item", group: "Settings" },
  courses: { table: "courses", label: "course", group: "Content" },
  assessments: { table: "assessments", label: "assessment", group: "Content" },
  curricula: { table: "curricula", label: "curriculum", labelPlural: "curricula", group: "Content" },
};
const KIND_BY_TABLE = Object.fromEntries(Object.entries(KINDS).map(([key, kind]) => [kind.table, { key, ...kind }]));
const labelFor = (kind, n) => plural(n, kind.label, kind.labelPlural);

async function countBy(table, column, ids) {
  if (!ids.length) return new Map();
  const rows = await db(table).whereIn(column, ids).groupBy(column).select(column).count({ n: "*" });
  return new Map(rows.map((row) => [row[column], Number(row.n)]));
}

// One line under each name in the browse list — enough to tell entries apart and to see what
// will come along.
async function describeRows(key, rows) {
  const ids = rows.map((row) => row.id);
  if (key === "competencies") {
    const indicators = await countBy("competency_indicators", "competencyId", ids);
    return (row) => plural(indicators.get(row.id) || 0, "indicator");
  }
  if (key === "pathways") return (row) => stripHtml(row.description).slice(0, 120);
  if (key === "system-levels") return () => "";
  if (key === "items") return (row) => [row.kind === "service" ? "Service" : "Goods", row.category].filter(Boolean).join(" · ");
  if (key === "courses") {
    const modules = await countBy("course_modules", "courseId", ids);
    const sessions = await countBy("course_sessions", "courseId", ids);
    return (row) => [row.code, plural(modules.get(row.id) || 0, "module"), plural(sessions.get(row.id) || 0, "session")].filter(Boolean).join(" · ");
  }
  if (key === "assessments") {
    return (row) => [row.type, plural(count(row.items), "question")].filter(Boolean).join(" · ");
  }
  const courses = await countBy("course_curriculum_links", "curriculumId", ids);
  return (row) => [row.code, plural(courses.get(row.id) || 0, "course")].filter(Boolean).join(" · ");
}

// The connection, seen from one admin's side.
function present(connection, adminId, others) {
  const outgoing = connection.requesterAdminId === adminId;
  const other = others.get(outgoing ? connection.recipientAdminId : connection.requesterAdminId);
  return {
    id: connection.id,
    status: connection.status,
    direction: outgoing ? "sent" : "received",
    admin: other ? { name: other.name, email: other.email } : { name: "Unknown admin", email: "" },
    createdAt: connection.createdAt,
    respondedAt: connection.respondedAt,
  };
}

const SharingService = {
  kinds() {
    return Object.entries(KINDS).map(([key, kind]) => ({ key, label: kind.labelPlural || `${kind.label}s`, group: kind.group }));
  },

  async listConnections(adminId) {
    const connections = await AdminConnectionModel.findForAdmin(adminId);
    const otherIds = [...new Set(connections.map((c) => (c.requesterAdminId === adminId ? c.recipientAdminId : c.requesterAdminId)))];
    const users = otherIds.length ? await db("users").whereIn("id", otherIds).select("id", "name", "email") : [];
    const others = new Map(users.map((u) => [u.id, u]));
    return connections.map((connection) => present(connection, adminId, others));
  },

  // Asks another admin, by email, to connect. If they had already asked this admin, that request
  // is accepted instead — both want the same thing.
  async requestConnection(adminId, email) {
    const other = await UserModel.findByEmail(String(email || "").trim());
    if (!other || other.role !== "admin") fail("No admin account found with that email", 404);
    if (other.id === adminId) fail("That's your own account");

    const existing = await AdminConnectionModel.findBetween(adminId, other.id);
    if (existing) {
      if (existing.status === "accepted") fail("You're already connected with this admin", 409);
      if (existing.requesterAdminId === adminId) fail("You've already sent this admin a request", 409);
      return this.acceptConnection(adminId, existing.id);
    }

    const connection = await AdminConnectionModel.create({ requesterAdminId: adminId, recipientAdminId: other.id, status: "pending" });
    const me = await UserModel.findById(adminId);
    await NotificationService._notify(other.id, {
      type: "share_request",
      title: "Sharing request",
      message: `${me?.name || "Another admin"} wants to share content with you. Accept it in Settings → Sharing.`,
      payload: { connectionId: connection.id, route: "/settings?tab=sharing" },
    });
    return present(connection, adminId, new Map([[other.id, other]]));
  },

  async acceptConnection(adminId, connectionId) {
    const connection = await AdminConnectionModel.findById(connectionId);
    if (!connection || connection.recipientAdminId !== adminId || connection.status !== "pending") fail("Request not found", 404);
    const updated = await AdminConnectionModel.update(connectionId, { status: "accepted", respondedAt: new Date() });
    const [me, other] = await Promise.all([UserModel.findById(adminId), UserModel.findById(connection.requesterAdminId)]);
    await NotificationService._notify(connection.requesterAdminId, {
      type: "share_accepted",
      title: "Sharing request accepted",
      message: `${me?.name || "An admin"} accepted your request. You can now browse and copy each other's content in Settings → Sharing.`,
      payload: { connectionId, route: "/settings?tab=sharing" },
    });
    return present(updated, adminId, new Map(other ? [[other.id, other]] : []));
  },

  // Declines a request, withdraws one, or ends a connection — whichever side asks. Anything
  // already copied stays where it is.
  async removeConnection(adminId, connectionId) {
    const connection = await AdminConnectionModel.findById(connectionId);
    if (!connection || (connection.requesterAdminId !== adminId && connection.recipientAdminId !== adminId)) fail("Connection not found", 404);
    await AdminConnectionModel.delete(connectionId);
    return { message: connection.status === "accepted" ? "Connection ended" : "Request removed" };
  },

  // The other admin of an accepted connection this admin is part of — the gate for looking at
  // or copying anything of theirs.
  async connectedAdminId(adminId, connectionId) {
    const connection = await AdminConnectionModel.findById(connectionId);
    const mine = connection && (connection.requesterAdminId === adminId || connection.recipientAdminId === adminId);
    if (!mine) fail("Connection not found", 404);
    if (connection.status !== "accepted") fail("This request hasn't been accepted yet", 409);
    return connection.requesterAdminId === adminId ? connection.recipientAdminId : connection.requesterAdminId;
  },

  // What the connected admin has of one kind, with whether this admin already has a copy.
  async browse(adminId, connectionId, key) {
    const kind = KINDS[key];
    if (!kind) fail("Unknown kind of content");
    const sourceAdminId = await this.connectedAdminId(adminId, connectionId);

    const query = db(kind.table).where({ ownerAdminId: sourceAdminId });
    const rows = await (kind.table === "system_levels" ? query.orderBy("sequence", "asc") : query.orderBy("name", "asc"));
    const describe = await describeRows(key, rows);

    // Copies made earlier that this admin still has.
    const imports = await db("shared_imports").where({ ownerAdminId: adminId, sourceAdminId, entityTable: kind.table });
    const stillThere = imports.length
      ? new Set(await db(kind.table).where({ ownerAdminId: adminId }).whereIn("id", imports.map((i) => i.targetId)).pluck("id"))
      : new Set();
    const copied = new Set(imports.filter((i) => stillThere.has(i.targetId)).map((i) => i.sourceId));

    return rows.map((row) => ({ id: row.id, name: row.name, detail: describe(row), inMyWorkspace: copied.has(row.id) }));
  },

  // Copies the chosen entries, and everything they depend on, into this admin's workspace.
  async copy(adminId, connectionId, key, ids) {
    const kind = KINDS[key];
    if (!kind) fail("Unknown kind of content");
    if (!Array.isArray(ids) || !ids.length) fail("Choose at least one to add");
    if (ids.length > 200) fail("Add at most 200 at a time");
    const sourceAdminId = await this.connectedAdminId(adminId, connectionId);
    const result = await copyBetweenAdmins({ sourceAdminId, targetAdminId: adminId, table: kind.table, ids: [...new Set(ids.map(String))] });

    // "also brought in 3 assessments, 2 competencies" — everything created beyond what was asked for.
    const alsoCreated = Object.entries(result.created)
      .map(([table, n]) => [KIND_BY_TABLE[table], table === kind.table ? n - result.added : n])
      .filter(([other, n]) => other && n > 0)
      .map(([other, n]) => labelFor(other, n));
    return {
      added: result.added,
      alreadyHad: result.alreadyHad,
      label: labelFor(kind, result.added),
      alsoCreated,
    };
  },
};

module.exports = SharingService;

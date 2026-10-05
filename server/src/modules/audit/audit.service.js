const db = require("../../config/db");
const env = require("../../config/env");
const AuditLogModel = require("./audit-log.model");
const { resolve, shouldSkip, UUID } = require("./audit.resolver");
const { diffRecords } = require("./audit.diff");

// The activity log: who did what, to which record, when, and whether it went through.
//
//   capture()     what the audit middleware calls for every change-making request. It reads the
//                 record before the handler runs, and afterwards writes one entry describing what
//                 happened — including what changed, field by field.
//   recordAuth()  sign-in events, which aren't about a record (auth.controller.js).
//   list()/…      what the Activity page reads.
//
// Nothing here may ever break or slow the request it is describing: every write is best-effort,
// happens after the response has gone, and swallows its own errors.

const RETENTION_DAYS = 730; // two years
const PRUNE_EVERY_MS = 24 * 60 * 60 * 1000;
let lastPruneAt = 0;

const clip = (value, max) => (value == null ? null : String(value).slice(0, max));
const capitalise = (text) => (text ? text[0].toUpperCase() + text.slice(1) : text);

// What a record is called, for a person reading the log.
function labelOf(row) {
  if (!row) return null;
  const person = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  const label =
    row.name || row.title || person || row.invoiceNumber || row.batchNumber || row.guardianName || row.label ||
    [row.gradeName, row.streamName].filter(Boolean).join(" ").trim() || row.email || row.username || null;
  return label ? clip(label, 255) : null;
}

async function loadRow(table, id) {
  if (!table || !id) return null;
  try {
    return (await db(table).where({ id }).first()) || null;
  } catch {
    return null;
  }
}

// Which table an id column points at, so a changed "curriculumId" can be shown by name.
const REFERENCES = {
  curriculumId: "curricula", hubId: "learning_hubs", schoolId: "learning_hubs", parentHubId: "learning_hubs", teacherId: "teachers",
  classTeacherId: "teachers", educatorId: "teachers", classId: "classes", courseId: "courses", learnerId: "learners", roleId: "access_roles",
  assessmentId: "assessments", diagnosticAssessmentId: "assessments", pathwayId: "pathways", ageCategoryId: "age_categories",
  packageId: "home_learning_packages", roomId: "rooms", moduleId: "course_modules",
};

async function resolveNames(before, after) {
  const names = new Map();
  for (const [column, table] of Object.entries(REFERENCES)) {
    for (const id of new Set([before?.[column], after?.[column]].filter((v) => typeof v === "string" && UUID.test(v)))) {
      if (before?.[column] === after?.[column]) continue;
      names.set(`${column}:${id}`, labelOf(await loadRow(table, id)));
    }
  }
  return (column, id) => names.get(`${column}:${id}`) || null;
}

// The workspace (admin) an account's actions belong to. Admins and staff are direct; a hub,
// educator or learner login belongs to the admin who owns the hub they're attached to. Cached
// briefly — it is asked on every change such an account makes.
const workspaceCache = new Map();
async function workspaceOf(req) {
  if (req.ownerAdminId) return req.ownerAdminId;
  const user = req.user;
  if (!user) return null;
  const role = user.actualRole || user.role;
  if (role === "admin") return user.id;
  if (role === "collaborator") return user.invitedByAdminId || null;
  const cached = workspaceCache.get(user.id);
  if (cached && cached.at > Date.now() - 10 * 60 * 1000) return cached.ownerAdminId;

  let ownerAdminId = null;
  try {
    if (role === "school") ownerAdminId = req.ownSchool?.ownerAdminId || (await db("learning_hubs").whereRaw("LOWER(email) = ?", [String(user.email || "").toLowerCase()]).first())?.ownerAdminId || null;
    else if (role === "teacher") {
      const teacher = req.ownTeacher || (await db("teachers").whereRaw("LOWER(email) = ?", [String(user.email || "").toLowerCase()]).first());
      ownerAdminId = teacher?.createdByAdminId || null;
      if (!ownerAdminId && teacher) {
        const hub = await db("teacher_hub_links").join("learning_hubs", "learning_hubs.id", "teacher_hub_links.hubId").where("teacher_hub_links.teacherId", teacher.id).select("learning_hubs.ownerAdminId").first();
        ownerAdminId = hub?.ownerAdminId || null;
      }
    } else if (role === "learner") {
      const learner = req.ownLearner
        || (user.username ? await db("learners").whereRaw("LOWER(username) = ?", [user.username.toLowerCase()]).first() : await db("learners").whereRaw("LOWER(guardianEmail) = ?", [String(user.email || "").toLowerCase()]).first());
      ownerAdminId = learner?.createdByAdminId || null;
      if (!ownerAdminId && learner) {
        const hub = await db("learner_hub_links").join("learning_hubs", "learning_hubs.id", "learner_hub_links.hubId").where("learner_hub_links.learnerId", learner.id).select("learning_hubs.ownerAdminId").first();
        ownerAdminId = hub?.ownerAdminId || null;
      }
    } else if (role === "curriculumAdmin") {
      ownerAdminId = (await db("curricula").where({ curriculumAdminId: user.id }).first())?.ownerAdminId || null;
    }
  } catch {
    ownerAdminId = null;
  }
  workspaceCache.set(user.id, { ownerAdminId, at: Date.now() });
  return ownerAdminId;
}

// Who is acting, as they are now. A staff member's request runs as "admin" (scope.middleware.js);
// the log wants the real account and, for staff, the name of their role.
async function actorOf(user) {
  if (!user) return { actorUserId: null, actorName: "Website visitor", actorEmail: null, actorRole: "visitor", actorAccessRole: null };
  let account = null;
  let accessRole = null;
  try {
    account = await db("users").where({ id: user.id }).select("name", "email", "username", "role", "roleId").first();
    if (account?.role === "collaborator" && account.roleId) accessRole = (await db("access_roles").where({ id: account.roleId }).select("name").first())?.name || null;
  } catch {
    account = null;
  }
  return {
    actorUserId: user.id,
    actorName: clip(account?.name || user.email || user.username || "Unknown", 150),
    actorEmail: clip(account?.email || user.email || account?.username || user.username, 190),
    actorRole: account?.role || user.actualRole || user.role || null,
    actorAccessRole: clip(accessRole, 100),
  };
}

const quote = (label) => (label ? ` “${label}”` : "");

// One line a person can read: "Edited bootcamp “Robot Builders”".
function summarise({ ctx, label, parentLabel, linkedLabel, body, requestBody }) {
  const { action, entity, parent, linked, collection, rootNoun } = ctx;
  // Adding to a collection ("…/courses/<id>/sessions"): the new thing is what's named, and the
  // record the path stopped at is where it was added.
  const adding = action === "create" && collection;
  const noun = (adding ? collection : entity || collection)?.noun || rootNoun;
  const within = adding && entity ? entity : parent;
  const inParent = within && parentLabel ? ` in ${within.noun}${quote(parentLabel)}` : "";

  // A few requests read better said plainly than derived from their address.
  const path = ctx.path;
  if (path === "/api/auth/me") return "Updated their own profile";
  if (path === "/api/auth/change-password") return "Changed their own password";
  if (path === "/api/admin-tools/reassign-owner") return `Moved a ${requestBody?.entityType || "record"}${quote(label)} to another admin${requestBody?.targetAdminEmail ? ` (${requestBody.targetAdminEmail})` : ""}`;
  if (/^\/api\/sharing\/connections\/[^/]+\/copy$/.test(path)) return `Copied ${body?.data?.label || requestBody?.kind || "content"} from another admin${body?.data?.alsoCreated?.length ? `, with ${body.data.alsoCreated.join(", ")}` : ""}`;
  if (/^\/api\/sharing\/connections\/[^/]+\/accept$/.test(path)) return `Accepted a sharing request${body?.data?.admin?.name ? ` from ${body.data.admin.name}` : ""}`;
  if (path === "/api/sharing/connections" && action === "create") return `Sent a sharing request${body?.data?.admin?.email ? ` to ${body.data.admin.email}` : ""}`;
  if (path === "/api/attendance/mark") return "Marked attendance";
  if (ctx.root === "public") return `Website: ${ctx.words.join(" ") || "form"} submitted${quote(label)}`;

  if (action === "link") return `Added ${linked.noun}${quote(linkedLabel)} to ${noun}${quote(label)}`;
  if (action === "unlink") return `Removed ${linked.noun}${quote(linkedLabel)} from ${noun}${quote(label)}`;
  if (action === "create") return `Added ${noun}${quote(label)}${inParent}`;
  if (action === "delete") return `Deleted ${noun}${quote(label)}${inParent}`;
  if (action === "update") return `Edited ${noun}${quote(label)}${ctx.words.length ? ` (${ctx.words.join(" ")})` : ""}${inParent}`;
  return `${capitalise(action)}: ${noun}${quote(label)}${inParent}`;
}

// Something that was refused or broke didn't happen — say what was attempted, not that it was done.
const ATTEMPT = { Added: "add", Edited: "edit", Deleted: "delete", Removed: "remove", Copied: "copy", Moved: "move", Marked: "mark", Updated: "update", Changed: "change", Sent: "send", Accepted: "accept" };
function asAttempt(summary) {
  const [first, ...rest] = summary.split(" ");
  return ATTEMPT[first] ? `Tried to ${ATTEMPT[first]} ${rest.join(" ")}` : `Tried: ${summary}`;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function clientOf(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  const address = forwarded || req.ip || req.socket?.remoteAddress || null;
  // "::ffff:41.90.x.x" is just how an IPv4 address looks on a dual-stack socket.
  return { ip: clip(address ? String(address).replace(/^::ffff:/, "") : null, 64), userAgent: clip(req.headers?.["user-agent"] || null, 255) };
}

async function write(entry) {
  try {
    await AuditLogModel.create(entry);
    if (Date.now() - lastPruneAt > PRUNE_EVERY_MS) {
      lastPruneAt = Date.now();
      await AuditLogModel.prune(new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000));
    }
  } catch (err) {
    console.error("[audit] could not record:", err.message);
  }
}

const AuditService = {
  RETENTION_DAYS,

  // Before the handler runs: note what is about to be touched, as it is now. Returns the context
  // finish() needs, or null when this request isn't one the log covers.
  async begin(req) {
    if (!MUTATING.has(req.method)) return null;
    const path = String(req.originalUrl || "").split("?")[0];
    if (shouldSkip(path)) return null;
    const ctx = resolve(req.method, path);
    if (!ctx) return null;
    ctx.path = path.toLowerCase().replace(/\/+$/, "");
    const before = ctx.entity ? await loadRow(ctx.entity.table, ctx.entity.id) : null;
    return { ctx, before };
  },

  // After the response has gone: write the entry. `body` is what the handler answered with.
  async finish(req, res, started, body) {
    if (!started) return;
    const status = res.statusCode;
    // Only what happened (2xx), what was refused (403), and what broke (5xx). A form sent back
    // for a typo, or a record that wasn't found, changed nothing and says nothing about anyone.
    const outcome = status < 300 ? "success" : status === 403 ? "refused" : status >= 500 ? "failed" : null;
    if (!outcome) return;
    const { ctx, before } = started;
    // Anonymous requests are only of interest on the public website routes.
    if (!req.user && ctx.root !== "public") return;

    try {
      const data = body && typeof body === "object" ? body.data : null;
      const created = ctx.action === "create" && data && !Array.isArray(data) && typeof data === "object" ? data : null;
      // Something added to a collection is the record this entry is about — not the one it was added to.
      const adding = ctx.action === "create" && ctx.collection;
      const entityId = adding ? (typeof created?.id === "string" ? created.id : null) : ctx.entity?.id || null;
      const table = (adding ? ctx.collection : ctx.entity || ctx.collection)?.table || null;

      // Still there after the request? Then what it looks like now (for the diff, and its name).
      const after = outcome === "success" && ctx.action !== "delete" && ctx.entity ? await loadRow(ctx.entity.table, ctx.entity.id) : null;
      const label = adding ? labelOf(created) : labelOf(after) || labelOf(before) || labelOf(created);
      const container = adding && ctx.entity ? ctx.entity : ctx.parent;
      const parentLabel = container ? labelOf(container === ctx.entity ? before : await loadRow(container.table, container.id)) : null;
      const linkedId = ctx.linked ? ctx.linked.id || req.body?.[ctx.linked.bodyKey] : null;
      const linkedLabel = ctx.linked ? labelOf(await loadRow(ctx.linked.table, linkedId)) : null;

      const changes = outcome === "success" && !adding && before && after ? diffRecords(before, after, await resolveNames(before, after)) : [];
      const ownerAdminId = (await workspaceOf(req)) || (ctx.root === "public" ? env.PUBLIC_CONTENT_ADMIN_ID || null : null)
        || before?.ownerAdminId || null;

      const summary = summarise({ ctx, label, parentLabel, linkedLabel, body, requestBody: req.body });
      await write({
        ownerAdminId,
        ...(await actorOf(req.user)),
        action: clip(ctx.action, 40),
        module: ctx.module,
        entityType: table,
        entityId,
        entityLabel: label,
        summary: clip(outcome === "success" ? summary : asAttempt(summary), 500),
        changes: changes.length ? changes : null,
        outcome,
        statusCode: status,
        reason: outcome === "success" ? null : clip(res.locals?.auditReason || body?.message, 300),
        method: req.method,
        path: clip(ctx.path, 255),
        ...clientOf(req),
      });
    } catch (err) {
      console.error("[audit] could not record:", err.message);
    }
  },

  // Sign-in events. `user` is the account (when there is one); `identifier` what was typed.
  //   event: login | login_failed | logout | password_changed | password_reset | password_reset_requested | session_expired
  async recordAuth(req, event, { user = null, identifier = null, reason = null } = {}) {
    try {
      // Always the stored account — callers may only have its id.
      const account = user?.id
        ? await db("users").where({ id: user.id }).first()
        : identifier ? await db("users").whereRaw("LOWER(email) = ? OR LOWER(username) = ?", [String(identifier).toLowerCase(), String(identifier).toLowerCase()]).first() : null;
      const who = account ? await actorOf(account) : { actorUserId: null, actorName: clip(identifier || "Unknown", 150), actorEmail: clip(identifier, 190), actorRole: null, actorAccessRole: null };
      const failed = event === "login_failed";
      const SUMMARIES = {
        login: "Signed in",
        login_failed: `Failed sign-in attempt${identifier ? ` as ${identifier}` : ""}`,
        logout: "Signed out",
        password_changed: "Changed their password",
        password_reset: "Reset their password from an emailed link",
        session_expired: "Signed out after inactivity",
      };
      await write({
        ownerAdminId: account ? await workspaceOf({ user: account }) : null,
        ...who,
        action: event,
        module: "account",
        entityType: account ? "users" : null,
        entityId: account?.id || null,
        entityLabel: account ? clip(account.name || account.email || account.username, 255) : null,
        summary: SUMMARIES[event] || event,
        changes: null,
        outcome: failed ? "refused" : "success",
        statusCode: failed ? 401 : 200,
        reason: clip(reason, 300),
        method: req?.method || null,
        path: req ? clip(String(req.originalUrl || "").split("?")[0], 255) : null,
        ...(req ? clientOf(req) : { ip: null, userAgent: null }),
      });
    } catch (err) {
      console.error("[audit] could not record:", err.message);
    }
  },

  // ── What the Activity page reads ──────────────────────────────────────────────────────────

  async list(ownerAdminId, filters = {}, { page = 1, pageSize = 50 } = {}) {
    const limit = Math.min(Math.max(Number(pageSize) || 50, 1), 200);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
    const rows = await AuditLogModel.find({ ...filters, ownerAdminId }, { limit, offset });
    return { items: rows.slice(0, limit), hasMore: rows.length > limit, page: Math.max(Number(page) || 1, 1) };
  },

  async facets(ownerAdminId) {
    const [actors, modules] = await Promise.all([AuditLogModel.actors(ownerAdminId), AuditLogModel.modules(ownerAdminId)]);
    return {
      actors: actors.map((a) => ({ id: a.actorUserId, name: a.actorName, email: a.actorEmail, role: a.actorRole, lastActiveAt: a.lastActiveAt, entries: Number(a.entries) })),
      modules: modules.sort(),
      retentionDays: RETENTION_DAYS,
    };
  },

  // Up to 10,000 rows for a spreadsheet, same filters as the page.
  async exportRows(ownerAdminId, filters = {}) {
    const rows = await AuditLogModel.find({ ...filters, ownerAdminId }, { limit: 10000, offset: 0 });
    return rows.slice(0, 10000);
  },
};

module.exports = AuditService;

const db = require("../../config/db");
const R = require("./removal.rules");
const UserModel = require("../auth/user.model");
const UserSessionModel = require("../auth/user-session.model");
const { rolesOf } = require("../auth/account-roles");

// Removing a claims / QA supervisor (a login — modules/removals/removal.service.js says how the
// steps fit together).
//
// Deactivate: their login is switched off (sign-in refused, sessions ended), and claims stop going
// to them (claim.service.js's supervisorOf sends them to the admin). A login that is also something
// else (an educator, staff, a parent) stays on — only the Supervisor role comes off at the end.
// Handed over to another supervisor of the workspace, or to nobody (admins then approve): the
// educators they supervise and the claims waiting for them; to another supervisor: the QA visits
// they're due to do and the QA schedules they review.
// Kept under their name: QA reports they wrote and claims they decided — so with any of that their
// login is retired, not deleted (auth.service.js's retireRole).

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const isSupervisor = (user) => Boolean(user) && rolesOf(user).includes("supervisor");
const nameOf = (t) => [t?.firstName, t?.lastName].filter(Boolean).join(" ").trim() || "An educator";
const otherRoles = (user) => rolesOf(user).filter((r) => r !== "supervisor" && r !== "hubLead");
const ROLE_WORD = { teacher: "an educator", collaborator: "staff", learner: "a parent", school: "a learning hub", affiliate: "an affiliate" };
const byId = async (table, ids, columns) => {
  const unique = [...new Set(ids.filter(Boolean))];
  return new Map((unique.length ? await db(table).whereIn("id", unique).select(columns) : []).map((r) => [r.id, r]));
};

async function load(req, id) {
  const person = id ? await UserModel.findById(id) : null;
  if (!isSupervisor(person) || person.invitedByAdminId !== req.ownerAdminId) fail("Supervisor not found", 404);
  return { req, id, person, ownerAdminId: req.ownerAdminId };
}

function describe({ person }) {
  const others = otherRoles(person);
  return {
    id: person.id,
    name: person.name || "Supervisor",
    detail: person.email || null,
    status: person.deactivatedAt ? "inactive" : "active",
    // A login that is also someone else isn't switched off — that would stop their other role too.
    deactivated: Boolean(person.deactivatedAt) || others.length > 0,
    removed: Boolean(person.removedAt),
    removedAt: person.removedAt || null,
    deactivateNote: others.length
      ? `Their login is also ${others.map((r) => ROLE_WORD[r] || r).join(" and ")}, so it stays on — new claims go to the admin from now, and only the Supervisor role comes off at the end.`
      : "Deactivating switches their login off: they can't sign in, and new claims go to the admin.",
  };
}

async function holdings(ctx) {
  const { id } = ctx;
  const items = [];
  for (const t of await db("teachers").where({ supervisorId: id }).whereNot({ status: "removed" }).orderBy("firstName").select("id", "firstName", "lastName")) {
    items.push({ key: R.itemKey("educator", t.id), type: "educator", group: "Educators they supervise", id: t.id, label: nameOf(t), allowNone: true, detail: "Another supervisor, or none (admins approve)" });
  }
  for (const c of await db("teacher_claims").where({ supervisorId: id, status: "pending_supervisor" }).orderBy("createdAt").select("id", "claimNumber", "teacherName", "amount", "currency")) {
    items.push({
      key: R.itemKey("claim", c.id), type: "claim", group: "Claims waiting for them", id: c.id, allowNone: true,
      label: `${c.claimNumber || "Claim"} — ${c.teacherName || "an educator"}`, detail: `${c.currency || "KES"} ${Number(c.amount || 0).toLocaleString("en-KE")} · or none (admins approve)`,
    });
  }
  const visits = await db("qa_visits").where({ reviewerId: id, status: "open" }).orderBy("scheduledDate").select("id", "teacherId", "scheduledDate");
  const visitTeachers = await byId("teachers", visits.map((v) => v.teacherId), ["id", "firstName", "lastName"]);
  for (const v of visits) {
    items.push({ key: R.itemKey("qaVisit", v.id), type: "qaVisit", group: "QA visits to do", id: v.id, label: nameOf(visitTeachers.get(v.teacherId)), detail: String(v.scheduledDate || "").slice(0, 10) || null });
  }
  const schedules = await db("qa_schedules").where({ reviewerId: id, status: "active" }).select("id", "teacherId", "frequency");
  const scheduleTeachers = await byId("teachers", schedules.map((s) => s.teacherId), ["id", "firstName", "lastName"]);
  for (const s of schedules) {
    items.push({ key: R.itemKey("qaSchedule", s.id), type: "qaSchedule", group: "QA visit schedules", id: s.id, label: nameOf(scheduleTeachers.get(s.teacherId)), detail: s.frequency || null });
  }
  return items;
}

async function candidates(ctx) {
  const users = (await UserModel.findAll({ invitedByAdminId: ctx.ownerAdminId }))
    .filter((u) => u.id !== ctx.id && isSupervisor(u) && !u.deactivatedAt && !u.removedAt);
  return users.map((u) => ({ id: u.id, name: u.name, detail: u.email })).sort((a, b) => a.name.localeCompare(b.name));
}

async function receiver(ctx, toId) {
  const to = await UserModel.findById(toId);
  if (!isSupervisor(to) || to.invitedByAdminId !== ctx.ownerAdminId || to.deactivatedAt) fail("Choose an active supervisor", 409);
  return to;
}

const HANDLERS = {
  async educator(ctx, item, target) {
    const supervisorId = target === R.NOBODY ? null : (await receiver(ctx, target)).id;
    await db("teachers").where({ id: item.id, supervisorId: ctx.id }).update({ supervisorId, updatedAt: new Date() });
  },
  async claim(ctx, item, target) {
    const now = new Date();
    if (target === R.NOBODY) {
      await db("teacher_claims").where({ id: item.id, supervisorId: ctx.id, status: "pending_supervisor" })
        .update({ status: "pending_admin", supervisorId: null, supervisorName: null, updatedAt: now });
      return;
    }
    const to = await receiver(ctx, target);
    await db("teacher_claims").where({ id: item.id, supervisorId: ctx.id, status: "pending_supervisor" }).update({ supervisorId: to.id, supervisorName: to.name, updatedAt: now });
  },
  async qaVisit(ctx, item, target) {
    const to = await receiver(ctx, target);
    await db("qa_visits").where({ id: item.id, reviewerId: ctx.id, status: "open" }).update({ reviewerId: to.id, updatedBy: ctx.req.user.id, updatedAt: new Date() });
  },
  async qaSchedule(ctx, item, target) {
    const to = await receiver(ctx, target);
    await db("qa_schedules").where({ id: item.id, reviewerId: ctx.id }).update({ reviewerId: to.id, updatedBy: ctx.req.user.id, updatedAt: new Date() });
  },
};

async function transferItem(ctx, item, target) {
  const handler = HANDLERS[item.type];
  if (!handler) fail("This can't be handed over here", 400);
  await handler(ctx, item, target);
}

async function toSettle() {
  return [];
}

async function automatic(ctx) {
  return otherRoles(ctx.person).length
    ? ["The Supervisor role comes off their login; their other roles stay"]
    : ["Their login is closed"];
}

async function runAutomatic() {}

const count = async (q) => Number((await q.count({ n: "*" }).first())?.n || 0);

async function history(ctx) {
  const [qa, claims] = await Promise.all([
    count(db("qa_visits").where({ status: "submitted" }).where((w) => w.where({ reviewerId: ctx.id }).orWhere({ submittedBy: ctx.id }))),
    count(db("teacher_claims").whereNotNull("supervisorDecidedAt").where({ supervisorId: ctx.id })),
  ]);
  return [
    qa && R.counted(qa, "QA report they wrote", "QA reports they wrote"),
    claims && R.counted(claims, "claim they decided", "claims they decided"),
  ].filter(Boolean);
}

async function deactivate(ctx) {
  if (otherRoles(ctx.person).length) return; // stays on for their other roles (see describe)
  await db("users").where({ id: ctx.id }).update({ deactivatedAt: new Date(), updatedAt: new Date() });
  await UserSessionModel.deleteByUserId(ctx.id);
}

async function remove(ctx, { history: kept = [] } = {}) {
  const AuthService = require("../auth/auth.service");
  if (kept.length) await AuthService.retireRole(ctx.person, "supervisor");
  else await AuthService.dropRole(ctx.person, "supervisor");
  return kept.length ? "tombstone" : "deleted";
}

module.exports = { load, describe, holdings, candidates, transferItem, toSettle, automatic, runAutomatic, history, deactivate, remove };

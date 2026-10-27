const db = require("../../config/db");
const CheckinModel = require("./checkin.model");
const CheckinNotifications = require("./checkin.notifications");
const { contextOf, assignedHubIds, isAssignedTo, workspacePeople } = require("./checkin.access");
const { todayInKenya, addDays, occurrenceDates } = require("./checkin.dates");
const { sessionState, reportProblems, taskState } = require("./checkin.rules");
const { GENERATE_AHEAD_DAYS } = require("./checkin.constants");
const { HUB_LEAD_ROLE, canBeHubLead, extraRolesOf } = require("../auth/account-roles");
const UserSessionModel = require("../auth/user-session.model");
const { generateId } = require("../../shared/utils/model.utils");

// Hub check-ins — see the 20261022130000 and 20261026110000 migrations for the tables,
// checkin.access.js for who sees what.
//
//   The admin names each hub's Account Manager and Training Lead on the hub itself, then sets up
//   its check-ins: how often, the first check-in, online or in person (applyHubPeople keeps the
//   schedules in step when the hub's people change). Each check-in is put on the calendar ahead of time
//   (GENERATE_AHEAD_DAYS, and always the next one) from `generateFrom` — the day the schedule was
//   set up or its timing last changed — never into the past, keyed (scheduleId, occurrenceDate) so
//   generating again never makes a second copy.
//
//   A check-in is upcoming, then due on its day — with a notification, and the sign-in pop-up
//   (dueForMe) until its report is in — then reported. The report is one shared form: highs, lows,
//   resolutions. How the check-in is arranged or held isn't recorded.
//
//   Editing a schedule changes its upcoming check-ins that haven't been reported (a new frequency or
//   first date replaces them with a fresh set). Ending one removes them. Reported check-ins, and
//   past ones, keep their own record.

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const nameOf = (user) => user?.name || user?.email || "Someone";

async function hubOf(ctx, hubId) {
  const hub = await db("learning_hubs").where({ id: hubId, ownerAdminId: ctx.ownerAdminId }).select("id", "name", "accountManagerId", "trainingLeadId").first();
  if (!hub) fail("Hub not found", 404);
  return hub;
}

// A hub's check-ins are run by the Account Manager and Training Lead named on the hub itself.
function peopleOfHub(hub) {
  if (!hub.accountManagerId || !hub.trainingLeadId) {
    fail(`Name ${hub.name}'s Account Manager and Training Lead first — Learning Hubs → ${hub.name} → Edit`, 409);
  }
  return { accountManagerId: hub.accountManagerId, trainingLeadId: hub.trainingLeadId };
}

async function hubNames(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await db("learning_hubs").whereIn("id", unique).select("id", "name");
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function peopleNames(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await db("users").whereIn("id", unique).select("id", "name", "email");
  return new Map(rows.map((r) => [r.id, nameOf(r)]));
}

// The people on a hub (and so its check-ins) must be admins or educators (with a login) of this
// workspace, and different. Either may be left empty on the hub; check-ins need both.
async function assertAssignable(ctx, { accountManagerId, trainingLeadId }) {
  if (accountManagerId && accountManagerId === trainingLeadId) fail("Choose different people as Account Manager and Training Lead");
  const people = await workspacePeople(ctx.ownerAdminId);
  for (const [label, userId] of [["Account Manager", accountManagerId], ["Training Lead", trainingLeadId]]) {
    if (!userId) continue;
    if (!people.some((p) => p.id === userId)) fail(`The ${label} must be an admin, or an educator with a login, of this workspace`);
  }
}

const requireManager = (ctx) => { if (!ctx.isManager) fail("Only an admin can set up check-ins", 403); };

// The check-ins a schedule should have from `from` on, as rows ready to insert.
function sessionRowsFor(schedule, from, today) {
  const until = addDays(today, GENERATE_AHEAD_DAYS);
  return occurrenceDates(schedule, until, { from }).map((date) => ({
    ownerAdminId: schedule.ownerAdminId,
    scheduleId: schedule.id,
    hubId: schedule.hubId,
    occurrenceDate: date,
    scheduledDate: date,
    format: schedule.format,
    accountManagerId: schedule.accountManagerId || null,
    trainingLeadId: schedule.trainingLeadId || null,
    status: "open",
  }));
}

// A schedule's check-ins still ahead and not reported: safe to rewrite or remove.
const unreportedUpcoming = (connection, scheduleId, today) => connection("checkin_sessions")
  .where({ scheduleId, status: "open" })
  .where("scheduledDate", ">", today);

// Puts every active schedule's upcoming check-ins on the calendar.
async function generateAll(ownerAdminId = null, today = todayInKenya()) {
  const schedules = await CheckinModel.activeSchedules(ownerAdminId);
  for (const schedule of schedules) await CheckinModel.insertSessionsIgnoringExisting(sessionRowsFor(schedule, schedule.generateFrom, today));
  return schedules.length;
}

// "Check-in due today" to the pair on each open check-in whose day it is. Keyed, so repeats send
// nothing new.
async function sendDueNotices(ownerAdminId = null, today = todayInKenya()) {
  let q = db("checkin_sessions").where({ status: "open", scheduledDate: today });
  if (ownerAdminId) q = q.where({ ownerAdminId });
  const sessions = await q;
  const names = await hubNames(sessions.map((s) => s.hubId));
  for (const s of sessions) await CheckinNotifications.due(s, names.get(s.hubId) || "a hub");
  return sessions.length;
}

// "Task due" to whoever has an open task whose deadline has come — once per deadline (remindedFor),
// so a task left overdue isn't looked at again, and a new deadline gets its own reminder.
async function sendTaskDueNotices(ownerAdminId = null, today = todayInKenya()) {
  let q = db("checkin_tasks").where({ status: "open" }).where("dueDate", "<=", today)
    .where((w) => w.whereNull("remindedFor").orWhereRaw("remindedFor <> dueDate"));
  if (ownerAdminId) q = q.where({ ownerAdminId });
  const tasks = await q;
  const names = await hubNames(tasks.map((t) => t.hubId));
  for (const task of tasks) {
    await CheckinNotifications.taskDue(task, names.get(task.hubId) || "a hub", today);
    await db("checkin_tasks").where({ id: task.id }).update({ remindedFor: task.dueDate });
  }
  return tasks.length;
}

// The page-load version of the cron job, for one workspace — at most once every few minutes.
const lastRun = new Map();
async function keepCurrent(ownerAdminId) {
  const last = lastRun.get(ownerAdminId) || 0;
  if (Date.now() - last < 5 * 60 * 1000) return;
  lastRun.set(ownerAdminId, Date.now());
  try {
    await generateAll(ownerAdminId);
    await sendDueNotices(ownerAdminId);
    await sendTaskDueNotices(ownerAdminId);
  } catch (err) {
    lastRun.delete(ownerAdminId);
    console.error("[checkins] could not bring check-ins up to date:", err.message);
  }
}

// ---- Views ----

async function decorateSessions(sessions, today) {
  const [names, hubs, schedules] = await Promise.all([
    peopleNames(sessions.flatMap((s) => [s.accountManagerId, s.trainingLeadId, s.reportSubmittedBy])),
    hubNames(sessions.map((s) => s.hubId)),
    sessions.length ? db("checkin_schedules").whereIn("id", [...new Set(sessions.map((s) => s.scheduleId))]).select("id", "frequency") : [],
  ]);
  const frequencies = new Map(schedules.map((s) => [s.id, s.frequency]));
  return sessions.map((s) => ({
    id: s.id,
    scheduleId: s.scheduleId,
    hubId: s.hubId,
    hubName: hubs.get(s.hubId) || null,
    frequency: frequencies.get(s.scheduleId) || null,
    scheduledDate: s.scheduledDate,
    format: s.format,
    accountManagerId: s.accountManagerId,
    accountManagerName: names.get(s.accountManagerId) || null,
    trainingLeadId: s.trainingLeadId,
    trainingLeadName: names.get(s.trainingLeadId) || null,
    status: s.status,
    state: sessionState(s, today),
    reportSubmittedAt: s.reportSubmittedAt,
    reportSubmittedByName: names.get(s.reportSubmittedBy) || null,
  }));
}

const mine = (ctx) => (w) => w.where({ accountManagerId: ctx.userId }).orWhere({ trainingLeadId: ctx.userId });

async function loadSession(ctx, id, { forUpdate = false, connection = db } = {}) {
  const session = await CheckinModel.findSession(id, connection, forUpdate);
  if (!session || session.ownerAdminId !== ctx.ownerAdminId) fail("Check-in not found", 404);
  if (ctx.isHub) {
    if (session.hubId !== ctx.hubId) fail("Check-in not found", 404);
    return session;
  }
  if (!ctx.isManager && !isAssignedTo(ctx, session)) {
    const hubs = await assignedHubIds(ctx);
    if (!hubs.includes(session.hubId)) fail("Check-in not found", 404);
  }
  return session;
}

const canWriteReport = (ctx, session) => !ctx.isHub && (ctx.isManager || isAssignedTo(ctx, session));

// ---- Tasks from the resolutions ----
//   Whoever can write the report sets a check-in's tasks (from its day on, like the report): what,
//   for whom — its Account Manager, its Training Lead, or an admin of the workspace — and by when.
//   They can change or remove them; the person a task is for marks it done (so can they). The
//   person is told when given one, and again when its deadline comes.

const canManageTasks = (ctx, session, today) => canWriteReport(ctx, session) && session.scheduledDate <= today;
const canTickTask = (ctx, session, task) => canWriteReport(ctx, session) || task.assigneeId === ctx.userId;

// Who a check-in's tasks can go to, each with what they are to it.
async function taskAssignees(session) {
  const [names, people] = await Promise.all([
    peopleNames([session.accountManagerId, session.trainingLeadId]),
    workspacePeople(session.ownerAdminId),
  ]);
  const list = [];
  if (session.accountManagerId) list.push({ id: session.accountManagerId, name: names.get(session.accountManagerId) || "Account Manager", roleName: "Account Manager" });
  if (session.trainingLeadId) list.push({ id: session.trainingLeadId, name: names.get(session.trainingLeadId) || "Training Lead", roleName: "Training Lead" });
  for (const p of people.filter((x) => x.kind === "admin")) {
    if (!list.some((x) => x.id === p.id)) list.push({ id: p.id, name: p.name, roleName: "Admin" });
  }
  return list;
}

async function decorateTasks(rows, today) {
  const [names, hubs, sessions] = await Promise.all([
    peopleNames(rows.flatMap((t) => [t.assigneeId, t.doneBy, t.createdBy])),
    hubNames(rows.map((t) => t.hubId)),
    rows.length ? db("checkin_sessions").whereIn("id", [...new Set(rows.map((t) => t.sessionId))]).select("id", "scheduledDate") : [],
  ]);
  const checkinDate = new Map(sessions.map((s) => [s.id, s.scheduledDate]));
  return rows.map((t) => ({
    id: t.id,
    sessionId: t.sessionId,
    hubId: t.hubId,
    hubName: hubs.get(t.hubId) || null,
    checkinDate: checkinDate.get(t.sessionId) || null,
    title: t.title,
    assigneeId: t.assigneeId,
    assigneeName: names.get(t.assigneeId) || null,
    dueDate: t.dueDate,
    status: t.status,
    state: taskState(t, today),
    doneAt: t.doneAt,
    doneByName: names.get(t.doneBy) || null,
    createdByName: names.get(t.createdBy) || null,
  }));
}

async function loadTask(ctx, id) {
  const task = await db("checkin_tasks").where({ id }).first();
  if (!task || task.ownerAdminId !== ctx.ownerAdminId) fail("Task not found", 404);
  return { task, session: await loadSession(ctx, task.sessionId) };
}

async function assertTaskFits(session, data) {
  if (!(await taskAssignees(session)).some((a) => a.id === data.assigneeId)) {
    fail("A task goes to the check-in's Account Manager or Training Lead, or an admin");
  }
  if (data.dueDate < session.scheduledDate) fail("The deadline can't be before the check-in");
}

const CheckinService = {
  contextOf,
  keepCurrent,
  generateAll,
  sendDueNotices,
  sendTaskDueNotices,

  async people(req) {
    return workspacePeople(contextOf(req).ownerAdminId);
  },

  async hubs(req) {
    const ctx = contextOf(req);
    let q = db("learning_hubs").where({ ownerAdminId: ctx.ownerAdminId }).select("id", "name", "hubType", "accountManagerId", "trainingLeadId").orderBy("name", "asc");
    if (!ctx.isManager) {
      const ids = await assignedHubIds(ctx);
      q = q.whereIn("id", ids.length ? ids : ["__none__"]);
    }
    const hubs = await q;
    const names = await peopleNames(hubs.flatMap((h) => [h.accountManagerId, h.trainingLeadId]));
    return hubs.map((h) => ({ ...h, accountManagerName: names.get(h.accountManagerId) || null, trainingLeadName: names.get(h.trainingLeadId) || null }));
  },

  // For the hub form (learning-hub.controller.js): the Account Manager and Training Lead it names
  // must be people who can take part in check-ins here.
  async assertHubPeople(req, people) {
    await assertAssignable(contextOf(req), people);
  },

  // A hub's Account Manager or Training Lead changed: its active schedules and their upcoming
  // check-ins (not yet reported) move to the new people, who are told. Today's and earlier ones
  // keep whoever they had.
  async applyHubPeople(req, hubId) {
    const ctx = contextOf(req);
    const hub = await hubOf(ctx, hubId);
    const people = { accountManagerId: hub.accountManagerId || null, trainingLeadId: hub.trainingLeadId || null };
    const today = todayInKenya();
    const schedules = await db("checkin_schedules").where({ hubId, status: "active", ownerAdminId: ctx.ownerAdminId });
    for (const before of schedules) {
      if (before.accountManagerId === people.accountManagerId && before.trainingLeadId === people.trainingLeadId) continue;
      const schedule = await CheckinModel.updateSchedule(before.id, { ...people, updatedBy: ctx.userId });
      await unreportedUpcoming(db, before.id, today).update({ ...people, updatedAt: new Date() });
      const newPeople = [people.accountManagerId, people.trainingLeadId].filter((p) => p && p !== before.accountManagerId && p !== before.trainingLeadId && p !== ctx.userId);
      if (newPeople.length) await CheckinNotifications.assigned(schedule, hub.name, newPeople);
    }
  },

  // A login named on a hub (or no longer named on any) gains (or loses) the Account Manager /
  // Training Lead sign-in (account-roles.js's HUB_LEAD_ROLE) — how they reach the hub portal.
  // Admins never take it. Losing it ends their sessions, so a hub-portal session doesn't carry on.
  async syncHubLeadRole(userIds) {
    for (const id of [...new Set(userIds.filter(Boolean))]) {
      const user = await db("users").where({ id }).first();
      if (!user?.email || !canBeHubLead(user)) continue;
      const named = Boolean(await db("learning_hubs").where({ accountManagerId: id }).orWhere({ trainingLeadId: id }).first("id"));
      const extras = extraRolesOf(user);
      const has = extras.includes(HUB_LEAD_ROLE);
      if (named && !has) await db("users").where({ id }).update({ extraRoles: JSON.stringify([...extras, HUB_LEAD_ROLE]), updatedAt: new Date() });
      if (!named && has) {
        await db("users").where({ id }).update({ extraRoles: JSON.stringify(extras.filter((r) => r !== HUB_LEAD_ROLE)), updatedAt: new Date() });
        await UserSessionModel.deleteByUserId(id);
      }
    }
  },

  // ---- Schedules (managers) ----

  async listSchedules(req, { hubId, status } = {}) {
    const ctx = contextOf(req);
    requireManager(ctx);
    const rows = await CheckinModel.listSchedules({ ownerAdminId: ctx.ownerAdminId, hubId, status });
    const [names, hubs] = await Promise.all([peopleNames(rows.flatMap((s) => [s.accountManagerId, s.trainingLeadId])), hubNames(rows.map((s) => s.hubId))]);
    return rows.map((s) => ({
      id: s.id, hubId: s.hubId, hubName: hubs.get(s.hubId) || null, frequency: s.frequency, startDate: s.startDate, endDate: s.endDate,
      format: s.format, status: s.status, accountManagerId: s.accountManagerId, accountManagerName: names.get(s.accountManagerId) || null,
      trainingLeadId: s.trainingLeadId, trainingLeadName: names.get(s.trainingLeadId) || null, createdAt: s.createdAt,
    }));
  },

  async createSchedule(req, data) {
    const ctx = contextOf(req);
    requireManager(ctx);
    const hub = await hubOf(ctx, data.hubId);
    const people = peopleOfHub(hub);
    await assertAssignable(ctx, people);
    const today = todayInKenya();
    let schedule;
    await CheckinModel.transaction(async (trx) => {
      schedule = await CheckinModel.createSchedule({
        ...data, ...people, ownerAdminId: ctx.ownerAdminId, status: "active",
        generateFrom: data.startDate > today ? data.startDate : today,
        createdBy: ctx.userId, updatedBy: ctx.userId,
      }, trx);
      await CheckinModel.insertSessionsIgnoringExisting(sessionRowsFor(schedule, schedule.generateFrom, today), trx);
    });
    await CheckinNotifications.assigned(schedule, hub.name, [schedule.accountManagerId, schedule.trainingLeadId].filter((id) => id !== ctx.userId));
    return (await this.listSchedules(req)).find((s) => s.id === schedule.id);
  },

  async updateSchedule(req, id, data) {
    const ctx = contextOf(req);
    requireManager(ctx);
    const before = await CheckinModel.findSchedule(id);
    if (!before || before.ownerAdminId !== ctx.ownerAdminId) fail("Schedule not found", 404);
    if (before.status !== "active") fail("This schedule has ended — set up a new one instead", 409);
    if (data.hubId !== before.hubId) fail("A schedule stays with its hub — end it and set up a new one for another hub", 409);
    const hub = await hubOf(ctx, data.hubId);
    const people = peopleOfHub(hub);
    await assertAssignable(ctx, people);

    const today = todayInKenya();
    const timingChanged = data.frequency !== before.frequency || data.startDate !== before.startDate;
    let schedule;
    await CheckinModel.transaction(async (trx) => {
      schedule = await CheckinModel.updateSchedule(id, {
        ...data, ...people, updatedBy: ctx.userId,
        ...(timingChanged ? { generateFrom: data.startDate > today ? data.startDate : today } : {}),
      }, trx);
      if (timingChanged) {
        // The upcoming unreported check-ins follow the new pattern.
        await unreportedUpcoming(trx, id, today).del();
        await CheckinModel.insertSessionsIgnoringExisting(sessionRowsFor(schedule, schedule.generateFrom, today), trx);
      } else {
        await unreportedUpcoming(trx, id, today).update({
          format: schedule.format, accountManagerId: schedule.accountManagerId, trainingLeadId: schedule.trainingLeadId, updatedAt: new Date(),
        });
      }
    });
    const newPeople = [schedule.accountManagerId, schedule.trainingLeadId].filter((p) => p && p !== before.accountManagerId && p !== before.trainingLeadId && p !== ctx.userId);
    if (newPeople.length) await CheckinNotifications.assigned(schedule, hub.name, newPeople);
    return (await this.listSchedules(req)).find((s) => s.id === id);
  },

  // Stops a schedule: no more check-ins, and its upcoming unreported ones are removed. Today's and
  // earlier ones, and every report, stay.
  async endSchedule(req, id) {
    const ctx = contextOf(req);
    requireManager(ctx);
    const schedule = await CheckinModel.findSchedule(id);
    if (!schedule || schedule.ownerAdminId !== ctx.ownerAdminId) fail("Schedule not found", 404);
    if (schedule.status !== "active") fail("This schedule has already ended", 409);
    const today = todayInKenya();
    let removed = 0;
    await CheckinModel.transaction(async (trx) => {
      await CheckinModel.updateSchedule(id, { status: "ended", endDate: today < schedule.startDate ? schedule.startDate : today, updatedBy: ctx.userId }, trx);
      removed = await unreportedUpcoming(trx, id, today).del();
    });
    return { ended: true, removedCheckins: removed };
  },

  // ---- Check-ins ----

  async listSessions(req, filters) {
    const ctx = contextOf(req);
    const today = todayInKenya();
    if (ctx.isHub && !(ctx.hubId && ctx.ownerAdminId)) {
      return { sessions: [], total: 0, page: filters.page, limit: filters.limit, counts: { due: 0, upcoming: 0, reported: 0 }, today };
    }
    await keepCurrent(ctx.ownerAdminId);
    let q = CheckinModel.sessionsQuery(ctx.ownerAdminId);

    // The hub itself: its own check-ins, whatever the scope. "mine": the ones I'm on. "all":
    // everything I'm allowed to see (managers: every hub).
    if (ctx.isHub) q = q.where({ hubId: ctx.hubId });
    else if (filters.scope === "mine") q = q.where(mine(ctx));
    else if (!ctx.isManager) {
      const hubs = await assignedHubIds(ctx);
      q = q.where((w) => w.whereIn("hubId", hubs.length ? hubs : ["__none__"]).orWhere(mine(ctx)));
    }
    if (filters.hubId) q = q.where({ hubId: filters.hubId });
    if (filters.staffId) q = q.where((w) => w.where({ accountManagerId: filters.staffId }).orWhere({ trainingLeadId: filters.staffId }));

    const views = {
      due: (x) => x.where({ status: "open" }).where("scheduledDate", "<=", today),
      upcoming: (x) => x.where({ status: "open" }).where("scheduledDate", ">", today),
      reported: (x) => x.where({ status: "reported" }),
      all: (x) => x,
    };
    const counts = {};
    for (const [key, apply] of Object.entries(views)) {
      if (key !== "all") counts[key] = Number((await apply(q.clone()).count({ n: "*" }).first())?.n || 0);
    }
    const listed = views[filters.view](q.clone());
    const total = Number((await listed.clone().count({ n: "*" }).first())?.n || 0);
    const ascending = filters.view === "upcoming";
    const rows = await CheckinModel.findSessions(listed.clone()
      .orderBy("scheduledDate", ascending ? "asc" : "desc")
      .limit(filters.limit).offset((filters.page - 1) * filters.limit));
    return { sessions: await decorateSessions(rows, today), total, page: filters.page, limit: filters.limit, counts, today };
  },

  // The sign-in pop-up: my check-ins whose day has come and whose report isn't in yet.
  async dueForMe(req) {
    const ctx = contextOf(req);
    const owners = await db("checkin_sessions").where(mine(ctx)).distinct("ownerAdminId").pluck("ownerAdminId");
    for (const ownerAdminId of owners) await keepCurrent(ownerAdminId);
    const today = todayInKenya();
    const rows = await CheckinModel.findSessions(db("checkin_sessions")
      .where(mine(ctx)).where({ status: "open" }).where("scheduledDate", "<=", today)
      .orderBy("scheduledDate", "asc").limit(20));
    const sessions = await decorateSessions(rows, today);
    // The hub's logo, for the pop-up's cards.
    const photos = sessions.length ? await db("learning_hubs").whereIn("id", [...new Set(sessions.map((s) => s.hubId))]).select("id", "photo") : [];
    const photoOf = new Map(photos.map((h) => [h.id, h.photo || null]));
    return sessions.map((s) => ({ ...s, hubPhoto: photoOf.get(s.hubId) || null }));
  },

  // One check-in, its report, and the hub's last few reports before it.
  async getSession(req, id) {
    const ctx = contextOf(req);
    if (!ctx.ownerAdminId) fail("Check-in not found", 404);
    await keepCurrent(ctx.ownerAdminId);
    const session = await loadSession(ctx, id);
    const today = todayInKenya();
    const [view] = await decorateSessions([session], today);
    const earlierRows = await CheckinModel.findSessions(CheckinModel.sessionsQuery(ctx.ownerAdminId)
      .where({ hubId: session.hubId, status: "reported" }).whereNot({ id })
      .where("scheduledDate", "<=", session.scheduledDate)
      .orderBy("scheduledDate", "desc").limit(5));
    const earlier = (await decorateSessions(earlierRows, today)).map((s, i) => ({ ...s, report: earlierRows[i].report }));
    const writable = canWriteReport(ctx, session);
    const manageTasks = canManageTasks(ctx, session, today);
    const taskRows = await db("checkin_tasks").where({ sessionId: id }).orderBy([{ column: "dueDate", order: "asc" }, { column: "createdAt", order: "asc" }]);
    const tasks = (await decorateTasks(taskRows, today)).map((t, i) => ({ ...t, canTick: canTickTask(ctx, session, taskRows[i]) }));
    return {
      ...view,
      report: session.report || null,
      earlierReports: earlier,
      tasks,
      taskAssignees: manageTasks ? await taskAssignees(session) : [],
      permissions: {
        // From the check-in's day on; once reported, it can still be corrected.
        canWriteReport: writable && view.state !== "upcoming",
        canManageTasks: manageTasks,
        isManager: ctx.isManager,
      },
    };
  },

  // The tasks from check-ins: "mine" — given to me; "all" (managers) — every hub's.
  async listTasks(req, filters) {
    const ctx = contextOf(req);
    const today = todayInKenya();
    const empty = { tasks: [], total: 0, page: filters.page, limit: filters.limit, counts: { open: 0, done: 0 }, today };
    if (!ctx.ownerAdminId || ctx.isHub) return empty;
    await keepCurrent(ctx.ownerAdminId);
    let q = db("checkin_tasks").where({ ownerAdminId: ctx.ownerAdminId });
    if (filters.scope === "mine" || !ctx.isManager) q = q.where({ assigneeId: ctx.userId });
    const counts = {
      open: Number((await q.clone().where({ status: "open" }).count({ n: "*" }).first())?.n || 0),
      done: Number((await q.clone().where({ status: "done" }).count({ n: "*" }).first())?.n || 0),
    };
    const listed = filters.view === "all" ? q.clone() : q.clone().where({ status: filters.view });
    const total = Number((await listed.clone().count({ n: "*" }).first())?.n || 0);
    const order = filters.view === "done" ? [{ column: "doneAt", order: "desc" }] : [{ column: "dueDate", order: "asc" }, { column: "createdAt", order: "asc" }];
    const rows = await listed.clone().orderBy(order).limit(filters.limit).offset((filters.page - 1) * filters.limit);
    // Here they're mine, or I'm a manager — either way I can tick them.
    const tasks = (await decorateTasks(rows, today)).map((t) => ({ ...t, canTick: true }));
    return { tasks, total, page: filters.page, limit: filters.limit, counts, today };
  },

  async createTask(req, sessionId, data) {
    const ctx = contextOf(req);
    const today = todayInKenya();
    const session = await loadSession(ctx, sessionId);
    if (!canManageTasks(ctx, session, today)) fail("Tasks are set by the check-in's Account Manager or Training Lead, from the day of the check-in", 403);
    await assertTaskFits(session, data);
    const now = new Date();
    const task = {
      id: generateId(), ownerAdminId: session.ownerAdminId, sessionId, hubId: session.hubId,
      title: data.title, assigneeId: data.assigneeId, dueDate: data.dueDate, status: "open",
      createdBy: ctx.userId, updatedBy: ctx.userId, createdAt: now, updatedAt: now,
    };
    await db("checkin_tasks").insert(task);
    if (task.assigneeId !== ctx.userId) {
      const [hubs, names] = await Promise.all([hubNames([session.hubId]), peopleNames([ctx.userId])]);
      await CheckinNotifications.taskAssigned(task, hubs.get(session.hubId) || "a hub", names.get(ctx.userId) || "Someone");
    }
    return this.getSession(req, sessionId);
  },

  async updateTask(req, id, data) {
    const ctx = contextOf(req);
    const today = todayInKenya();
    const { task, session } = await loadTask(ctx, id);
    if (!canManageTasks(ctx, session, today)) fail("Only the check-in's Account Manager or Training Lead can change its tasks", 403);
    await assertTaskFits(session, data);
    await db("checkin_tasks").where({ id }).update({ title: data.title, assigneeId: data.assigneeId, dueDate: data.dueDate, updatedBy: ctx.userId, updatedAt: new Date() });
    if (data.assigneeId !== task.assigneeId && data.assigneeId !== ctx.userId && task.status === "open") {
      const [hubs, names] = await Promise.all([hubNames([session.hubId]), peopleNames([ctx.userId])]);
      await CheckinNotifications.taskAssigned({ ...task, ...data }, hubs.get(session.hubId) || "a hub", names.get(ctx.userId) || "Someone");
    }
    return this.getSession(req, task.sessionId);
  },

  async setTaskStatus(req, id, status) {
    const ctx = contextOf(req);
    const { task, session } = await loadTask(ctx, id);
    if (!canTickTask(ctx, session, task)) fail("Only the person the task is for (or the check-in's Account Manager or Training Lead) can mark it done", 403);
    const done = status === "done";
    await db("checkin_tasks").where({ id }).update({
      status, doneAt: done ? new Date() : null, doneBy: done ? ctx.userId : null, updatedBy: ctx.userId, updatedAt: new Date(),
    });
    const [view] = await decorateTasks([await db("checkin_tasks").where({ id }).first()], todayInKenya());
    return { ...view, canTick: true };
  },

  async deleteTask(req, id) {
    const ctx = contextOf(req);
    const { task, session } = await loadTask(ctx, id);
    if (!canManageTasks(ctx, session, todayInKenya())) fail("Only the check-in's Account Manager or Training Lead can remove its tasks", 403);
    await db("checkin_tasks").where({ id }).del();
    return { deleted: true, sessionId: task.sessionId };
  },

  async saveReport(req, id, report) {
    const ctx = contextOf(req);
    const problems = reportProblems(report);
    if (problems.length) throw Object.assign(new Error(problems[0]), { statusCode: 400, errors: problems.map((message) => ({ message })) });
    const today = todayInKenya();
    await CheckinModel.transaction(async (trx) => {
      const session = await loadSession(ctx, id, { forUpdate: true, connection: trx });
      if (!canWriteReport(ctx, session)) fail("Only the check-in's Account Manager and Training Lead can write its report", 403);
      if (session.scheduledDate > today) fail("This check-in hasn't come round yet — write its report on or after its day", 409);
      const first = session.status !== "reported";
      await CheckinModel.updateSession(id, {
        report, status: "reported", updatedBy: ctx.userId,
        ...(first ? { reportSubmittedAt: new Date(), reportSubmittedBy: ctx.userId } : {}),
      }, trx);
    });
    return this.getSession(req, id);
  },
};

module.exports = CheckinService;
module.exports._internal = { sessionRowsFor, generateAll, sendDueNotices, sendTaskDueNotices };

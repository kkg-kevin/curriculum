const db = require("../../config/db");
const CheckinModel = require("./checkin.model");
const CheckinNotifications = require("./checkin.notifications");
const { contextOf, assignedHubIds, isAssignedTo, workspacePeople } = require("./checkin.access");
const { todayInKenya, addDays, occurrenceDates } = require("./checkin.dates");
const { deriveSessionStatus, nextActionStatus, isActionOverdue, reportProblems } = require("./checkin.rules");
const { GENERATE_AHEAD_DAYS, OPEN_SESSION_STATUSES, OPEN_ACTION_STATUSES } = require("./checkin.constants");

// Hub check-ins — see the 20261022130000 migration for the tables, checkin.access.js for who sees
// what, checkin.rules.js for how statuses move.
//
//   Schedules generate their sessions ahead (GENERATE_AHEAD_DAYS, and always the next one) from
//   `generateFrom` — the day they were set up or their timing last changed — never into the past.
//   Generation is keyed (scheduleId, occurrenceDate) so it can run on every page load and from the
//   cron job without ever making a second copy.
//
//   Editing a schedule only rewrites its upcoming sessions nobody has touched (still "scheduled",
//   no report). A changed frequency or start/end date replaces those with a fresh set; anything
//   else (time, staff, place, agenda) is copied onto them. Ending a schedule cancels its untouched
//   upcoming sessions. Sessions with a report, a reschedule or a past date keep their own record.
//
//   A session completes only by submitting its report. Its issues and follow-up actions are
//   separate records: completing the check-in never resolves or closes them.

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const nameOf = (user) => user?.name || user?.email || "Someone";

async function userName(id) {
  if (!id) return null;
  const user = await db("users").where({ id }).select("name", "email").first();
  return user ? nameOf(user) : null;
}

async function hubOf(ctx, hubId) {
  const hub = await db("learning_hubs").where({ id: hubId, ownerAdminId: ctx.ownerAdminId }).select("id", "name").first();
  if (!hub) fail("Hub not found", 404);
  return hub;
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

const historyEntry = (ctx, event, detail = null) => ({ at: new Date().toISOString(), by: ctx?.userId || null, event, ...(detail ? { detail } : {}) });

// Both people on a schedule must be in this workspace, and able to open Hub check-ins.
async function assertAssignable(ctx, ids) {
  const people = await workspacePeople(ctx.ownerAdminId);
  for (const [label, userId] of ids) {
    const person = people.find((p) => p.id === userId);
    if (!person) fail(`The ${label} must be an admin or staff member of this workspace`);
    if (!person.canUseCheckins) fail(`${person.name}'s role doesn't include Hub check-ins — give their role that permission first (Settings → People & sharing)`);
  }
}

// The sessions a schedule should have from `from` on, as rows ready to insert.
function sessionRowsFor(schedule, from, today) {
  const until = addDays(today, GENERATE_AHEAD_DAYS);
  return occurrenceDates(schedule, until, { from }).map((date) => ({
    ownerAdminId: schedule.ownerAdminId,
    scheduleId: schedule.id,
    hubId: schedule.hubId,
    occurrenceDate: date,
    scheduledDate: date,
    startTime: schedule.startTime,
    durationMinutes: schedule.durationMinutes ?? null,
    format: schedule.format,
    meetingLink: schedule.meetingLink || null,
    venue: schedule.venue || null,
    agenda: schedule.agenda || null,
    accountManagerId: schedule.accountManagerId || null,
    trainingLeadId: schedule.trainingLeadId || null,
    status: "scheduled",
    reportStatus: "none",
    history: [historyEntry(null, "generated")],
  }));
}

// Sessions of a schedule nobody has worked on yet, still ahead: safe to rewrite or remove.
const untouchedUpcoming = (connection, scheduleId, today) => connection("checkin_sessions")
  .where({ scheduleId, status: "scheduled", reportStatus: "none" })
  .where("scheduledDate", ">=", today);

// Brings every open session's status up to date (missed, pending submission …) and sends the
// missed / overdue-report notices for the ones that just changed. Safe to run any time.
async function refreshStatuses(ownerAdminId = null, today = todayInKenya()) {
  let q = db("checkin_sessions").whereIn("status", OPEN_SESSION_STATUSES).where("scheduledDate", "<=", today);
  if (ownerAdminId) q = q.where({ ownerAdminId });
  const sessions = await CheckinModel.findSessions(q);
  const names = await hubNames(sessions.map((s) => s.hubId));
  let changed = 0;
  for (const session of sessions) {
    const next = deriveSessionStatus(session, today);
    if (next === session.status) continue;
    // Only move it if nobody changed it meanwhile.
    const count = await db("checkin_sessions").where({ id: session.id, status: session.status }).update({
      status: next, history: JSON.stringify([...(session.history || []), historyEntry(null, `status:${next}`)]), updatedAt: new Date(),
    });
    if (!count) continue;
    changed += 1;
    const updated = { ...session, status: next };
    if (next === "missed") await CheckinNotifications.missed(updated, names.get(session.hubId) || "a hub");
    if (next === "pending_submission") await CheckinNotifications.reportOverdue(updated, names.get(session.hubId) || "a hub");
  }
  return changed;
}

// Puts every active schedule's upcoming sessions on the calendar.
async function generateAll(ownerAdminId = null, today = todayInKenya()) {
  const schedules = await CheckinModel.activeSchedules(ownerAdminId);
  for (const schedule of schedules) await CheckinModel.insertSessionsIgnoringExisting(sessionRowsFor(schedule, schedule.generateFrom, today));
  return schedules.length;
}

// Day-before and same-day reminders, and overdue follow-ups. Keyed, so repeats send nothing new.
async function sendReminders(ownerAdminId = null, today = todayInKenya()) {
  const tomorrow = addDays(today, 1);
  let q = db("checkin_sessions").whereIn("scheduledDate", [today, tomorrow]).whereIn("status", ["scheduled", "rescheduled", "in_progress"]);
  if (ownerAdminId) q = q.where({ ownerAdminId });
  const sessions = await q;
  let aq = db("checkin_actions").whereIn("status", OPEN_ACTION_STATUSES).whereNotNull("dueDate").where("dueDate", "<", today).whereNotNull("assigneeId");
  if (ownerAdminId) aq = aq.where({ ownerAdminId });
  const actions = await aq;
  const names = await hubNames([...sessions.map((s) => s.hubId), ...actions.map((a) => a.hubId)]);
  for (const s of sessions) {
    if (s.scheduledDate === tomorrow) await CheckinNotifications.upcoming(s, names.get(s.hubId) || "a hub");
    else await CheckinNotifications.today(s, names.get(s.hubId) || "a hub");
  }
  for (const a of actions) await CheckinNotifications.actionOverdue(a, names.get(a.hubId) || "a hub");
  return { sessions: sessions.length, overdueActions: actions.length };
}

// The page-load version of the cron job, for one workspace — at most once every few minutes.
const lastRun = new Map();
async function keepCurrent(ownerAdminId) {
  const last = lastRun.get(ownerAdminId) || 0;
  if (Date.now() - last < 5 * 60 * 1000) return;
  lastRun.set(ownerAdminId, Date.now());
  try {
    await generateAll(ownerAdminId);
    await refreshStatuses(ownerAdminId);
    await sendReminders(ownerAdminId);
  } catch (err) {
    lastRun.delete(ownerAdminId);
    console.error("[checkins] could not bring check-ins up to date:", err.message);
  }
}

// ---- Views ----

function scheduleView(s, names, hubs) {
  return {
    ...s,
    hubName: hubs.get(s.hubId) || null,
    accountManagerName: names.get(s.accountManagerId) || null,
    trainingLeadName: names.get(s.trainingLeadId) || null,
  };
}

function sessionView(s, { names, hubs, frequencies, today, openCounts }) {
  return {
    id: s.id,
    scheduleId: s.scheduleId,
    hubId: s.hubId,
    hubName: hubs.get(s.hubId) || null,
    frequency: frequencies?.get(s.scheduleId) || null,
    occurrenceDate: s.occurrenceDate,
    scheduledDate: s.scheduledDate,
    startTime: s.startTime,
    durationMinutes: s.durationMinutes,
    format: s.format,
    meetingLink: s.meetingLink,
    venue: s.venue,
    agenda: s.agenda,
    accountManagerId: s.accountManagerId,
    accountManagerName: names.get(s.accountManagerId) || null,
    trainingLeadId: s.trainingLeadId,
    trainingLeadName: names.get(s.trainingLeadId) || null,
    status: s.status,
    reportStatus: s.reportStatus,
    overallStatus: s.overallStatus,
    reportSubmittedAt: s.reportSubmittedAt,
    cancelReason: s.cancelReason,
    isToday: s.scheduledDate === today,
    isOverdue: ["missed", "pending_submission"].includes(s.status),
    openActions: openCounts?.get(s.id) || 0,
  };
}

async function decorateSessions(rows, today) {
  const sessions = rows;
  const [names, hubs, schedules, openRows] = await Promise.all([
    peopleNames(sessions.flatMap((s) => [s.accountManagerId, s.trainingLeadId])),
    hubNames(sessions.map((s) => s.hubId)),
    sessions.length ? db("checkin_schedules").whereIn("id", [...new Set(sessions.map((s) => s.scheduleId))]).select("id", "frequency") : [],
    sessions.length ? db("checkin_actions").whereIn("sessionId", sessions.map((s) => s.id)).whereIn("status", OPEN_ACTION_STATUSES).select("sessionId").count({ n: "*" }).groupBy("sessionId") : [],
  ]);
  const frequencies = new Map(schedules.map((s) => [s.id, s.frequency]));
  const openCounts = new Map(openRows.map((r) => [r.sessionId, Number(r.n)]));
  return sessions.map((s) => sessionView(s, { names, hubs, frequencies, today, openCounts }));
}

async function actionViews(rows, today) {
  const [names, hubs, sessions] = await Promise.all([
    peopleNames(rows.flatMap((a) => [a.assigneeId, a.createdBy, a.resolvedBy, a.escalatedBy])),
    hubNames(rows.map((a) => a.hubId)),
    rows.length ? db("checkin_sessions").whereIn("id", [...new Set(rows.map((a) => a.sessionId))]).select("id", "scheduledDate") : [],
  ]);
  const sessionDate = new Map(sessions.map((s) => [s.id, s.scheduledDate]));
  return rows.map((a) => ({
    ...a,
    hubName: hubs.get(a.hubId) || null,
    assigneeName: names.get(a.assigneeId) || null,
    createdByName: names.get(a.createdBy) || null,
    resolvedByName: names.get(a.resolvedBy) || null,
    escalatedByName: names.get(a.escalatedBy) || null,
    sessionDate: sessionDate.get(a.sessionId) || null,
    isOverdue: isActionOverdue(a, today),
  }));
}

// ---- Access to one record ----

async function loadSession(ctx, id, { forUpdate = false, connection = db } = {}) {
  const session = await CheckinModel.findSession(id, connection, forUpdate);
  if (!session || session.ownerAdminId !== ctx.ownerAdminId) fail("Check-in not found", 404);
  if (!ctx.isManager && !isAssignedTo(ctx, session)) {
    const hubs = await assignedHubIds(ctx);
    if (!hubs.includes(session.hubId)) fail("Check-in not found", 404);
  }
  return session;
}

const canWriteReport = (ctx, session) => ctx.isManager || isAssignedTo(ctx, session);

async function loadAction(ctx, id, { forUpdate = false, connection = db } = {}) {
  const action = await CheckinModel.findAction(id, connection, forUpdate);
  if (!action || action.ownerAdminId !== ctx.ownerAdminId) fail("Action not found", 404);
  if (!ctx.isManager && action.assigneeId !== ctx.userId) {
    const hubs = await assignedHubIds(ctx);
    if (!hubs.includes(action.hubId)) fail("Action not found", 404);
  }
  return action;
}

// Who may change an action: a manager, the person it's assigned to, whoever raised it, or the pair
// on the check-in it came from.
async function canChangeAction(ctx, action) {
  if (ctx.isManager || action.assigneeId === ctx.userId || action.createdBy === ctx.userId) return true;
  const session = await CheckinModel.findSession(action.sessionId);
  return Boolean(session && isAssignedTo(ctx, session));
}

async function recordUpdate(ctx, actionId, kind, { fromStatus = null, toStatus = null, note = null } = {}, connection = db) {
  await CheckinModel.addUpdate({ actionId, userId: ctx.userId, userName: await userName(ctx.userId), kind, fromStatus, toStatus, note }, connection);
}

const CheckinService = {
  contextOf,
  keepCurrent,
  generateAll,
  refreshStatuses,
  sendReminders,

  async people(req) {
    const ctx = contextOf(req);
    return workspacePeople(ctx.ownerAdminId);
  },

  // ---- Schedules (managers) ----

  async listSchedules(req, { hubId, status, staffId } = {}) {
    const ctx = contextOf(req);
    const rows = await CheckinModel.listSchedules({ ownerAdminId: ctx.ownerAdminId, hubId, status, staffId });
    const [names, hubs] = await Promise.all([peopleNames(rows.flatMap((s) => [s.accountManagerId, s.trainingLeadId])), hubNames(rows.map((s) => s.hubId))]);
    return rows.map((s) => scheduleView(s, names, hubs));
  },

  async createSchedule(req, data) {
    const ctx = contextOf(req);
    const hub = await hubOf(ctx, data.hubId);
    await assertAssignable(ctx, [["Account Manager", data.accountManagerId], ["Training Lead", data.trainingLeadId]]);
    if (data.accountManagerId === data.trainingLeadId) fail("Choose different people as Account Manager and Training Lead");
    const today = todayInKenya();
    let schedule;
    await CheckinModel.transaction(async (trx) => {
      schedule = await CheckinModel.createSchedule({
        ...data, ownerAdminId: ctx.ownerAdminId, status: "active",
        // A one-off is always created, whatever its date; a recurring one starts no earlier than today.
        generateFrom: data.frequency === "once" || data.startDate > today ? data.startDate : today,
        createdBy: ctx.userId, updatedBy: ctx.userId,
      }, trx);
      await CheckinModel.insertSessionsIgnoringExisting(sessionRowsFor(schedule, schedule.generateFrom, today), trx);
    });
    await CheckinNotifications.assigned(schedule, hub.name, [schedule.accountManagerId, schedule.trainingLeadId].filter((id) => id !== ctx.userId));
    await refreshStatuses(ctx.ownerAdminId);
    return (await this.listSchedules(req)).find((s) => s.id === schedule.id);
  },

  async updateSchedule(req, id, data) {
    const ctx = contextOf(req);
    const before = await CheckinModel.findSchedule(id);
    if (!before || before.ownerAdminId !== ctx.ownerAdminId) fail("Schedule not found", 404);
    if (before.status !== "active") fail("This schedule has ended — set up a new one instead", 409);
    const hub = await hubOf(ctx, data.hubId);
    if (data.hubId !== before.hubId) fail("A schedule stays with its hub — end it and set up a new one for another hub", 409);
    await assertAssignable(ctx, [["Account Manager", data.accountManagerId], ["Training Lead", data.trainingLeadId]]);
    if (data.accountManagerId === data.trainingLeadId) fail("Choose different people as Account Manager and Training Lead");

    const today = todayInKenya();
    const timingChanged = data.frequency !== before.frequency || data.startDate !== before.startDate || (data.endDate || null) !== (before.endDate || null);
    let schedule;
    let replaced = 0;
    let rewritten = 0;
    await CheckinModel.transaction(async (trx) => {
      schedule = await CheckinModel.updateSchedule(id, {
        ...data, endDate: data.endDate || null, updatedBy: ctx.userId,
        ...(timingChanged ? { generateFrom: data.frequency === "once" || data.startDate > today ? data.startDate : today } : {}),
      }, trx);
      if (timingChanged) {
        // The untouched upcoming sessions follow the new pattern; anything worked on stays.
        replaced = await untouchedUpcoming(trx, id, today).del();
        await CheckinModel.insertSessionsIgnoringExisting(sessionRowsFor(schedule, schedule.generateFrom, today), trx);
      } else {
        rewritten = await untouchedUpcoming(trx, id, today).update({
          startTime: schedule.startTime, durationMinutes: schedule.durationMinutes ?? null, format: schedule.format,
          meetingLink: schedule.meetingLink || null, venue: schedule.venue || null, agenda: schedule.agenda || null,
          accountManagerId: schedule.accountManagerId, trainingLeadId: schedule.trainingLeadId, updatedAt: new Date(),
        });
      }
      // A change of people also reaches upcoming sessions that were moved but not yet written up.
      if (before.accountManagerId !== schedule.accountManagerId || before.trainingLeadId !== schedule.trainingLeadId) {
        await trx("checkin_sessions").where({ scheduleId: id, status: "rescheduled", reportStatus: "none" }).where("scheduledDate", ">=", today)
          .update({ accountManagerId: schedule.accountManagerId, trainingLeadId: schedule.trainingLeadId, updatedAt: new Date() });
      }
    });
    const newPeople = [schedule.accountManagerId, schedule.trainingLeadId].filter((p) => p && p !== before.accountManagerId && p !== before.trainingLeadId && p !== ctx.userId);
    if (newPeople.length) await CheckinNotifications.assigned(schedule, hub.name, newPeople);
    const view = (await this.listSchedules(req)).find((s) => s.id === id);
    return { ...view, replacedSessions: replaced, updatedSessions: rewritten };
  },

  // Stops a schedule: no more sessions, and its untouched upcoming ones are cancelled. Sessions
  // already worked on, and every report, stay.
  async endSchedule(req, id, { reason }) {
    const ctx = contextOf(req);
    const schedule = await CheckinModel.findSchedule(id);
    if (!schedule || schedule.ownerAdminId !== ctx.ownerAdminId) fail("Schedule not found", 404);
    if (schedule.status !== "active") fail("This schedule has already ended", 409);
    const today = todayInKenya();
    let cancelled = 0;
    await CheckinModel.transaction(async (trx) => {
      await CheckinModel.updateSchedule(id, { status: "ended", endDate: today < schedule.startDate ? schedule.startDate : today, updatedBy: ctx.userId }, trx);
      const upcoming = await trx("checkin_sessions").where({ scheduleId: id, reportStatus: "none" }).whereIn("status", ["scheduled", "rescheduled"]).where("scheduledDate", ">", today);
      for (const s of upcoming) {
        const history = typeof s.history === "string" ? JSON.parse(s.history || "[]") : s.history || [];
        await trx("checkin_sessions").where({ id: s.id }).update({
          status: "cancelled", cancelReason: (reason || "The schedule was ended").slice(0, 255),
          history: JSON.stringify([...history, historyEntry(ctx, "cancelled", "Schedule ended")]), updatedBy: ctx.userId, updatedAt: new Date(),
        });
        cancelled += 1;
      }
    });
    return { ended: true, cancelledSessions: cancelled };
  },

  // ---- Sessions ----

  async listSessions(req, filters) {
    const ctx = contextOf(req);
    await keepCurrent(ctx.ownerAdminId);
    const today = todayInKenya();
    let q = CheckinModel.sessionsQuery(ctx.ownerAdminId);

    // "mine": the ones I'm on. "all": everything I'm allowed to see (managers: every hub).
    if (filters.scope === "mine" || !ctx.isManager) {
      if (filters.scope === "mine") q = q.where((w) => w.where({ accountManagerId: ctx.userId }).orWhere({ trainingLeadId: ctx.userId }));
      else {
        const hubs = await assignedHubIds(ctx);
        q = q.where((w) => w.whereIn("hubId", hubs.length ? hubs : ["__none__"]).orWhere({ accountManagerId: ctx.userId }).orWhere({ trainingLeadId: ctx.userId }));
      }
    }
    if (filters.hubId) q = q.where({ hubId: filters.hubId });
    if (filters.staffId) q = q.where((w) => w.where({ accountManagerId: filters.staffId }).orWhere({ trainingLeadId: filters.staffId }));
    if (filters.status) q = q.where({ status: filters.status });
    if (filters.from) q = q.where("scheduledDate", ">=", filters.from);
    if (filters.to) q = q.where("scheduledDate", "<=", filters.to);
    if (filters.frequency) q = q.whereIn("scheduleId", db("checkin_schedules").where({ ownerAdminId: ctx.ownerAdminId, frequency: filters.frequency }).select("id"));

    const view = filters.view;
    if (view === "upcoming") q = q.whereIn("status", ["scheduled", "rescheduled", "in_progress"]).where("scheduledDate", ">", today);
    if (view === "today") q = q.where("scheduledDate", today).whereNot({ status: "cancelled" });
    if (view === "pending") q = q.whereIn("status", ["in_progress", "pending_submission"]);
    if (view === "overdue") q = q.whereIn("status", ["missed", "pending_submission"]);
    if (view === "completed") q = q.where({ status: "completed" });
    if (view === "rescheduled") q = q.where({ status: "rescheduled" });
    if (view === "cancelled") q = q.where({ status: "cancelled" });

    const total = Number((await q.clone().count({ n: "*" }).first())?.n || 0);
    const ascending = ["upcoming", "today", "pending", "overdue", "rescheduled"].includes(view);
    const rows = await CheckinModel.findSessions(q.clone()
      .orderBy("scheduledDate", ascending ? "asc" : "desc").orderBy("startTime", "asc")
      .limit(filters.limit).offset((filters.page - 1) * filters.limit));

    // Counts for the My Check-ins tabs, in the same scope.
    const base = CheckinModel.sessionsQuery(ctx.ownerAdminId).where((w) => w.where({ accountManagerId: ctx.userId }).orWhere({ trainingLeadId: ctx.userId }));
    const counts = filters.scope === "mine" ? {
      upcoming: Number((await base.clone().whereIn("status", ["scheduled", "rescheduled", "in_progress"]).where("scheduledDate", ">", today).count({ n: "*" }).first()).n),
      today: Number((await base.clone().where("scheduledDate", today).whereNot({ status: "cancelled" }).count({ n: "*" }).first()).n),
      pending: Number((await base.clone().whereIn("status", ["in_progress", "pending_submission"]).count({ n: "*" }).first()).n),
      overdue: Number((await base.clone().whereIn("status", ["missed", "pending_submission"]).count({ n: "*" }).first()).n),
      rescheduled: Number((await base.clone().where({ status: "rescheduled" }).count({ n: "*" }).first()).n),
    } : null;

    return { sessions: await decorateSessions(rows, today), total, page: filters.page, limit: filters.limit, counts, today };
  },

  async getSession(req, id) {
    const ctx = contextOf(req);
    await keepCurrent(ctx.ownerAdminId);
    const session = await loadSession(ctx, id);
    const today = todayInKenya();
    const [view] = await decorateSessions([session], today);
    const schedule = await CheckinModel.findSchedule(session.scheduleId);
    const actions = await actionViews(await CheckinModel.findActionsForSession(id), today);
    // Unresolved actions from this hub's earlier check-ins — to follow up on in this one.
    const earlier = await actionViews(await db("checkin_actions")
      .where({ ownerAdminId: ctx.ownerAdminId, hubId: session.hubId }).whereNot({ sessionId: id })
      .whereIn("status", OPEN_ACTION_STATUSES).orderBy("dueDate", "asc").limit(50), today);
    const historyNames = await peopleNames((session.history || []).map((h) => h.by));
    const writable = canWriteReport(ctx, session);
    return {
      ...view,
      report: session.report || null,
      schedule: schedule ? { id: schedule.id, frequency: schedule.frequency, status: schedule.status, startDate: schedule.startDate, endDate: schedule.endDate } : null,
      history: (session.history || []).map((h) => ({ ...h, byName: historyNames.get(h.by) || null })),
      actions,
      earlierOpenActions: earlier,
      reportSubmittedByName: await userName(session.reportSubmittedBy),
      permissions: {
        canWriteReport: writable && !["completed", "cancelled"].includes(session.status),
        canSubmit: writable && !["completed", "cancelled"].includes(session.status),
        canReschedule: writable && !["completed", "cancelled"].includes(session.status),
        canAddActions: writable && session.status !== "cancelled",
        canCancel: ctx.isManager && !["completed", "cancelled"].includes(session.status),
        canReopen: ctx.isManager && session.status === "completed",
        isManager: ctx.isManager,
      },
    };
  },

  async saveReport(req, id, report) {
    const ctx = contextOf(req);
    const today = todayInKenya();
    await CheckinModel.transaction(async (trx) => {
      const session = await loadSession(ctx, id, { forUpdate: true, connection: trx });
      if (!canWriteReport(ctx, session)) fail("Only the check-in's Account Manager and Training Lead can write its report", 403);
      if (session.status === "cancelled") fail("This check-in was cancelled", 409);
      if (session.reportStatus === "submitted") fail("This report is submitted. A manager can reopen it if it needs changing.", 409);
      const started = session.reportStatus === "none";
      const next = { ...session, reportStatus: "draft" };
      await CheckinModel.updateSession(id, {
        report, reportStatus: "draft", status: deriveSessionStatus(next, today), updatedBy: ctx.userId,
        ...(started ? { history: [...(session.history || []), historyEntry(ctx, "report_started")] } : {}),
      }, trx);
    });
    return this.getSession(req, id);
  },

  async submitReport(req, id) {
    const ctx = contextOf(req);
    let submitted;
    await CheckinModel.transaction(async (trx) => {
      const session = await loadSession(ctx, id, { forUpdate: true, connection: trx });
      if (!canWriteReport(ctx, session)) fail("Only the check-in's Account Manager and Training Lead can submit its report", 403);
      if (session.status === "cancelled") fail("This check-in was cancelled", 409);
      if (session.reportStatus === "submitted") fail("This report is already submitted", 409);
      const actions = await trx("checkin_actions").where({ sessionId: id });
      const problems = reportProblems(session.report, actions);
      if (problems.length) throw Object.assign(new Error(problems[0]), { statusCode: 400, errors: problems.map((message) => ({ message })) });
      submitted = await CheckinModel.updateSession(id, {
        reportStatus: "submitted", status: "completed", overallStatus: session.report.summary.overallStatus,
        reportSubmittedAt: new Date(), reportSubmittedBy: ctx.userId, updatedBy: ctx.userId,
        history: [...(session.history || []), historyEntry(ctx, "report_submitted")],
      }, trx);
    });
    if (["needs_attention", "critical"].includes(submitted.overallStatus)) {
      const hub = await db("learning_hubs").where({ id: submitted.hubId }).select("name").first();
      await CheckinNotifications.hubFlagged(submitted, hub?.name || "a hub");
    }
    return this.getSession(req, id);
  },

  // A manager sends a submitted report back to draft so it can be corrected; the change is recorded.
  async reopenReport(req, id, { reason }) {
    const ctx = contextOf(req);
    if (!ctx.isManager) fail("Only a manager can reopen a report", 403);
    const today = todayInKenya();
    await CheckinModel.transaction(async (trx) => {
      const session = await loadSession(ctx, id, { forUpdate: true, connection: trx });
      if (session.status !== "completed") fail("Only a completed check-in's report can be reopened", 409);
      await CheckinModel.updateSession(id, {
        reportStatus: "draft", status: deriveSessionStatus({ ...session, reportStatus: "draft" }, today), overallStatus: null,
        reportSubmittedAt: null, reportSubmittedBy: null, updatedBy: ctx.userId,
        history: [...(session.history || []), historyEntry(ctx, "report_reopened", reason)],
      }, trx);
    });
    return this.getSession(req, id);
  },

  async rescheduleSession(req, id, { date, startTime, reason }) {
    const ctx = contextOf(req);
    const today = todayInKenya();
    if (date < today) fail("Choose today or a later date");
    let updated;
    await CheckinModel.transaction(async (trx) => {
      const session = await loadSession(ctx, id, { forUpdate: true, connection: trx });
      if (!canWriteReport(ctx, session)) fail("Only the check-in's Account Manager, Training Lead or a manager can move it", 403);
      if (["completed", "cancelled"].includes(session.status)) fail(`A ${session.status} check-in can't be moved`, 409);
      const status = session.reportStatus === "draft" ? deriveSessionStatus({ ...session, scheduledDate: date }, today) : "rescheduled";
      updated = await CheckinModel.updateSession(id, {
        scheduledDate: date, startTime, status, updatedBy: ctx.userId,
        history: [...(session.history || []), historyEntry(ctx, "rescheduled", `${session.scheduledDate} ${session.startTime} → ${date} ${startTime}: ${reason}`)],
      }, trx);
    });
    const hub = await db("learning_hubs").where({ id: updated.hubId }).select("name").first();
    await CheckinNotifications.rescheduled(updated, hub?.name || "a hub", ctx.userId);
    return this.getSession(req, id);
  },

  async cancelSession(req, id, { reason }) {
    const ctx = contextOf(req);
    if (!ctx.isManager) fail("Only a manager can cancel a check-in", 403);
    let updated;
    await CheckinModel.transaction(async (trx) => {
      const session = await loadSession(ctx, id, { forUpdate: true, connection: trx });
      if (["completed", "cancelled"].includes(session.status)) fail(`This check-in is already ${session.status}`, 409);
      updated = await CheckinModel.updateSession(id, {
        status: "cancelled", cancelReason: reason, updatedBy: ctx.userId,
        history: [...(session.history || []), historyEntry(ctx, "cancelled", reason)],
      }, trx);
    });
    const hub = await db("learning_hubs").where({ id: updated.hubId }).select("name").first();
    await CheckinNotifications.cancelled(updated, hub?.name || "a hub", ctx.userId);
    return this.getSession(req, id);
  },

  // ---- Issues and actions ----

  async listActions(req, filters) {
    const ctx = contextOf(req);
    const today = todayInKenya();
    let q = CheckinModel.actionsQuery(ctx.ownerAdminId);
    if (filters.scope === "mine") q = q.where({ assigneeId: ctx.userId });
    else if (!ctx.isManager) {
      const hubs = await assignedHubIds(ctx);
      q = q.where((w) => w.whereIn("hubId", hubs.length ? hubs : ["__none__"]).orWhere({ assigneeId: ctx.userId }));
    }
    if (filters.status === "outstanding") q = q.whereIn("status", OPEN_ACTION_STATUSES);
    else if (filters.status) q = q.where({ status: filters.status });
    if (filters.hubId) q = q.where({ hubId: filters.hubId });
    if (filters.assigneeId) q = q.where({ assigneeId: filters.assigneeId });
    if (filters.sessionId) q = q.where({ sessionId: filters.sessionId });
    if (filters.category) q = q.where({ category: filters.category });
    if (filters.overdue === "true") q = q.whereIn("status", OPEN_ACTION_STATUSES).whereNotNull("dueDate").where("dueDate", "<", today);
    if (filters.escalated === "true") q = q.whereNotNull("escalatedAt");
    const total = Number((await q.clone().count({ n: "*" }).first())?.n || 0);
    const rows = await q.clone()
      .orderByRaw("FIELD(status, 'open', 'assigned', 'in_progress', 'resolved', 'closed')")
      .orderByRaw("FIELD(priority, 'critical', 'high', 'medium', 'low')")
      .orderBy("dueDate", "asc")
      .limit(filters.limit).offset((filters.page - 1) * filters.limit);
    return { actions: await actionViews(rows, today), total, page: filters.page, limit: filters.limit, today };
  },

  async getAction(req, id) {
    const ctx = contextOf(req);
    const action = await loadAction(ctx, id);
    const today = todayInKenya();
    const [view] = await actionViews([action], today);
    const updates = await CheckinModel.findUpdates(id);
    const session = await CheckinModel.findSession(action.sessionId);
    return {
      ...view,
      updates,
      session: session ? { id: session.id, scheduledDate: session.scheduledDate, status: session.status } : null,
      permissions: { canChange: await canChangeAction(ctx, action), isManager: ctx.isManager },
    };
  },

  async createAction(req, sessionId, data) {
    const ctx = contextOf(req);
    let action;
    await CheckinModel.transaction(async (trx) => {
      const session = await loadSession(ctx, sessionId, { connection: trx });
      if (!canWriteReport(ctx, session)) fail("Only the check-in's Account Manager, Training Lead or a manager can add to it", 403);
      if (session.status === "cancelled") fail("This check-in was cancelled", 409);
      if (data.assigneeId) await assertPerson(ctx, data.assigneeId);
      action = await CheckinModel.createAction({
        ...data, ownerAdminId: ctx.ownerAdminId, hubId: session.hubId, sessionId,
        status: data.assigneeId ? "assigned" : "open", createdBy: ctx.userId,
      }, trx);
      await recordUpdate(ctx, action.id, "created", { toStatus: action.status }, trx);
    });
    const hub = await db("learning_hubs").where({ id: action.hubId }).select("name").first();
    await CheckinNotifications.actionAssigned(action, hub?.name || "a hub", ctx.userId);
    return this.getAction(req, action.id);
  },

  async updateAction(req, id, data) {
    const ctx = contextOf(req);
    let before;
    let after;
    await CheckinModel.transaction(async (trx) => {
      before = await loadAction(ctx, id, { forUpdate: true, connection: trx });
      if (!(await canChangeAction(ctx, before))) fail("You can't change this action", 403);
      if (["resolved", "closed"].includes(before.status)) fail("Reopen this action before changing it", 409);
      if (data.assigneeId && data.assigneeId !== before.assigneeId) await assertPerson(ctx, data.assigneeId);
      const patch = { ...data };
      if (data.assigneeId !== undefined && data.assigneeId !== before.assigneeId) {
        patch.status = data.assigneeId ? (before.status === "open" ? "assigned" : before.status) : "open";
      }
      after = await CheckinModel.updateAction(id, patch, trx);
      const changes = Object.keys(data).filter((k) => String(data[k] ?? "") !== String(before[k] ?? ""));
      if (changes.includes("assigneeId")) await recordUpdate(ctx, id, "assigned", { fromStatus: before.status, toStatus: after.status, note: (await userName(after.assigneeId)) || "Nobody" }, trx);
      const others = changes.filter((k) => k !== "assigneeId");
      if (others.length) await recordUpdate(ctx, id, "edited", { note: `Changed: ${others.join(", ")}` }, trx);
    });
    if (after.assigneeId && after.assigneeId !== before.assigneeId) {
      const hub = await db("learning_hubs").where({ id: after.hubId }).select("name").first();
      await CheckinNotifications.actionAssigned(after, hub?.name || "a hub", ctx.userId);
    }
    return this.getAction(req, id);
  },

  async setActionStatus(req, id, { status, note, resolutionNotes }) {
    const ctx = contextOf(req);
    await CheckinModel.transaction(async (trx) => {
      const action = await loadAction(ctx, id, { forUpdate: true, connection: trx });
      if (!(await canChangeAction(ctx, action))) fail("You can't change this action", 403);
      const result = nextActionStatus(action, status, { resolutionNotes, isManager: ctx.isManager });
      if (result.error) fail(result.error, 409);
      const patch = { status: result.status };
      if (result.status === "resolved") Object.assign(patch, { resolvedAt: new Date(), resolvedBy: ctx.userId, resolutionNotes: resolutionNotes || action.resolutionNotes });
      if (result.status === "closed") patch.closedAt = new Date();
      if (["open", "assigned", "in_progress"].includes(result.status) && ["resolved", "closed"].includes(action.status)) Object.assign(patch, { resolvedAt: null, resolvedBy: null, closedAt: null });
      await CheckinModel.updateAction(id, patch, trx);
      await recordUpdate(ctx, id, "status", { fromStatus: action.status, toStatus: result.status, note: note || (result.status === "resolved" ? resolutionNotes : null) }, trx);
    });
    return this.getAction(req, id);
  },

  async addActionNote(req, id, { note }) {
    const ctx = contextOf(req);
    const action = await loadAction(ctx, id);
    if (!(await canChangeAction(ctx, action))) fail("You can't add notes to this action", 403);
    await recordUpdate(ctx, id, "note", { note });
    await CheckinModel.updateAction(id, {});
    return this.getAction(req, id);
  },

  async escalateAction(req, id, { note }) {
    const ctx = contextOf(req);
    let escalated;
    await CheckinModel.transaction(async (trx) => {
      const action = await loadAction(ctx, id, { forUpdate: true, connection: trx });
      if (!OPEN_ACTION_STATUSES.includes(action.status)) fail("Only an outstanding action can be escalated", 409);
      escalated = await CheckinModel.updateAction(id, { escalatedAt: new Date(), escalatedBy: ctx.userId, escalationNote: note, ...(action.priority !== "critical" ? { priority: action.priority === "high" ? "critical" : "high" } : {}) }, trx);
      await recordUpdate(ctx, id, "escalated", { note }, trx);
    });
    const hub = await db("learning_hubs").where({ id: escalated.hubId }).select("name").first();
    await CheckinNotifications.escalated(escalated, hub?.name || "a hub", ctx.userId);
    return this.getAction(req, id);
  },

  // Taking back an item added by mistake — only while its check-in's report is still a draft, by
  // whoever added it or a manager. After that it stays, and is closed instead.
  async deleteAction(req, id) {
    const ctx = contextOf(req);
    await CheckinModel.transaction(async (trx) => {
      const action = await loadAction(ctx, id, { forUpdate: true, connection: trx });
      if (!ctx.isManager && action.createdBy !== ctx.userId) fail("Only whoever added it, or a manager, can remove it", 403);
      const session = await CheckinModel.findSession(action.sessionId, trx);
      if (session?.reportStatus === "submitted") fail("Its check-in's report is submitted — close the action instead", 409);
      await CheckinModel.deleteUpdates(id, trx);
      await CheckinModel.deleteAction(id, trx);
    });
    return { deleted: true };
  },

  // ---- Overview (managers) ----

  async overview(req, filters) {
    const ctx = contextOf(req);
    if (!ctx.isManager) fail("The overview is for check-in managers", 403);
    await keepCurrent(ctx.ownerAdminId);
    const today = todayInKenya();
    const from = filters.from || addDays(today, -30);
    const to = filters.to || addDays(today, 30);

    const scoped = () => {
      let q = CheckinModel.sessionsQuery(ctx.ownerAdminId);
      if (filters.hubId) q = q.where({ hubId: filters.hubId });
      if (filters.staffId) q = q.where((w) => w.where({ accountManagerId: filters.staffId }).orWhere({ trainingLeadId: filters.staffId }));
      if (filters.frequency) q = q.whereIn("scheduleId", db("checkin_schedules").where({ ownerAdminId: ctx.ownerAdminId, frequency: filters.frequency }).select("id"));
      if (filters.status) q = q.where({ status: filters.status });
      return q;
    };
    const inPeriod = () => scoped().where("scheduledDate", ">=", from).where("scheduledDate", "<=", to);
    const count = async (q) => Number((await q.count({ n: "*" }).first())?.n || 0);
    const actionsScoped = () => {
      let q = CheckinModel.actionsQuery(ctx.ownerAdminId);
      if (filters.hubId) q = q.where({ hubId: filters.hubId });
      if (filters.staffId) q = q.where({ assigneeId: filters.staffId });
      return q;
    };

    const [scheduled, completed, pending, missed, openIssues, overdueActions] = await Promise.all([
      count(inPeriod().whereNot({ status: "cancelled" })),
      count(inPeriod().where({ status: "completed" })),
      count(inPeriod().whereIn("status", ["in_progress", "pending_submission"])),
      count(inPeriod().where({ status: "missed" })),
      count(actionsScoped().whereIn("status", OPEN_ACTION_STATUSES)),
      count(actionsScoped().whereIn("status", OPEN_ACTION_STATUSES).whereNotNull("dueDate").where("dueDate", "<", today)),
    ]);

    const upcoming = await decorateSessions(await CheckinModel.findSessions(scoped().whereIn("status", ["scheduled", "rescheduled", "in_progress"]).where("scheduledDate", ">=", today).orderBy("scheduledDate", "asc").orderBy("startTime", "asc").limit(15)), today);
    const attention = await decorateSessions(await CheckinModel.findSessions(scoped().whereIn("status", ["missed", "pending_submission", "rescheduled"]).orderBy("scheduledDate", "asc").limit(20)), today);
    const recentReports = await decorateSessions(await CheckinModel.findSessions(scoped().where({ status: "completed" }).orderBy("reportSubmittedAt", "desc").limit(10)), today);

    // Each hub's latest submitted report, where it flagged the hub.
    const latest = await CheckinModel.findSessions(CheckinModel.sessionsQuery(ctx.ownerAdminId).where({ status: "completed" }).whereNotNull("overallStatus").orderBy("reportSubmittedAt", "desc").limit(500));
    const seen = new Set();
    const flagged = [];
    for (const s of latest) {
      if (seen.has(s.hubId)) continue;
      seen.add(s.hubId);
      if (["needs_attention", "critical"].includes(s.overallStatus) && (!filters.hubId || s.hubId === filters.hubId)) flagged.push(s);
    }
    const flaggedHubs = await decorateSessions(flagged.sort((a, b) => (a.overallStatus === "critical" ? -1 : 1) - (b.overallStatus === "critical" ? -1 : 1)), today);

    const outstanding = await actionViews(await actionsScoped().whereIn("status", OPEN_ACTION_STATUSES)
      .orderByRaw("FIELD(priority, 'critical', 'high', 'medium', 'low')").orderBy("dueDate", "asc").limit(20), today);
    const overdue = await actionViews(await actionsScoped().whereIn("status", OPEN_ACTION_STATUSES).whereNotNull("dueDate").where("dueDate", "<", today).orderBy("dueDate", "asc").limit(20), today);
    const escalations = await actionViews(await actionsScoped().whereNotNull("escalatedAt").orderBy("escalatedAt", "desc").limit(10), today);

    return {
      period: { from, to },
      today,
      indicators: { scheduled, completed, pending, missed, openIssues, overdueActions },
      upcoming, attention, recentReports, flaggedHubs, outstanding, overdue, escalations,
    };
  },

  async hubs(req) {
    const ctx = contextOf(req);
    let q = db("learning_hubs").where({ ownerAdminId: ctx.ownerAdminId }).select("id", "name", "hubType").orderBy("name", "asc");
    if (!ctx.isManager) {
      const ids = await assignedHubIds(ctx);
      q = q.whereIn("id", ids.length ? ids : ["__none__"]);
    }
    return q;
  },
};

async function assertPerson(ctx, userId) {
  const people = await workspacePeople(ctx.ownerAdminId);
  if (!people.some((p) => p.id === userId)) fail("Assign it to an admin or staff member of this workspace");
}

module.exports = CheckinService;
module.exports._internal = { sessionRowsFor, refreshStatuses, generateAll, sendReminders };

const crypto = require("crypto");
const db = require("../../config/db");
const { contextOf, canSeeRound, meetingAccess } = require("./mentor-checkin.access");
const Notify = require("./mentor-checkin.notifications");
const R = require("./mentor-checkin.rules");
const { todayInKenya, addDays } = require("../checkins/checkin.dates");
// Templates and their answers follow quality assurance's rules exactly (as hub check-ins do).
const { normaliseTemplate, templateProblems, scoreReview, cleanAnswers } = require("../qa/qa.rules");
const { DEFAULT_SCALE } = require("../qa/qa.constants");
const UsageService = require("../usage/usage.service");
const { rolesOf } = require("../auth/account-roles");
const { createRecord, updateRecord, stringifyJsonFields, generateId } = require("../../shared/utils/model.utils");

// Parent–mentor check-ins (10 Nov 2026) — see the 20261110090000 migration for the tables and
// mentor-checkin.access.js for who sees what.
//
//   An admin (or staff with "mentor-checkins") sets up a ROUND for one class: the hub and class,
//   whose educators all attend; online (with the link) or in person (with the place); a template
//   (optional); and a window — dates, weekdays, hours, meeting length, gap. The families are the
//   parent logins of the class's learners (siblings in the class share one meeting; learners whose
//   parent has no login are left out and listed). The draw (preview) shuffles the families onto
//   free times — never a time the educators teach (their timetable) or have another check-in, never
//   sooner than R.MIN_NOTICE_DAYS away; the admin can draw again or swap times, then publishes.
//   Publishing tells each family their time and the educators the schedule. The admin doesn't
//   attend.
//
//   A family then confirms, or picks another free time of the round (from tomorrow on) — the
//   UNIQUE (roundId, slotKey) means two families can never hold one time. The pop-up shows a coming
//   check-in from R.POPUP_DAYS before it. After it, any of the round's educators writes the report
//   (template answers + "how the child is doing" + "what was agreed"), or marks it missed; the
//   parent reads the report and approves it, which closes it.

const fail = (message, statusCode = 400, extra = {}) => { throw Object.assign(new Error(message), { statusCode, ...extra }); };
const TEMPLATES = "mentor_checkin_templates";
const ROUNDS = "mentor_checkin_rounds";
const MEETINGS = "mentor_checkin_meetings";
const MEETING_JSON = ["learnerIds", "template", "answers", "sectionScores", "report"];

const parseJson = (value, fallback) => {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
};
const shapeRound = (row) => (row ? { ...row, educatorIds: parseJson(row.educatorIds, []), days: parseJson(row.days, []) } : row);
const shapeMeeting = (row) => (row ? {
  ...row,
  learnerIds: parseJson(row.learnerIds, []),
  template: parseJson(row.template, null),
  answers: parseJson(row.answers, {}),
  sectionScores: parseJson(row.sectionScores, []),
  report: parseJson(row.report, null),
  score: row.score == null ? null : Number(row.score),
} : row);
const shapeTemplate = (row) => (row ? { ...row, scale: parseJson(row.scale, []), sections: parseJson(row.sections, []) } : row);

const lower = (v) => String(v || "").trim().toLowerCase();
const personName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
const classLabel = (cls) => [cls?.gradeName, cls?.streamName].filter(Boolean).join(" ").trim() || "Class";
const isDuplicate = (err) => err?.code === "ER_DUP_ENTRY" || /duplicate/i.test(err?.message || "");
const randomInt = (n) => crypto.randomInt(n);
// Rounds with any of these educators (educatorIds is a JSON array of teacher ids).
const withEducators = (q, teacherIds) => (teacherIds.length
  ? q.where((w) => teacherIds.forEach((id) => w.orWhereRaw("JSON_CONTAINS(educatorIds, JSON_QUOTE(?))", [id])))
  : q.whereRaw("1 = 0"));

async function ctxOf(req) {
  const ctx = await contextOf(req);
  if (!ctx) fail("You do not have permission to perform this action", 403);
  return ctx;
}
const requireManager = (ctx, { manage = false } = {}) => {
  if (ctx.kind !== "manager") fail("Only an admin can do that", 403);
  if (manage && !ctx.canManage) fail("Your role can see parent check-ins but not set them up", 403);
};

// ---- Names ------------------------------------------------------------------------------------

async function mapBy(table, ids, columns, key = "id") {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await db(table).whereIn(key, unique).select(columns);
  return new Map(rows.map((r) => [r[key], r]));
}
async function teacherNames(ids) {
  const rows = await mapBy("teachers", ids, ["id", "firstName", "lastName", "email"]);
  return new Map([...rows].map(([id, t]) => [id, personName(t) || t.email || "Educator"]));
}
async function userNames(ids) {
  const rows = await mapBy("users", ids, ["id", "name", "email"]);
  return new Map([...rows].map(([id, u]) => [id, u.name || u.email || "Parent"]));
}
async function learnerNames(ids) {
  const rows = await mapBy("learners", ids, ["id", "firstName", "lastName"]);
  return new Map([...rows].map(([id, l]) => [id, { full: personName(l) || "Learner", first: l.firstName || personName(l) || "Learner" }]));
}

// The logins of these educators (by their educator record's email), for notifications.
async function educatorUserIds(teacherIds) {
  const teachers = await mapBy("teachers", teacherIds, ["id", "email"]);
  const emails = [...new Set([...teachers.values()].map((t) => lower(t.email)).filter(Boolean))];
  if (!emails.length) return [];
  const users = await db("users").whereIn(db.raw("LOWER(email)"), emails).whereNull("deactivatedAt").select("id", "role", "extraRoles");
  return users.filter((u) => rolesOf(u).includes("teacher")).map((u) => u.id);
}

// ---- A class's people ---------------------------------------------------------------------------

async function loadClass(ownerAdminId, classId) {
  const cls = await db("classes").where({ id: classId }).first();
  if (!cls) fail("Class not found", 404);
  const hub = await db("learning_hubs").where({ id: cls.schoolId, ownerAdminId }).first("id", "name");
  if (!hub) fail("Class not found", 404);
  return { cls, hub };
}

// The class's educators (all of them attend) and its families: each parent login with their
// children in the class; and the learners left out because their parent has no login.
async function classPeople(ownerAdminId, classId) {
  const { cls, hub } = await loadClass(ownerAdminId, classId);
  const teacherIds = await db("class_course_teacher_links").where({ classId }).distinct("teacherId").pluck("teacherId");
  const teachers = teacherIds.length ? await db("teachers").whereIn("id", teacherIds).select("id", "firstName", "lastName", "email", "status") : [];
  const activeTeachers = teachers.filter((t) => (t.status || "active") !== "inactive");
  const teacherEmails = activeTeachers.map((t) => lower(t.email)).filter(Boolean);
  const teacherLogins = teacherEmails.length ? await db("users").whereIn(db.raw("LOWER(email)"), teacherEmails).whereNull("deactivatedAt").select("email", "role", "extraRoles") : [];
  const withLogin = new Set(teacherLogins.filter((u) => rolesOf(u).includes("teacher")).map((u) => lower(u.email)));
  const educators = activeTeachers
    .map((t) => ({ id: t.id, name: personName(t) || t.email || "Educator", hasLogin: withLogin.has(lower(t.email)) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const learners = await db("learners")
    .whereIn("id", db("learner_hub_links").where({ classId, status: "active" }).select("learnerId"))
    .whereNull("teacherId")
    .select("id", "firstName", "lastName", "guardianEmail", "guardianName");
  const emails = [...new Set(learners.map((l) => lower(l.guardianEmail)).filter(Boolean))];
  const parentUsers = emails.length
    ? (await db("users").whereIn(db.raw("LOWER(email)"), emails).whereNull("username").whereNull("deactivatedAt").select("id", "name", "email", "role", "extraRoles"))
      .filter((u) => rolesOf(u).includes("learner"))
    : [];
  const parentByEmail = new Map(parentUsers.map((u) => [lower(u.email), u]));
  const families = new Map();
  const withoutLogin = [];
  for (const l of learners.sort((a, b) => personName(a).localeCompare(personName(b)))) {
    const parent = parentByEmail.get(lower(l.guardianEmail));
    const learner = { id: l.id, name: personName(l) || "Learner" };
    if (!parent) {
      withoutLogin.push({ ...learner, guardianName: l.guardianName || null, reason: l.guardianEmail ? "Their parent hasn't got a login" : "No parent email on their record" });
      continue;
    }
    const family = families.get(parent.id) || { parentUserId: parent.id, parentName: parent.name || l.guardianName || parent.email, parentEmail: parent.email, learners: [] };
    family.learners.push(learner);
    families.set(parent.id, family);
  }
  return {
    cls, hub, className: classLabel(cls), educators,
    families: [...families.values()].sort((a, b) => a.parentName.localeCompare(b.parentName)),
    withoutLogin,
  };
}

// When these educators are busy between two dates: their classes on the weekly timetable (and the
// class's own timetable), and their other check-ins still on.
async function busyFor(teacherIds, from, to, { classId = null, excludeMeetingId = null } = {}) {
  const weekly = await db("timetable_slots")
    .where((w) => {
      if (teacherIds.length) w.whereIn("teacherId", teacherIds);
      if (classId) w.orWhere({ classId });
      if (!teacherIds.length && !classId) w.whereRaw("1 = 0");
    })
    .select("dayOfWeek", "startTime", "endTime");
  const roundIds = await withEducators(db(ROUNDS).where({ status: "published" }).where("windowEnd", ">=", from).where("windowStart", "<=", to), teacherIds).pluck("id");
  let dated = [];
  if (roundIds.length) {
    let q = db(MEETINGS).whereIn("roundId", roundIds).whereIn("status", ["scheduled", "held"]).whereBetween("date", [from, to]);
    if (excludeMeetingId) q = q.whereNot({ id: excludeMeetingId });
    dated = await q.select("date", "startTime", "endTime");
  }
  return { weekly, dated };
}

// ---- Loading, with access ------------------------------------------------------------------------

async function loadRound(ctx, id) {
  const round = shapeRound(await db(ROUNDS).where({ id }).first());
  if (!round || !canSeeRound(ctx, round)) fail("Parent check-ins not found", 404);
  return round;
}

async function loadMeeting(ctx, id, { connection = db, forUpdate = false } = {}) {
  let q = connection(MEETINGS).where({ id });
  if (forUpdate) q = q.forUpdate();
  const meeting = shapeMeeting(await q.first());
  if (!meeting) fail("Check-in not found", 404);
  const round = shapeRound(await connection(ROUNDS).where({ id: meeting.roundId }).first());
  const access = meetingAccess(ctx, round, meeting);
  if (!access) fail("Check-in not found", 404);
  return { meeting, round, access };
}

// ---- Views -----------------------------------------------------------------------------------------

async function decorateRounds(rounds, today) {
  const ids = rounds.map((r) => r.id);
  const [classes, hubs, teachers, templates, users, meetings] = await Promise.all([
    mapBy("classes", rounds.map((r) => r.classId), ["id", "gradeName", "streamName"]),
    mapBy("learning_hubs", rounds.map((r) => r.hubId), ["id", "name"]),
    teacherNames(rounds.flatMap((r) => r.educatorIds)),
    mapBy(TEMPLATES, rounds.map((r) => r.templateId), ["id", "name"]),
    userNames(rounds.map((r) => r.createdBy)),
    ids.length ? db(MEETINGS).whereIn("roundId", ids).select("roundId", "status", "date", "reportSubmittedAt", "approvedAt", "confirmedAt") : [],
  ]);
  return rounds.map((r) => {
    const mine = meetings.filter((m) => m.roundId === r.id);
    const counts = { total: mine.length, upcoming: 0, confirmed: 0, reportDue: 0, awaitingApproval: 0, approved: 0, missed: 0, cancelled: 0 };
    for (const m of mine) {
      const state = R.meetingState(m, today);
      if (state === "upcoming" || state === "today") counts.upcoming += 1;
      if ((state === "upcoming" || state === "today") && m.confirmedAt) counts.confirmed += 1;
      if (state === "report_due") counts.reportDue += 1;
      if (state === "awaiting_approval") counts.awaitingApproval += 1;
      if (state === "approved") counts.approved += 1;
      if (state === "missed") counts.missed += 1;
      if (state === "cancelled") counts.cancelled += 1;
    }
    return {
      id: r.id, hubId: r.hubId, hubName: hubs.get(r.hubId)?.name || null, classId: r.classId,
      className: classes.has(r.classId) ? classLabel(classes.get(r.classId)) : "Class",
      educatorIds: r.educatorIds, educatorNames: r.educatorIds.map((id) => teachers.get(id)).filter(Boolean),
      format: r.format, meetingLink: r.meetingLink || null, location: r.location || null,
      windowStart: r.windowStart, windowEnd: r.windowEnd, days: r.days, dayStart: r.dayStart, dayEnd: r.dayEnd,
      minutes: r.minutes, gapMinutes: r.gapMinutes, spread: r.spread,
      templateId: r.templateId || null, templateName: templates.get(r.templateId)?.name || null,
      status: r.status, cancelledAt: r.cancelledAt || null, createdAt: r.createdAt, createdByName: users.get(r.createdBy) || null,
      counts,
    };
  });
}

// Each check-in as a row: when, the family, where it stands. `withReport` adds the report's
// score (never for the hub or a supervisor).
async function decorateMeetings(meetings, today, { withReport = false } = {}) {
  const roundIds = [...new Set(meetings.map((m) => m.roundId))];
  const rounds = roundIds.length ? (await db(ROUNDS).whereIn("id", roundIds)).map(shapeRound) : [];
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const [parents, learners, classes, hubs, teachers] = await Promise.all([
    userNames(meetings.map((m) => m.parentUserId)),
    learnerNames(meetings.flatMap((m) => m.learnerIds)),
    mapBy("classes", meetings.map((m) => m.classId), ["id", "gradeName", "streamName"]),
    mapBy("learning_hubs", meetings.map((m) => m.hubId), ["id", "name", "photo"]),
    teacherNames(rounds.flatMap((r) => r.educatorIds)),
  ]);
  return meetings.map((m) => {
    const round = roundById.get(m.roundId) || {};
    return {
      id: m.id, roundId: m.roundId, hubId: m.hubId, hubName: hubs.get(m.hubId)?.name || null, hubPhoto: hubs.get(m.hubId)?.photo || null,
      classId: m.classId, className: classes.has(m.classId) ? classLabel(classes.get(m.classId)) : "Class",
      parentUserId: m.parentUserId, parentName: parents.get(m.parentUserId) || "Parent",
      learners: m.learnerIds.map((id) => ({ id, name: learners.get(id)?.full || "Learner", firstName: learners.get(id)?.first || "Learner" })),
      educatorNames: (round.educatorIds || []).map((id) => teachers.get(id)).filter(Boolean),
      date: m.date, startTime: m.startTime, endTime: m.endTime,
      format: round.format || "in_person", meetingLink: round.format === "online" ? round.meetingLink || null : null, location: round.location || null,
      status: m.status, state: R.meetingState(m, today),
      confirmed: Boolean(m.confirmedAt), confirmedAt: m.confirmedAt || null, parentChangedAt: m.parentChangedAt || null,
      reportSubmittedAt: m.reportSubmittedAt || null, approvedAt: m.approvedAt || null,
      ...(withReport ? { score: m.score } : {}),
      roundCancelled: round.status === "cancelled",
    };
  });
}

// The template a check-in's report is written on: its own copy once reported, else its round's.
async function meetingTemplate(meeting, round) {
  if (meeting.template) return meeting.template;
  if (!round.templateId) return null;
  const t = shapeTemplate(await db(TEMPLATES).where({ id: round.templateId }).first());
  return t && t.ownerAdminId === round.ownerAdminId ? { name: t.name, description: t.description || null, scale: t.scale || [], sections: t.sections || [] } : null;
}

// What a template's answers still need: every yes / no and rubric item answered ("not applicable"
// counts) — the same rule as hub check-ins.
function answerProblems(template, answers = {}) {
  const problems = [];
  for (const s of template.sections) {
    const missing = s.criteria.filter((c) => {
      if (c.kind === "comment") return false;
      const value = answers[c.id]?.value;
      if (c.kind === "yes_no") return !["yes", "no", "na"].includes(value);
      return value !== "na" && !template.scale.some((l) => String(l.score) === String(value));
    });
    if (missing.length) problems.push(`Answer ${missing.length === 1 ? "1 item" : `${missing.length} items`} in "${s.title}" (or mark them not applicable)`);
  }
  return problems;
}

const changeable = (state) => state === "upcoming" || state === "today";

// The round's free times for one check-in (another family's, a class or another check-in of the
// educators' are taken), from `earliest` on.
async function freeTimesFor(round, meeting, earliest) {
  const slots = R.buildSlots(round, { earliest });
  if (!slots.length) return [];
  const busy = await busyFor(round.educatorIds, slots[0].date, slots[slots.length - 1].date, { classId: round.classId, excludeMeetingId: meeting.id });
  return slots.filter((s) => !R.isBusy(s, busy) && s.key !== R.slotKey(meeting.date, meeting.startTime));
}

// ---- Keeping current: on-the-day notices ------------------------------------------------------------

async function sendTodayNotices(ownerAdminId = null, today = todayInKenya()) {
  let q = db(MEETINGS).where({ status: "scheduled", date: today }).whereNull("reportSubmittedAt")
    .where((w) => w.whereNull("remindedFor").orWhereNot({ remindedFor: today }));
  if (ownerAdminId) q = q.where({ ownerAdminId });
  const meetings = (await q).map(shapeMeeting);
  if (!meetings.length) return 0;
  const rounds = new Map((await db(ROUNDS).whereIn("id", [...new Set(meetings.map((m) => m.roundId))])).map((r) => [r.id, shapeRound(r)]));
  const learners = await learnerNames(meetings.flatMap((m) => m.learnerIds));
  const byEducatorUser = new Map();
  for (const m of meetings) {
    const round = rounds.get(m.roundId);
    if (!round || round.status !== "published") continue;
    await Notify.todayForParent(round, m, { childNames: m.learnerIds.map((id) => learners.get(id)?.first) });
    for (const userId of await educatorUserIds(round.educatorIds)) {
      const list = byEducatorUser.get(userId) || { ownerAdminId: round.ownerAdminId, meetings: [] };
      list.meetings.push(m);
      byEducatorUser.set(userId, list);
    }
  }
  for (const [userId, { ownerAdminId: owner, meetings: list }] of byEducatorUser) {
    await Notify.todayForEducator(userId, today, list, owner);
  }
  await db(MEETINGS).whereIn("id", meetings.map((m) => m.id)).update({ remindedFor: today });
  return meetings.length;
}

// The page-load version of the cron job — at most every few minutes per workspace.
const lastRun = new Map();
async function keepCurrent(ownerAdminId) {
  const key = ownerAdminId || "*";
  if (Date.now() - (lastRun.get(key) || 0) < 5 * 60 * 1000) return;
  lastRun.set(key, Date.now());
  try {
    await sendTodayNotices(ownerAdminId);
  } catch (err) {
    lastRun.delete(key);
    console.error("[mentor-checkins] could not send today's notices:", err.message);
  }
}

// ---- The draw ------------------------------------------------------------------------------------------

// The settings and families of a new round, checked: the class's, a window that gives families
// R.MIN_NOTICE_DAYS' notice, and its times.
async function checkNewRound(ctx, body) {
  const people = await classPeople(ctx.ownerAdminId, body.classId);
  if (!people.educators.length) fail(`${people.className} has no educators yet — give its courses an educator first`, 409);
  const today = todayInKenya();
  const earliest = R.firstAllowedDate(today);
  if (body.windowStart < earliest) {
    fail(`Families get ${R.MIN_NOTICE_DAYS} days' notice, so the first check-in can be on ${earliest} at the earliest`);
  }
  if (body.windowEnd < body.windowStart) fail("The last day can't be before the first");
  if (R.toMinutes(body.dayEnd) - R.toMinutes(body.dayStart) < body.minutes) fail("The hours are shorter than one check-in");
  const chosen = new Set(body.parentUserIds);
  const families = people.families.filter((f) => chosen.has(f.parentUserId));
  if (!families.length) fail("Choose at least one family");
  const slots = R.buildSlots(body, { earliest });
  return { people, families, slots, today };
}

// ---- Templates ---------------------------------------------------------------------------------------

const canEditTemplate = (ctx, t) => !ctx.isStaff || t.createdBy === ctx.userId;
async function loadTemplate(ctx, id) {
  const t = shapeTemplate(await db(TEMPLATES).where({ id }).first());
  if (!t || t.ownerAdminId !== ctx.ownerAdminId) fail("Template not found", 404);
  return t;
}
function templateCheck(template) {
  const problems = templateProblems(template, { noun: "check-in" });
  if (problems.length) fail(problems[0], 400, { errors: problems.map((message) => ({ message })) });
}

const MentorCheckinService = {
  sendTodayNotices,
  _internal: { classPeople, busyFor },

  // ---- Templates (managers) ----
  async listTemplates(req, { status } = {}) {
    const ctx = await ctxOf(req);
    requireManager(ctx);
    let q = db(TEMPLATES).where({ ownerAdminId: ctx.ownerAdminId });
    if (status) q = q.where({ status });
    const rows = (await q.orderBy("name", "asc")).map(shapeTemplate);
    const ids = rows.map((t) => t.id);
    const [rounds, names] = await Promise.all([
      ids.length ? db(ROUNDS).whereIn("templateId", ids).select("templateId").count({ n: "*" }).groupBy("templateId") : [],
      userNames(rows.map((t) => t.createdBy)),
    ]);
    const uses = new Map(rounds.map((r) => [r.templateId, Number(r.n)]));
    return rows.map((t) => ({
      id: t.id, name: t.name, status: t.status, updatedAt: t.updatedAt,
      sectionCount: t.sections.length, itemCount: t.sections.reduce((n, s) => n + (s.criteria || []).length, 0),
      // The shared template list reads "visits" for how many uses (QA's word) — here, rounds.
      visits: uses.get(t.id) || 0, schedules: 0,
      createdByName: names.get(t.createdBy) || null, canEdit: canEditTemplate(ctx, t),
    }));
  },

  async getTemplate(req, id) {
    const ctx = await ctxOf(req);
    requireManager(ctx);
    const t = await loadTemplate(ctx, id);
    return { id: t.id, name: t.name, description: t.description || null, scale: t.scale, sections: t.sections, status: t.status, canEdit: canEditTemplate(ctx, t) };
  },

  async createTemplate(req, data) {
    const ctx = await ctxOf(req);
    requireManager(ctx, { manage: true });
    const template = normaliseTemplate({ ...data, scale: data.scale?.length ? data.scale : DEFAULT_SCALE });
    templateCheck(template);
    const created = await createRecord(db, TEMPLATES, stringifyJsonFields({ ...template, ownerAdminId: ctx.ownerAdminId, status: "active", createdBy: ctx.userId, updatedBy: ctx.userId }, ["scale", "sections"]));
    return this.getTemplate(req, created.id);
  },

  // Rounds use the template live until a report is sent; a sent report keeps its own copy.
  async updateTemplate(req, id, data) {
    const ctx = await ctxOf(req);
    requireManager(ctx, { manage: true });
    const before = await loadTemplate(ctx, id);
    if (!canEditTemplate(ctx, before)) fail("Only the person who made this template (or an admin) can change it", 403);
    const template = normaliseTemplate(data);
    templateCheck(template);
    await updateRecord(db, TEMPLATES, id, stringifyJsonFields({ ...template, updatedBy: ctx.userId }, ["scale", "sections"]));
    return this.getTemplate(req, id);
  },

  async setTemplateStatus(req, id, status) {
    const ctx = await ctxOf(req);
    requireManager(ctx, { manage: true });
    const t = await loadTemplate(ctx, id);
    if (!canEditTemplate(ctx, t)) fail("Only the person who made this template (or an admin) can archive it", 403);
    await updateRecord(db, TEMPLATES, id, { status, updatedBy: ctx.userId });
    return this.getTemplate(req, id);
  },

  async deleteTemplate(req, res, id) {
    const ctx = await ctxOf(req);
    requireManager(ctx, { manage: true });
    const t = await loadTemplate(ctx, id);
    if (!canEditTemplate(ctx, t)) fail("Only the person who made this template (or an admin) can delete it", 403);
    if (await UsageService.guardDelete(req, res, "mentorCheckinTemplate", id, "This template")) return null;
    await db(TEMPLATES).where({ id }).del();
    return { deleted: true };
  },

  // ---- Setting a round up (managers) ----

  async hubs(req) {
    const ctx = await ctxOf(req);
    requireManager(ctx);
    return db("learning_hubs").where({ ownerAdminId: ctx.ownerAdminId }).select("id", "name").orderBy("name", "asc");
  },

  async hubClasses(req, hubId) {
    const ctx = await ctxOf(req);
    requireManager(ctx);
    const hub = await db("learning_hubs").where({ id: hubId, ownerAdminId: ctx.ownerAdminId }).first("id");
    if (!hub) fail("Hub not found", 404);
    const classes = await db("classes").where({ schoolId: hubId, status: "active" }).select("id", "gradeName", "streamName", "academicYear");
    const counts = classes.length
      ? await db("learner_hub_links").whereIn("classId", classes.map((c) => c.id)).where({ status: "active" }).select("classId").count({ n: "*" }).groupBy("classId")
      : [];
    const learnerCount = new Map(counts.map((c) => [c.classId, Number(c.n)]));
    return classes
      .map((c) => ({ id: c.id, name: classLabel(c), academicYear: c.academicYear, learnerCount: learnerCount.get(c.id) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  // The educators and families of a class, as the set-up form shows them.
  async classPeople(req, classId) {
    const ctx = await ctxOf(req);
    requireManager(ctx);
    const { cls, hub, className, educators, families, withoutLogin } = await classPeople(ctx.ownerAdminId, classId);
    return { classId: cls.id, className, hubId: hub.id, hubName: hub.name, educators, families, withoutLogin, earliestDate: R.firstAllowedDate(todayInKenya()) };
  },

  // The draw, without saving: each chosen family on a free time, at random. Drawing again gives a
  // new order. Also every free time, so the form can swap a family onto another.
  async preview(req, body) {
    const ctx = await ctxOf(req);
    requireManager(ctx, { manage: true });
    const { people, families, slots } = await checkNewRound(ctx, body);
    if (!slots.length) fail("Those dates, days and hours don't give any times — widen them");
    const busy = await busyFor(people.educators.map((e) => e.id), slots[0].date, slots[slots.length - 1].date, { classId: body.classId });
    const draw = R.assignTimes(families.map((f) => ({ parentUserId: f.parentUserId })), slots, busy, { spread: body.spread, randomInt });
    const familyOf = new Map(families.map((f) => [f.parentUserId, f]));
    return {
      meetings: draw.meetings.map((m) => ({ ...m, parentName: familyOf.get(m.parentUserId).parentName, learners: familyOf.get(m.parentUserId).learners })),
      short: draw.short,
      unplaced: families.filter((f) => !draw.meetings.some((m) => m.parentUserId === f.parentUserId)).map((f) => ({ parentUserId: f.parentUserId, parentName: f.parentName, learners: f.learners })),
      freeTimes: slots.filter((s) => !R.isBusy(s, busy)).map(({ date, startTime, endTime }) => ({ date, startTime, endTime })),
      educators: people.educators,
    };
  },

  // Publishes a round with the times from the draw (as the admin may have swapped them): each
  // checked again — one of the window's times, free, one per family — then the families and the
  // educators are told.
  async createRound(req, body) {
    const ctx = await ctxOf(req);
    requireManager(ctx, { manage: true });
    const { people, families, slots } = await checkNewRound(ctx, body);
    if (body.format === "online" && !body.meetingLink) fail("Add the link to join — the families and educators get it with their reminders");
    if (body.templateId) {
      const t = await loadTemplate(ctx, body.templateId);
      if (t.status !== "active") fail(`"${t.name}" is archived — choose another template`, 409);
    }
    const familyOf = new Map(families.map((f) => [f.parentUserId, f]));
    const slotOf = new Map(slots.map((s) => [s.key, s]));
    const educatorIds = people.educators.map((e) => e.id);
    const busy = slots.length ? await busyFor(educatorIds, slots[0].date, slots[slots.length - 1].date, { classId: body.classId }) : { weekly: [], dated: [] };
    const seenFamilies = new Set();
    const seenTimes = new Set();
    const rows = body.meetings.map((m) => {
      const family = familyOf.get(m.parentUserId);
      if (!family) fail("One of the families isn't in this class any more — draw again");
      if (seenFamilies.has(m.parentUserId)) fail(`${family.parentName} has two times — give each family one`);
      seenFamilies.add(m.parentUserId);
      const key = R.slotKey(m.date, m.startTime);
      const slot = slotOf.get(key);
      if (!slot) fail(`${family.parentName}'s time (${m.date} ${m.startTime}) isn't one of the round's times — draw again`);
      if (seenTimes.has(key)) fail(`Two families have ${m.date} ${m.startTime} — give each its own time`);
      seenTimes.add(key);
      if (R.isBusy(slot, busy)) fail(`The educators are busy on ${m.date} at ${m.startTime} — draw again`, 409);
      return { family, slot, key };
    });
    if (!rows.length) fail("Give at least one family a time");

    const roundId = generateId();
    const now = new Date();
    const round = {
      id: roundId, ownerAdminId: ctx.ownerAdminId, hubId: people.hub.id, classId: body.classId,
      educatorIds: JSON.stringify(educatorIds), templateId: body.templateId || null, format: body.format,
      meetingLink: body.format === "online" ? body.meetingLink : null, location: body.format === "in_person" ? body.location || null : null,
      windowStart: body.windowStart, windowEnd: body.windowEnd, days: JSON.stringify(body.days), dayStart: body.dayStart, dayEnd: body.dayEnd,
      minutes: body.minutes, gapMinutes: body.gapMinutes, spread: body.spread, status: "published",
      createdBy: ctx.userId, updatedBy: ctx.userId, createdAt: now, updatedAt: now,
    };
    const meetings = rows.map(({ family, slot, key }) => ({
      id: generateId(), ownerAdminId: ctx.ownerAdminId, roundId, hubId: people.hub.id, classId: body.classId,
      parentUserId: family.parentUserId, learnerIds: JSON.stringify(family.learners.map((l) => l.id)),
      date: slot.date, startTime: slot.startTime, endTime: slot.endTime, slotKey: key, status: "scheduled",
      updatedBy: ctx.userId, createdAt: now, updatedAt: now,
    }));
    try {
      await db.transaction(async (trx) => {
        await trx(ROUNDS).insert(round);
        await trx(MEETINGS).insert(meetings);
      });
    } catch (err) {
      if (isDuplicate(err)) fail("Two families ended up on one time — draw again", 409);
      throw err;
    }

    const saved = shapeRound({ ...round });
    const educatorNames = people.educators.map((e) => e.name);
    for (const m of meetings) {
      await Notify.scheduled(saved, { ...m }, { childNames: familyOf.get(m.parentUserId).learners.map((l) => l.name.split(" ")[0]), educatorNames });
    }
    await Notify.roundScheduled(saved, await educatorUserIds(educatorIds), { className: people.className, count: meetings.length });
    return this.getRound(req, roundId);
  },

  // ---- Rounds ----

  async listRounds(req, { status } = {}) {
    const ctx = await ctxOf(req);
    let q = db(ROUNDS);
    if (ctx.kind === "manager") q = q.where({ ownerAdminId: ctx.ownerAdminId });
    else if (ctx.kind === "supervisor") q = withEducators(q.where({ ownerAdminId: ctx.ownerAdminId }), ctx.teacherIds);
    else if (ctx.kind === "hub") q = q.whereIn("hubId", ctx.hubIds.length ? ctx.hubIds : ["__none__"]);
    else if (ctx.kind === "educator") q = withEducators(q, ctx.teacherIds);
    else fail("You do not have permission to perform this action", 403);
    if (status) q = q.where({ status });
    if (ctx.kind === "manager") await keepCurrent(ctx.ownerAdminId);
    const rounds = (await q.orderBy("windowStart", "desc").limit(300)).map(shapeRound);
    return decorateRounds(rounds, todayInKenya());
  },

  async getRound(req, id) {
    const ctx = await ctxOf(req);
    const round = await loadRound(ctx, id);
    const today = todayInKenya();
    const [view] = await decorateRounds([round], today);
    const meetingRows = (await db(MEETINGS).where({ roundId: id }).orderBy([{ column: "date", order: "asc" }, { column: "startTime", order: "asc" }])).map(shapeMeeting);
    const meetings = await decorateMeetings(meetingRows, today, { withReport: ctx.kind === "manager" || ctx.kind === "educator" });
    const canManage = ctx.kind === "manager" && ctx.canManage;
    return { ...view, meetings, permissions: { canManage, canCancel: canManage && round.status === "published" } };
  },

  // Calls off every check-in of the round still to come (reports already written stay).
  async cancelRound(req, id) {
    const ctx = await ctxOf(req);
    requireManager(ctx, { manage: true });
    const round = await loadRound(ctx, id);
    if (round.status !== "published") fail("These check-ins have already been cancelled", 409);
    const today = todayInKenya();
    const toCancel = (await db(MEETINGS).where({ roundId: id, status: "scheduled" }).whereNull("reportSubmittedAt").where("date", ">=", today)).map(shapeMeeting);
    await db.transaction(async (trx) => {
      await trx(ROUNDS).where({ id }).update({ status: "cancelled", cancelledAt: new Date(), updatedBy: ctx.userId, updatedAt: new Date() });
      if (toCancel.length) await trx(MEETINGS).whereIn("id", toCancel.map((m) => m.id)).update({ status: "cancelled", slotKey: null, updatedBy: ctx.userId, updatedAt: new Date() });
    });
    const learners = await learnerNames(toCancel.flatMap((m) => m.learnerIds));
    for (const m of toCancel) {
      await Notify.cancelled(round, m, { childNames: m.learnerIds.map((l) => learners.get(l)?.first), educatorUserIds: [], notifyEducators: false });
    }
    const cls = await db("classes").where({ id: round.classId }).first("gradeName", "streamName");
    await Notify.roundCancelled(round, await educatorUserIds(round.educatorIds), { className: classLabel(cls) });
    return this.getRound(req, id);
  },

  // The link or place can change after publishing; the families' notices carry what's current.
  async updateRound(req, id, body) {
    const ctx = await ctxOf(req);
    requireManager(ctx, { manage: true });
    const round = await loadRound(ctx, id);
    if (round.status !== "published") fail("These check-ins have been cancelled", 409);
    if (round.format === "online" && body.meetingLink === null) fail("An online check-in needs its link");
    if (body.templateId) {
      const t = await loadTemplate(ctx, body.templateId);
      if (t.status !== "active" && body.templateId !== round.templateId) fail(`"${t.name}" is archived — choose another template`, 409);
    }
    await db(ROUNDS).where({ id }).update({
      ...(body.meetingLink !== undefined && round.format === "online" ? { meetingLink: body.meetingLink } : {}),
      ...(body.location !== undefined && round.format === "in_person" ? { location: body.location || null } : {}),
      ...(body.templateId !== undefined ? { templateId: body.templateId || null } : {}),
      updatedBy: ctx.userId, updatedAt: new Date(),
    });
    return this.getRound(req, id);
  },

  // ---- Check-ins ----

  // "My" check-ins: a parent's own; an educator's rounds'; a hub's or a supervisor's (schedule
  // only); a manager's for one round. view: coming | todo | done | all.
  async listMeetings(req, { view = "coming", roundId } = {}) {
    const ctx = await ctxOf(req);
    const today = todayInKenya();
    let q = db(MEETINGS);
    if (ctx.kind === "parent") q = q.where({ parentUserId: ctx.userId });
    else {
      let rounds = db(ROUNDS);
      if (ctx.kind === "manager") rounds = rounds.where({ ownerAdminId: ctx.ownerAdminId });
      else if (ctx.kind === "supervisor") rounds = withEducators(rounds.where({ ownerAdminId: ctx.ownerAdminId }), ctx.teacherIds);
      else if (ctx.kind === "hub") rounds = rounds.whereIn("hubId", ctx.hubIds.length ? ctx.hubIds : ["__none__"]);
      else rounds = withEducators(rounds, ctx.teacherIds);
      if (roundId) rounds = rounds.where({ id: roundId });
      q = q.whereIn("roundId", await rounds.pluck("id"));
    }
    const owners = await q.clone().distinct("ownerAdminId").pluck("ownerAdminId");
    for (const owner of owners) await keepCurrent(owner);

    const views = {
      coming: (x) => x.where({ status: "scheduled" }).whereNull("reportSubmittedAt").where("date", ">=", today),
      // Something waits on me: an educator's reports to write; a parent's reports to approve.
      todo: ctx.kind === "parent"
        ? (x) => x.whereNotNull("reportSubmittedAt").whereNull("approvedAt").whereNot({ status: "cancelled" })
        : (x) => x.where({ status: "scheduled" }).whereNull("reportSubmittedAt").where("date", "<", today),
      done: (x) => x.where((w) => w.whereNotNull("reportSubmittedAt").orWhereIn("status", ["missed", "cancelled"])),
      all: (x) => x,
    };
    const counts = {};
    for (const [key, apply] of Object.entries(views)) {
      if (key !== "all") counts[key] = Number((await apply(q.clone()).count({ n: "*" }).first())?.n || 0);
    }
    const ascending = view === "coming";
    const rows = (await (views[view] || views.coming)(q.clone())
      .orderBy([{ column: "date", order: ascending ? "asc" : "desc" }, { column: "startTime", order: ascending ? "asc" : "desc" }])
      .limit(300)).map(shapeMeeting);
    const meetings = await decorateMeetings(rows, today, { withReport: ctx.kind === "manager" || ctx.kind === "educator" });
    return { meetings, counts, today, viewer: ctx.kind };
  },

  async getMeeting(req, id) {
    const ctx = await ctxOf(req);
    const { meeting, round, access } = await loadMeeting(ctx, id);
    await keepCurrent(round.ownerAdminId);
    const today = todayInKenya();
    const [view] = await decorateMeetings([meeting], today, { withReport: access.report });
    const state = view.state;
    // A round cancelled later still lets its past check-ins be written up.
    const canWrite = (access.asEducator || (access.asManager && ctx.canManage)) && ["today", "report_due", "awaiting_approval"].includes(state);
    return {
      ...view,
      round: { id: round.id, status: round.status, templateId: round.templateId || null },
      ...(access.report ? {
        template: await meetingTemplate(meeting, round),
        answers: meeting.answers || {}, sectionScores: meeting.sectionScores || [], score: meeting.score,
        report: meeting.report || null, parentComment: meeting.parentComment || null,
        reportSubmittedByName: meeting.reportSubmittedBy ? (await userNames([meeting.reportSubmittedBy])).get(meeting.reportSubmittedBy) : null,
      } : {}),
      permissions: {
        viewer: ctx.kind,
        canConfirm: Boolean(access.asParent) && changeable(state) && !meeting.confirmedAt,
        canChangeTime: Boolean(access.asParent) && state === "upcoming",
        canApprove: Boolean(access.asParent) && state === "awaiting_approval",
        canWriteReport: canWrite,
        canMarkMissed: (access.asEducator || (access.asManager && ctx.canManage)) && ["today", "report_due"].includes(state),
        canUndoMissed: (access.asEducator || (access.asManager && ctx.canManage)) && state === "missed",
        canMove: Boolean(access.asManager) && ctx.canManage && changeable(state),
        canCancel: Boolean(access.asManager) && ctx.canManage && changeable(state),
      },
    };
  },

  // The round's free times this check-in could move to: a parent's from tomorrow on, our team's
  // from today.
  async freeTimes(req, id) {
    const ctx = await ctxOf(req);
    const { meeting, round, access } = await loadMeeting(ctx, id);
    if (!access.asParent && !(access.asManager && ctx.canManage)) fail("You can't move this check-in", 403);
    const today = todayInKenya();
    const earliest = access.asParent ? addDays(today, R.PARENT_CHANGE_MIN_DAYS) : today;
    const free = await freeTimesFor(round, meeting, earliest);
    return free.slice(0, 400).map(({ date, startTime, endTime }) => ({ date, startTime, endTime }));
  },

  // A parent picks another free time (which counts as confirming it), or our team moves it (the
  // family then confirms again). Never onto a time another family holds (UNIQUE slotKey).
  async changeTime(req, id, { date, startTime }) {
    const ctx = await ctxOf(req);
    const { meeting, round, access } = await loadMeeting(ctx, id);
    const byParent = Boolean(access.asParent);
    if (!byParent && !(access.asManager && ctx.canManage)) fail("You can't move this check-in", 403);
    if (round.status !== "published") fail("These check-ins have been cancelled", 409);
    const today = todayInKenya();
    const state = R.meetingState(meeting, today);
    if (byParent ? state !== "upcoming" : !changeable(state)) {
      fail(byParent && state === "today" ? "Your check-in is today — it can't move now. Get in touch with the mentor if you can't make it." : "This check-in can't be moved now", 409);
    }
    const earliest = byParent ? addDays(today, R.PARENT_CHANGE_MIN_DAYS) : today;
    const free = await freeTimesFor(round, meeting, earliest);
    const slot = free.find((s) => s.date === date && s.startTime === startTime);
    if (!slot) fail("That time isn't free any more — pick another", 409);
    const now = new Date();
    try {
      await db(MEETINGS).where({ id }).update({
        date: slot.date, startTime: slot.startTime, endTime: slot.endTime, slotKey: slot.key,
        confirmedAt: byParent ? now : null, ...(byParent ? { parentChangedAt: now } : {}), remindedFor: null,
        updatedBy: ctx.userId, updatedAt: now,
      });
    } catch (err) {
      if (isDuplicate(err)) fail("Someone has just taken that time — pick another", 409);
      throw err;
    }
    const moved = { ...meeting, date: slot.date, startTime: slot.startTime, endTime: slot.endTime };
    const [learners, parents] = await Promise.all([learnerNames(meeting.learnerIds), userNames([meeting.parentUserId])]);
    await Notify.changed(round, moved, {
      byParent, parentName: parents.get(meeting.parentUserId), childNames: meeting.learnerIds.map((l) => learners.get(l)?.first),
      educatorUserIds: await educatorUserIds(round.educatorIds),
    });
    return this.getMeeting(req, id);
  },

  async confirm(req, id) {
    const ctx = await ctxOf(req);
    const { meeting, access } = await loadMeeting(ctx, id);
    if (!access.asParent) fail("Only the parent confirms their check-in", 403);
    if (!changeable(R.meetingState(meeting, todayInKenya()))) fail("This check-in can't be confirmed now", 409);
    if (!meeting.confirmedAt) await db(MEETINGS).where({ id }).update({ confirmedAt: new Date(), updatedBy: ctx.userId, updatedAt: new Date() });
    return this.getMeeting(req, id);
  },

  async cancelMeeting(req, id) {
    const ctx = await ctxOf(req);
    const { meeting, round, access } = await loadMeeting(ctx, id);
    if (!(access.asManager && ctx.canManage)) fail("Only an admin can cancel a check-in", 403);
    if (!changeable(R.meetingState(meeting, todayInKenya()))) fail("This check-in can't be cancelled now", 409);
    await db(MEETINGS).where({ id }).update({ status: "cancelled", slotKey: null, updatedBy: ctx.userId, updatedAt: new Date() });
    const learners = await learnerNames(meeting.learnerIds);
    await Notify.cancelled(round, meeting, { childNames: meeting.learnerIds.map((l) => learners.get(l)?.first), educatorUserIds: await educatorUserIds(round.educatorIds) });
    return this.getMeeting(req, id);
  },

  // Missed: it didn't happen (from its day on, with no report). Undo puts it back to write up.
  async setMissed(req, id, missed) {
    const ctx = await ctxOf(req);
    const { meeting, access } = await loadMeeting(ctx, id);
    if (!(access.asEducator || (access.asManager && ctx.canManage))) fail("Only the class's educators can mark this", 403);
    const state = R.meetingState(meeting, todayInKenya());
    if (missed && !["today", "report_due"].includes(state)) fail("A check-in can be marked missed from its day on, before its report", 409);
    if (!missed && state !== "missed") fail("This check-in isn't marked missed", 409);
    await db(MEETINGS).where({ id }).update({ status: missed ? "missed" : "scheduled", updatedBy: ctx.userId, updatedAt: new Date() });
    return this.getMeeting(req, id);
  },

  // The educators' report: with a template, an answer to each item (scored the QA way); then how
  // the child is doing and what was agreed. From the check-in's day on; correctable until the
  // parent approves it. The first send keeps a copy of the template and tells the parent.
  async saveReport(req, id, body) {
    const ctx = await ctxOf(req);
    const { answers: rawAnswers = {}, summary, actions } = body;
    let firstSend = null;
    await db.transaction(async (trx) => {
      const { meeting, round, access } = await loadMeeting(ctx, id, { connection: trx, forUpdate: true });
      if (!(access.asEducator || (access.asManager && ctx.canManage))) fail("The report is written by the class's educators", 403);
      const state = R.meetingState(meeting, todayInKenya());
      if (state === "approved") fail("The parent has approved this report — it can't change now", 409);
      if (!["today", "report_due", "awaiting_approval"].includes(state)) fail(state === "upcoming" ? "Write the report on or after the day of the check-in" : "This check-in has no report to write", 409);
      const template = await meetingTemplate(meeting, round);
      const answers = template ? cleanAnswers(template, rawAnswers) : {};
      const report = { summary: summary || "", actions: actions || "" };
      const problems = [...(template ? answerProblems(template, answers) : []), ...R.reportProblems(report)];
      if (problems.length) fail(problems[0], 400, { errors: problems.map((message) => ({ message })) });
      const scored = template ? scoreReview(template, answers) : { score: null, sectionScores: [] };
      const first = !meeting.reportSubmittedAt;
      await trx(MEETINGS).where({ id }).update(stringifyJsonFields({
        report, status: "held", updatedBy: ctx.userId, updatedAt: new Date(),
        ...(template ? { template, answers, score: scored.score, sectionScores: scored.sectionScores } : {}),
        ...(first ? { reportSubmittedAt: new Date(), reportSubmittedBy: ctx.userId } : {}),
      }, MEETING_JSON));
      if (first) firstSend = { meeting, round };
    });
    if (firstSend) {
      const { meeting, round } = firstSend;
      const [learners, writer] = await Promise.all([learnerNames(meeting.learnerIds), userNames([ctx.userId])]);
      await Notify.reportReady(round, meeting, { childNames: meeting.learnerIds.map((l) => learners.get(l)?.first), educatorName: writer.get(ctx.userId) });
    }
    return this.getMeeting(req, id);
  },

  // The parent has read the report and approves it (with a note, optionally). That closes it.
  async approve(req, id, { comment }) {
    const ctx = await ctxOf(req);
    const { meeting, round, access } = await loadMeeting(ctx, id);
    if (!access.asParent) fail("Only the parent approves the report", 403);
    if (R.meetingState(meeting, todayInKenya()) !== "awaiting_approval") fail("There's no report waiting for your approval", 409);
    const parentComment = comment ? String(comment).trim().slice(0, 2000) || null : null;
    await db(MEETINGS).where({ id }).update({ approvedAt: new Date(), parentComment, updatedBy: ctx.userId, updatedAt: new Date() });
    const [learners, parents] = await Promise.all([learnerNames(meeting.learnerIds), userNames([meeting.parentUserId])]);
    await Notify.approved(round, { ...meeting, parentComment }, {
      parentName: parents.get(meeting.parentUserId), childNames: meeting.learnerIds.map((l) => learners.get(l)?.first),
      educatorUserIds: await educatorUserIds(round.educatorIds),
    });
    return this.getMeeting(req, id);
  },

  // The sign-in pop-up (parents and educators):
  //   attend   a check-in of mine in the next R.POPUP_DAYS days or today, not written up;
  //   approve  (parents) a report waiting for my approval;
  //   write    (educators) a check-in whose day has passed with no report.
  async due(req) {
    const ctx = await contextOf(req);
    if (!ctx || !["parent", "educator"].includes(ctx.kind)) return [];
    const today = todayInKenya();
    let mine;
    if (ctx.kind === "parent") mine = db(MEETINGS).where({ parentUserId: ctx.userId });
    else mine = db(MEETINGS).whereIn("roundId", await withEducators(db(ROUNDS).where({ status: "published" }), ctx.teacherIds).pluck("id"));
    const owners = await mine.clone().where("date", ">=", addDays(today, -60)).distinct("ownerAdminId").pluck("ownerAdminId");
    for (const owner of owners) await keepCurrent(owner);
    const attend = (await mine.clone().where({ status: "scheduled" }).whereNull("reportSubmittedAt")
      .whereBetween("date", [today, addDays(today, R.POPUP_DAYS)]).orderBy([{ column: "date", order: "asc" }, { column: "startTime", order: "asc" }]).limit(20)).map(shapeMeeting);
    const second = ctx.kind === "parent"
      ? await mine.clone().whereNotNull("reportSubmittedAt").whereNull("approvedAt").whereNot({ status: "cancelled" }).orderBy("date", "desc").limit(20)
      : await mine.clone().where({ status: "scheduled" }).whereNull("reportSubmittedAt").where("date", "<", today).where("date", ">=", addDays(today, -60)).orderBy("date", "asc").limit(20);
    const secondKind = ctx.kind === "parent" ? "approve" : "write";
    const rows = [...attend, ...second.map(shapeMeeting)];
    const kinds = new Map([...attend.map((m) => [m.id, "attend"]), ...second.map((m) => [m.id, secondKind])]);
    const decorated = await decorateMeetings(rows, today);
    // Who wrote a report waiting for approval — the pop-up names them.
    const writers = await userNames(rows.map((m) => m.reportSubmittedBy));
    const writerOf = new Map(rows.map((m) => [m.id, writers.get(m.reportSubmittedBy) || null]));
    return decorated.filter((m) => !m.roundCancelled).map((m) => ({ ...m, kind: kinds.get(m.id), writtenBy: writerOf.get(m.id) }));
  },
};

module.exports = MentorCheckinService;

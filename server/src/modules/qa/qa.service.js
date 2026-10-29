const db = require("../../config/db");
const QaModel = require("./qa.model");
const QaNotifications = require("./qa.notifications");
const UsageService = require("../usage/usage.service");
const {
  contextOf, isReviewerKind, teacherName, reviewableTeacherIds, assertReviewable, hubsOfTeacher, reviewerOptions, canSeeVisit, canWorkOnVisit,
} = require("./qa.access");
const { todayInKenya, addDays, occurrenceDates } = require("../checkins/checkin.dates");
const {
  normaliseTemplate, templateProblems, scoreReview, reviewProblems, cleanAnswers, visitState, hasContent,
} = require("./qa.rules");
const { GENERATE_AHEAD_DAYS, NOTICE_DAYS, DEFAULT_SCALE } = require("./qa.constants");

// Quality assurance — a supervisor (or an admin) visits an educator and reviews how they teach.
// See the 20261029100000 migration for the tables, qa.access.js for who sees what.
//
//   A template lists what is checked. Anyone who reviews can make one; it belongs to the whole
//   workspace, and only its maker (or an admin) changes it. A visit keeps its own copy of the
//   template from the moment its review is started.
//
//   Visits come from a schedule — one educator, how often, from when, announced or a surprise — put
//   on the calendar ahead of time (GENERATE_AHEAD_DAYS, and always the next one) from `generateFrom`,
//   keyed (scheduleId, occurrenceDate) so generating again never makes a second copy; or they're
//   planned one at a time. An announced visit is shown to the educator and their hub beforehand
//   (and the educator is told NOTICE_DAYS ahead); a surprise one isn't, until its report is in.
//
//   On the day the reviewer is told it's due. The review — an answer per item, the strengths, the
//   areas to improve, any overall remarks — can be kept and finished later, then sent; sending works
//   out the score and tells the educator, who can reply. A sent report can still be corrected.

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const problemsError = (problems) => Object.assign(new Error(problems[0]), { statusCode: 400, errors: problems.map((message) => ({ message })) });

function requireReviewer(ctx) {
  if (!isReviewerKind(ctx)) fail("Only a supervisor or an admin can do this", 403);
  if (!ctx.ownerAdminId) fail("Your account isn't part of a workspace yet", 403);
}

// ---- Names ----

async function teachersById(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await db("teachers").whereIn("id", unique).select("id", "firstName", "lastName", "email", "photo", "supervisorId", "status");
  return new Map(rows.map((r) => [r.id, r]));
}
async function namesFrom(table, ids, column = "name") {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await db(table).whereIn("id", unique).select("id", column, ...(table === "users" ? ["email"] : []));
  return new Map(rows.map((r) => [r.id, r[column] || r.email || null]));
}

// ---- Templates ----

const canEditTemplate = (ctx, template) => ctx.kind === "admin" || template.createdBy === ctx.userId;

async function loadTemplate(ctx, id) {
  const template = await QaModel.findTemplate(id);
  if (!template || template.ownerAdminId !== ctx.ownerAdminId) fail("Template not found", 404);
  return template;
}

// A template ready to answer — the visit's own copy once started, the template as it is until then.
const templateBody = (t) => ({ name: t.name, description: t.description || null, scale: t.scale || [], sections: t.sections || [] });

async function usableTemplate(ctx, templateId) {
  const template = await loadTemplate(ctx, templateId);
  if (template.status !== "active") fail(`"${template.name}" is archived — choose another template, or bring it back first`, 409);
  return template;
}

// ---- Educators, hubs and reviewers ----

async function hubsOfTeachers(teacherIds, ownerAdminId) {
  const map = new Map(teacherIds.map((id) => [id, new Set()]));
  if (!teacherIds.length) return new Map();
  const [links, teaching] = await Promise.all([
    db("teacher_hub_links").whereIn("teacherId", teacherIds).select("teacherId", "hubId"),
    db("class_course_teacher_links as l").join("classes as c", "c.id", "l.classId").whereIn("l.teacherId", teacherIds).select("l.teacherId", "c.schoolId as hubId"),
  ]);
  for (const r of [...links, ...teaching]) if (r.hubId) map.get(r.teacherId)?.add(r.hubId);
  const hubIds = [...new Set([...map.values()].flatMap((s) => [...s]))];
  const hubs = hubIds.length ? await db("learning_hubs").whereIn("id", hubIds).where({ ownerAdminId }).select("id", "name") : [];
  const byId = new Map(hubs.map((h) => [h.id, h]));
  return new Map([...map.entries()].map(([id, set]) => [id, [...set].map((h) => byId.get(h)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))]));
}

async function checkHub(ctx, teacherId, hubId) {
  if (!hubId) return null;
  const hubs = await hubsOfTeacher(teacherId, ctx.ownerAdminId);
  if (!hubs.some((h) => h.id === hubId)) fail("Choose one of the hubs this educator works at");
  return hubId;
}

// Who reviews: a supervisor always reviews themselves; an admin picks an admin or supervisor of the
// workspace — by default the educator's own supervisor.
async function resolveReviewer(ctx, reviewerId, teacher) {
  if (ctx.kind === "supervisor") return ctx.userId;
  const options = await reviewerOptions(ctx);
  const chosen = reviewerId || (options.some((o) => o.id === teacher.supervisorId) ? teacher.supervisorId : null);
  if (!chosen) fail("Choose who does the visit");
  if (!options.some((o) => o.id === chosen)) fail("The reviewer must be an admin or a supervisor of this workspace");
  return chosen;
}

async function teacherOf(teacherId) {
  const teacher = (await teachersById([teacherId])).get(teacherId);
  if (!teacher) fail("Educator not found", 404);
  return teacher;
}

// ---- Generating visits, and the notices ----

function visitRowsFor(schedule, from, today) {
  const until = addDays(today, GENERATE_AHEAD_DAYS);
  return occurrenceDates(schedule, until, { from }).map((date) => ({
    ownerAdminId: schedule.ownerAdminId,
    scheduleId: schedule.id,
    occurrenceDate: date,
    scheduledDate: date,
    teacherId: schedule.teacherId,
    hubId: schedule.hubId || null,
    templateId: schedule.templateId,
    reviewerId: schedule.reviewerId,
    visitType: schedule.visitType,
    status: "open",
  }));
}

// A schedule's visits still ahead, not started: safe to rewrite or remove.
const untouchedUpcoming = (connection, scheduleId, today) => connection("qa_visits")
  .where({ scheduleId, status: "open" }).whereNull("startedAt").where("scheduledDate", ">", today);

async function generateAll(ownerAdminId = null, today = todayInKenya()) {
  const schedules = await QaModel.activeSchedules(ownerAdminId);
  for (const schedule of schedules) await QaModel.insertVisitsIgnoringExisting(visitRowsFor(schedule, schedule.generateFrom, today));
  return schedules.length;
}

// Tells educators about announced visits in the next NOTICE_DAYS (once per date), and reviewers
// about visits due today. Keyed, so repeats send nothing new.
async function sendNotices(ownerAdminId = null, today = todayInKenya()) {
  let announced = db("qa_visits").where({ status: "open", visitType: "announced" })
    .where("scheduledDate", ">=", today).where("scheduledDate", "<=", addDays(today, NOTICE_DAYS))
    .where((w) => w.whereNull("noticeSentFor").orWhereRaw("noticeSentFor <> scheduledDate"));
  let due = db("qa_visits").where({ status: "open", scheduledDate: today });
  if (ownerAdminId) { announced = announced.where({ ownerAdminId }); due = due.where({ ownerAdminId }); }
  const [toAnnounce, dueToday] = await Promise.all([announced, due]);
  const [teachers, reviewers, hubs] = await Promise.all([
    teachersById([...toAnnounce, ...dueToday].map((v) => v.teacherId)),
    namesFrom("users", toAnnounce.map((v) => v.reviewerId)),
    namesFrom("learning_hubs", toAnnounce.map((v) => v.hubId)),
  ]);
  for (const visit of toAnnounce) {
    await QaNotifications.announced(visit, teachers.get(visit.teacherId), reviewers.get(visit.reviewerId) || "Your supervisor", hubs.get(visit.hubId) || null);
    await db("qa_visits").where({ id: visit.id }).update({ noticeSentFor: visit.scheduledDate });
  }
  for (const visit of dueToday) await QaNotifications.due(visit, teacherName(teachers.get(visit.teacherId)));
  return { announced: toAnnounce.length, due: dueToday.length };
}

// The page-load version of the cron job, for one workspace — at most once every few minutes.
const lastRun = new Map();
async function keepCurrent(ownerAdminId) {
  if (!ownerAdminId) return;
  const last = lastRun.get(ownerAdminId) || 0;
  if (Date.now() - last < 5 * 60 * 1000) return;
  lastRun.set(ownerAdminId, Date.now());
  try {
    await generateAll(ownerAdminId);
    await sendNotices(ownerAdminId);
  } catch (err) {
    lastRun.delete(ownerAdminId);
    console.error("[qa] could not bring visits up to date:", err.message);
  }
}

// ---- Views ----

async function decorateVisits(rows, today, ctx) {
  const reviewerKind = isReviewerKind(ctx);
  const [teachers, hubs, reviewers, templates] = await Promise.all([
    teachersById(rows.map((v) => v.teacherId)),
    namesFrom("learning_hubs", rows.map((v) => v.hubId)),
    namesFrom("users", rows.map((v) => v.reviewerId)),
    namesFrom("qa_templates", rows.filter((v) => !v.template).map((v) => v.templateId)),
  ]);
  return rows.map((v) => {
    const teacher = teachers.get(v.teacherId);
    const submitted = v.status === "submitted";
    return {
      id: v.id,
      scheduleId: v.scheduleId,
      scheduledDate: v.scheduledDate,
      teacherId: v.teacherId,
      teacherName: teacherName(teacher),
      teacherPhoto: teacher?.photo || null,
      hubId: v.hubId,
      hubName: hubs.get(v.hubId) || null,
      reviewerId: v.reviewerId,
      reviewerName: reviewers.get(v.reviewerId) || null,
      visitType: v.visitType,
      status: v.status,
      state: visitState(v, today),
      templateId: v.templateId,
      templateName: v.template?.name || templates.get(v.templateId) || null,
      // A review being written isn't shown to the people visited.
      started: reviewerKind ? Boolean(v.startedAt) : undefined,
      score: submitted ? v.score : null,
      submittedAt: submitted ? v.submittedAt : null,
      hasReply: submitted && ctx.kind !== "hub" ? Boolean(v.reply) : undefined,
    };
  });
}

// The visits this person may list, as a filter to put on a query (a function, not a query: an
// awaited Knex query would run).
async function visibleFilter(ctx) {
  const shownToVisited = (w) => w.where({ status: "submitted" }).orWhere((x) => x.where({ status: "open", visitType: "announced" }));
  if (ctx.kind === "admin") return (q) => q.where({ ownerAdminId: ctx.ownerAdminId });
  if (ctx.kind === "supervisor") {
    const mine = await reviewableTeacherIds(ctx);
    return (q) => q.where({ ownerAdminId: ctx.ownerAdminId }).where((w) => w.where({ reviewerId: ctx.userId }).orWhereIn("teacherId", mine.length ? mine : ["__none__"]));
  }
  if (ctx.kind === "educator") return (q) => q.where({ teacherId: ctx.teacherId }).where(shownToVisited);
  return (q) => q.where({ hubId: ctx.hubId }).where(shownToVisited);
}

async function loadVisit(ctx, id, { forUpdate = false, connection = db } = {}) {
  const visit = await QaModel.findVisit(id, connection, forUpdate);
  const teacher = visit ? (await teachersById([visit.teacherId])).get(visit.teacherId) : null;
  if (!visit || !canSeeVisit(ctx, visit, teacher)) fail("Visit not found", 404);
  return { visit, teacher };
}

// ---- Schedules ----

async function decorateSchedules(rows) {
  const [teachers, hubs, reviewers, templates] = await Promise.all([
    teachersById(rows.map((s) => s.teacherId)),
    namesFrom("learning_hubs", rows.map((s) => s.hubId)),
    namesFrom("users", rows.map((s) => s.reviewerId)),
    namesFrom("qa_templates", rows.map((s) => s.templateId)),
  ]);
  return rows.map((s) => ({
    id: s.id, teacherId: s.teacherId, teacherName: teacherName(teachers.get(s.teacherId)), hubId: s.hubId, hubName: hubs.get(s.hubId) || null,
    templateId: s.templateId, templateName: templates.get(s.templateId) || null, reviewerId: s.reviewerId, reviewerName: reviewers.get(s.reviewerId) || null,
    frequency: s.frequency, visitType: s.visitType, startDate: s.startDate, endDate: s.endDate, status: s.status, createdAt: s.createdAt,
  }));
}

async function loadSchedule(ctx, id) {
  const schedule = await QaModel.findSchedule(id);
  if (!schedule || schedule.ownerAdminId !== ctx.ownerAdminId) fail("Schedule not found", 404);
  if (ctx.kind === "supervisor" && schedule.reviewerId !== ctx.userId && !(await reviewableTeacherIds(ctx)).includes(schedule.teacherId)) fail("Schedule not found", 404);
  return schedule;
}

const QaService = {
  contextOf,
  keepCurrent,
  generateAll,
  sendNotices,

  // ---- Templates ----

  async listTemplates(req, { status } = {}) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    const rows = await QaModel.listTemplates({ ownerAdminId: ctx.ownerAdminId, status: status || undefined });
    const ids = rows.map((t) => t.id);
    const [visitCounts, scheduleCounts, makers] = await Promise.all([
      ids.length ? db("qa_visits").whereIn("templateId", ids).whereNot({ status: "cancelled" }).select("templateId").count({ n: "*" }).groupBy("templateId") : [],
      ids.length ? db("qa_schedules").whereIn("templateId", ids).where({ status: "active" }).select("templateId").count({ n: "*" }).groupBy("templateId") : [],
      namesFrom("users", rows.map((t) => t.createdBy)),
    ]);
    const visits = new Map(visitCounts.map((r) => [r.templateId, Number(r.n)]));
    const schedules = new Map(scheduleCounts.map((r) => [r.templateId, Number(r.n)]));
    return rows.map((t) => ({
      id: t.id, name: t.name, description: t.description, status: t.status,
      sectionCount: t.sections.length, itemCount: t.sections.reduce((n, s) => n + (s.criteria?.length || 0), 0),
      createdByName: makers.get(t.createdBy) || null, updatedAt: t.updatedAt,
      visits: visits.get(t.id) || 0, schedules: schedules.get(t.id) || 0, canEdit: canEditTemplate(ctx, t),
    }));
  },

  async getTemplate(req, id) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    const t = await loadTemplate(ctx, id);
    return { id: t.id, ...templateBody(t), status: t.status, canEdit: canEditTemplate(ctx, t) };
  },

  // A new template starts from the default rubric scale when none is given.
  async createTemplate(req, data) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    const template = normaliseTemplate({ ...data, scale: data.scale?.length ? data.scale : DEFAULT_SCALE });
    const problems = templateProblems(template);
    if (problems.length) throw problemsError(problems);
    const created = await QaModel.createTemplate({ ...template, ownerAdminId: ctx.ownerAdminId, status: "active", createdBy: ctx.userId, updatedBy: ctx.userId });
    return this.getTemplate(req, created.id);
  },

  // Changing a template changes the visits not started yet; reports already begun keep their copy.
  async updateTemplate(req, id, data) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    const before = await loadTemplate(ctx, id);
    if (!canEditTemplate(ctx, before)) fail("Only the person who made this template (or an admin) can change it", 403);
    const template = normaliseTemplate(data);
    const problems = templateProblems(template);
    if (problems.length) throw problemsError(problems);
    await QaModel.updateTemplate(id, { ...template, updatedBy: ctx.userId });
    return this.getTemplate(req, id);
  },

  async setTemplateStatus(req, id, status) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    const template = await loadTemplate(ctx, id);
    if (!canEditTemplate(ctx, template)) fail("Only the person who made this template (or an admin) can archive it", 403);
    await QaModel.updateTemplate(id, { status, updatedBy: ctx.userId });
    return this.getTemplate(req, id);
  },

  // Refused while any visit or schedule uses it (UsageService) — archive it instead.
  async deleteTemplate(req, res, id) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    const template = await loadTemplate(ctx, id);
    if (!canEditTemplate(ctx, template)) fail("Only the person who made this template (or an admin) can delete it", 403);
    if (await UsageService.guardDelete(req, res, "qaTemplate", id, "This template")) return null;
    await QaModel.deleteTemplate(id);
    return { deleted: true };
  },

  // ---- Who can be visited, where, and by whom ----

  // The educators this person reviews, each with their hubs, supervisor, last report and next visit.
  async listEducators(req) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    await keepCurrent(ctx.ownerAdminId);
    const ids = await reviewableTeacherIds(ctx);
    if (!ids.length) return [];
    const today = todayInKenya();
    const [teachers, hubs, visits] = await Promise.all([
      teachersById(ids),
      hubsOfTeachers(ids, ctx.ownerAdminId),
      db("qa_visits").whereIn("teacherId", ids).where({ ownerAdminId: ctx.ownerAdminId }).whereNot({ status: "cancelled" })
        .select("id", "teacherId", "status", "scheduledDate", "score", "visitType").orderBy("scheduledDate", "asc"),
    ]);
    const supervisors = await namesFrom("users", [...teachers.values()].map((t) => t.supervisorId));
    return ids.map((id) => {
      const t = teachers.get(id);
      if (!t) return null;
      const mine = visits.filter((v) => v.teacherId === id);
      const reports = mine.filter((v) => v.status === "submitted");
      const last = reports[reports.length - 1] || null;
      const next = mine.find((v) => v.status === "open" && v.scheduledDate >= today) || null;
      const due = mine.filter((v) => v.status === "open" && v.scheduledDate <= today).length;
      return {
        id, name: teacherName(t), email: t.email || null, photo: t.photo || null, status: t.status || "active",
        supervisorId: t.supervisorId || null, supervisorName: supervisors.get(t.supervisorId) || null,
        hubs: hubs.get(id) || [],
        reports: reports.length,
        averageScore: reports.length && reports.some((v) => v.score != null)
          ? Math.round((reports.filter((v) => v.score != null).reduce((n, v) => n + Number(v.score), 0) / reports.filter((v) => v.score != null).length) * 10) / 10
          : null,
        lastReport: last ? { id: last.id, date: last.scheduledDate, score: last.score == null ? null : Number(last.score) } : null,
        nextVisit: next ? { id: next.id, date: next.scheduledDate, visitType: next.visitType } : null,
        due,
      };
    }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
  },

  async reviewers(req) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    return reviewerOptions(ctx);
  },

  // ---- Schedules ----

  async listSchedules(req, { status, teacherId } = {}) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    let q = db("qa_schedules").where({ ownerAdminId: ctx.ownerAdminId });
    if (ctx.kind === "supervisor") {
      const mine = await reviewableTeacherIds(ctx);
      q = q.where((w) => w.where({ reviewerId: ctx.userId }).orWhereIn("teacherId", mine.length ? mine : ["__none__"]));
    }
    if (status) q = q.where({ status });
    if (teacherId) q = q.where({ teacherId });
    return decorateSchedules(await q.orderBy("createdAt", "desc"));
  },

  async createSchedule(req, data) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    await assertReviewable(ctx, data.teacherId);
    const teacher = await teacherOf(data.teacherId);
    const hubId = await checkHub(ctx, data.teacherId, data.hubId);
    await usableTemplate(ctx, data.templateId);
    const reviewerId = await resolveReviewer(ctx, data.reviewerId, teacher);
    const today = todayInKenya();
    let schedule;
    await QaModel.transaction(async (trx) => {
      schedule = await QaModel.createSchedule({
        ownerAdminId: ctx.ownerAdminId, teacherId: data.teacherId, hubId, templateId: data.templateId, reviewerId,
        frequency: data.frequency, visitType: data.visitType, startDate: data.startDate,
        generateFrom: data.startDate > today ? data.startDate : today, status: "active", createdBy: ctx.userId, updatedBy: ctx.userId,
      }, trx);
      await QaModel.insertVisitsIgnoringExisting(visitRowsFor(schedule, schedule.generateFrom, today), trx);
    });
    await sendNotices(ctx.ownerAdminId);
    return (await decorateSchedules([await QaModel.findSchedule(schedule.id)]))[0];
  },

  // The upcoming visits not started yet follow the change; a new frequency or first date replaces
  // them with a new set. Visits begun, and past ones, keep their own record.
  async updateSchedule(req, id, data) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    const before = await loadSchedule(ctx, id);
    if (before.status !== "active") fail("This schedule has ended — set up a new one instead", 409);
    if (data.teacherId !== before.teacherId) fail("A schedule stays with its educator — end it and set up a new one for someone else", 409);
    const teacher = await teacherOf(before.teacherId);
    const hubId = await checkHub(ctx, before.teacherId, data.hubId);
    if (data.templateId !== before.templateId) await usableTemplate(ctx, data.templateId);
    const reviewerId = await resolveReviewer(ctx, data.reviewerId, teacher);
    const today = todayInKenya();
    const timingChanged = data.frequency !== before.frequency || data.startDate !== before.startDate;
    await QaModel.transaction(async (trx) => {
      const schedule = await QaModel.updateSchedule(id, {
        hubId, templateId: data.templateId, reviewerId, frequency: data.frequency, visitType: data.visitType, startDate: data.startDate, updatedBy: ctx.userId,
        ...(timingChanged ? { generateFrom: data.startDate > today ? data.startDate : today } : {}),
      }, trx);
      if (timingChanged) {
        await untouchedUpcoming(trx, id, today).del();
        await QaModel.insertVisitsIgnoringExisting(visitRowsFor(schedule, schedule.generateFrom, today), trx);
      } else {
        await untouchedUpcoming(trx, id, today).update({ hubId, templateId: data.templateId, reviewerId, visitType: data.visitType, updatedAt: new Date() });
      }
    });
    await sendNotices(ctx.ownerAdminId);
    return (await decorateSchedules([await QaModel.findSchedule(id)]))[0];
  },

  async endSchedule(req, id) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    const schedule = await loadSchedule(ctx, id);
    if (schedule.status !== "active") fail("This schedule has already ended", 409);
    const today = todayInKenya();
    let removed = 0;
    await QaModel.transaction(async (trx) => {
      await QaModel.updateSchedule(id, { status: "ended", endDate: today < schedule.startDate ? schedule.startDate : today, updatedBy: ctx.userId }, trx);
      removed = await untouchedUpcoming(trx, id, today).del();
    });
    return { ended: true, removedVisits: removed };
  },

  // ---- Visits ----

  async listVisits(req, filters) {
    const ctx = contextOf(req);
    const today = todayInKenya();
    const empty = { visits: [], total: 0, page: filters.page, limit: filters.limit, counts: {}, today };
    if ((ctx.kind === "hub" && !ctx.hubId) || (ctx.kind === "educator" && !ctx.teacherId) || (isReviewerKind(ctx) && !ctx.ownerAdminId)) return empty;
    if (ctx.kind === "educator") {
      for (const owner of await db("qa_visits").where({ teacherId: ctx.teacherId }).distinct("ownerAdminId").pluck("ownerAdminId")) await keepCurrent(owner);
    } else {
      await keepCurrent(ctx.ownerAdminId);
    }
    let q = (await visibleFilter(ctx))(QaModel.visitsQuery());
    if (filters.teacherId) q = q.where({ teacherId: filters.teacherId });
    if (filters.hubId && ctx.kind !== "hub") q = q.where({ hubId: filters.hubId });

    const views = {
      due: (x) => x.where({ status: "open" }).where("scheduledDate", "<=", today),
      upcoming: (x) => x.where({ status: "open" }).where("scheduledDate", ">", today),
      submitted: (x) => x.where({ status: "submitted" }),
      cancelled: (x) => x.where({ status: "cancelled" }),
      all: (x) => x,
    };
    const counts = {};
    for (const [key, apply] of Object.entries(views)) {
      if (key !== "all") counts[key] = Number((await apply(q.clone()).count({ n: "*" }).first())?.n || 0);
    }
    const listed = views[filters.view](q.clone());
    const total = Number((await listed.clone().count({ n: "*" }).first())?.n || 0);
    const rows = await QaModel.findVisits(listed.clone()
      .orderBy("scheduledDate", filters.view === "upcoming" ? "asc" : "desc")
      .limit(filters.limit).offset((filters.page - 1) * filters.limit));
    return { visits: await decorateVisits(rows, today, ctx), total, page: filters.page, limit: filters.limit, counts, today };
  },

  // One visit, as this person may see it.
  //   reviewers   everything, the template to answer, and the educator's last few reports.
  //   educator    once the report is in: all of it, and their reply.
  //   hub         once the report is in: the score, per section, the strengths and areas to improve.
  async getVisit(req, id) {
    const ctx = contextOf(req);
    const today = todayInKenya();
    const { visit, teacher } = await loadVisit(ctx, id);
    const [view] = await decorateVisits([visit], today, ctx);
    const submitted = visit.status === "submitted";

    if (isReviewerKind(ctx)) {
      const writable = canWorkOnVisit(ctx, visit, teacher) && visit.status !== "cancelled";
      let template = visit.template;
      if (!template) {
        const current = await QaModel.findTemplate(visit.templateId);
        template = current ? templateBody(current) : null;
      }
      const earlierRows = await QaModel.findVisits(QaModel.visitsQuery()
        .where({ teacherId: visit.teacherId, ownerAdminId: visit.ownerAdminId, status: "submitted" }).whereNot({ id })
        .orderBy("scheduledDate", "desc").limit(4));
      return {
        ...view,
        template,
        answers: visit.answers || {},
        summary: visit.summary || {},
        score: visit.score,
        sectionScores: visit.sectionScores || [],
        startedAt: visit.startedAt,
        reply: visit.reply || null,
        repliedAt: visit.repliedAt,
        earlier: (await decorateVisits(earlierRows, today, ctx)).map((v) => ({ id: v.id, scheduledDate: v.scheduledDate, score: v.score, reviewerName: v.reviewerName, visitType: v.visitType })),
        reviewers: writable && visit.status === "open" ? await reviewerOptions(ctx) : [],
        hubs: writable && visit.status === "open" ? await hubsOfTeacher(visit.teacherId, visit.ownerAdminId) : [],
        permissions: {
          canReview: writable,
          canEdit: writable && visit.status === "open",
          canChangeTemplate: writable && visit.status === "open" && !visit.startedAt,
        },
      };
    }

    if (ctx.kind === "educator") {
      return {
        ...view,
        ...(submitted ? {
          template: visit.template,
          answers: visit.answers || {},
          summary: visit.summary || {},
          score: visit.score,
          sectionScores: visit.sectionScores || [],
          reply: visit.reply || null,
          repliedAt: visit.repliedAt,
        } : {}),
        permissions: { canReply: submitted },
      };
    }

    // The hub: a summary of the report.
    return {
      ...view,
      ...(submitted ? {
        score: visit.score,
        sectionScores: visit.sectionScores || [],
        summary: { strengths: visit.summary?.strengths || "", improvements: visit.summary?.improvements || "" },
      } : {}),
      permissions: {},
    };
  },

  // A visit planned on its own — ahead of time, or recorded on the day.
  async createVisit(req, data) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    await assertReviewable(ctx, data.teacherId);
    const teacher = await teacherOf(data.teacherId);
    const hubId = await checkHub(ctx, data.teacherId, data.hubId);
    await usableTemplate(ctx, data.templateId);
    const reviewerId = await resolveReviewer(ctx, data.reviewerId, teacher);
    const visit = await QaModel.createVisit({
      ownerAdminId: ctx.ownerAdminId, scheduleId: null, occurrenceDate: null, scheduledDate: data.scheduledDate,
      teacherId: data.teacherId, hubId, templateId: data.templateId, reviewerId, visitType: data.visitType, status: "open",
      createdBy: ctx.userId, updatedBy: ctx.userId,
    });
    await sendNotices(ctx.ownerAdminId);
    return this.getVisit(req, visit.id);
  },

  // Moving an open visit, or changing how it's done. A new date for an announced visit tells the
  // educator again (sendNotices — the notice is keyed by date).
  async updateVisit(req, id, data) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    const { visit, teacher } = await loadVisit(ctx, id);
    if (!canWorkOnVisit(ctx, visit, teacher)) fail("Visit not found", 404);
    if (visit.status !== "open") fail(visit.status === "submitted" ? "This visit's report is in — it can't be moved" : "This visit was cancelled", 409);
    if (data.templateId !== visit.templateId) {
      if (visit.startedAt) fail("The review has been started on this template — it can't be changed now", 409);
      await usableTemplate(ctx, data.templateId);
    }
    const hubId = await checkHub(ctx, visit.teacherId, data.hubId);
    const reviewerId = await resolveReviewer(ctx, data.reviewerId, teacher);
    await QaModel.updateVisit(id, { scheduledDate: data.scheduledDate, visitType: data.visitType, templateId: data.templateId, hubId, reviewerId, updatedBy: ctx.userId });
    await sendNotices(ctx.ownerAdminId);
    return this.getVisit(req, id);
  },

  async cancelVisit(req, id) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    const { visit, teacher } = await loadVisit(ctx, id);
    if (!canWorkOnVisit(ctx, visit, teacher)) fail("Visit not found", 404);
    if (visit.status !== "open") fail(visit.status === "submitted" ? "This visit's report is in — it can't be cancelled" : "This visit is already cancelled", 409);
    await QaModel.updateVisit(id, { status: "cancelled", updatedBy: ctx.userId });
    return this.getVisit(req, id);
  },

  // Saves the review — kept to finish later, or sent (`submit`). Sending needs every yes / no and
  // rubric item answered, and the strengths and areas to improve; it fixes the day of the visit,
  // works out the score and tells the educator (the first time). A sent report can be corrected.
  async saveReview(req, id, body) {
    const ctx = contextOf(req);
    requireReviewer(ctx);
    const today = todayInKenya();
    let firstSubmit = false;
    let teacherRow = null;
    await QaModel.transaction(async (trx) => {
      const { visit, teacher } = await loadVisit(ctx, id, { forUpdate: true, connection: trx });
      teacherRow = teacher;
      if (!canWorkOnVisit(ctx, visit, teacher)) fail("Visit not found", 404);
      if (visit.status === "cancelled") fail("This visit was cancelled", 409);
      let template = visit.template;
      if (!template) {
        const current = await QaModel.findTemplate(visit.templateId, trx);
        if (!current) fail("This visit's template no longer exists — choose another one for it", 409);
        template = templateBody(current);
      }
      const answers = cleanAnswers(template, body.answers);
      const summary = { strengths: body.summary?.strengths || "", improvements: body.summary?.improvements || "", remarks: body.summary?.remarks || "" };
      const { score, sectionScores } = scoreReview(template, answers);
      const sending = body.submit || visit.status === "submitted";
      const visitDate = body.visitDate || visit.scheduledDate;
      if (sending) {
        const problems = reviewProblems(template, answers, summary);
        if (visitDate > today) problems.push("The visit can't be in the future — choose the day you visited");
        if (problems.length) throw problemsError(problems);
      }
      firstSubmit = sending && visit.status !== "submitted";
      await QaModel.updateVisit(id, {
        template, answers, summary, score, sectionScores,
        startedAt: visit.startedAt || new Date(),
        updatedBy: ctx.userId,
        ...(sending ? { status: "submitted", scheduledDate: visitDate } : {}),
        ...(firstSubmit ? { submittedAt: new Date(), submittedBy: ctx.userId } : {}),
      }, trx);
    });
    if (firstSubmit) {
      const visit = await QaModel.findVisit(id);
      const reviewerName = (await namesFrom("users", [visit.reviewerId])).get(visit.reviewerId) || "Your supervisor";
      await QaNotifications.submitted(visit, teacherRow, reviewerName);
    }
    return this.getVisit(req, id);
  },

  // The educator's reply to their report — changeable; the reviewer is told the first time.
  async saveReply(req, id, { reply }) {
    const ctx = contextOf(req);
    if (ctx.kind !== "educator") fail("Only the educator visited can reply", 403);
    const { visit, teacher } = await loadVisit(ctx, id);
    if (visit.status !== "submitted") fail("You can reply once the report is in", 409);
    if (!hasContent(reply)) fail("Write your reply");
    const first = !visit.repliedAt;
    await QaModel.updateVisit(id, { reply, repliedAt: new Date() });
    if (first) await QaNotifications.replied(visit, teacher);
    return this.getVisit(req, id);
  },
};

module.exports = QaService;
module.exports._internal = { visitRowsFor, generateAll, sendNotices };

const db = require("../../config/db");
const R = require("./removal.rules");
const TeacherModel = require("../teachers/teacher.model");
const TeacherHubLinkModel = require("../teachers/teacher-hub-link.model");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const LearningHubModel = require("../learning-hubs/learning-hub.model");
const { cantTeachReason } = require("../teachers/teacher.validation");
const { todayInKenya } = require("../checkins/checkin.dates");

// Removing an educator (modules/removals/removal.service.js says how the steps fit together).
//
// Handed over to another educator: the classes and courses they teach (keeping who's the main
// educator), their timetable slots and moved sessions, Home Learning children, the hubs they're
// Account Manager / Training Lead of (with the check-ins), hub check-ins they take part in, open
// check-in tasks, parent–mentor check-in rounds still to come, and mentor sessions still to come
// (or cancelled — the family's money then becomes a refund due).
// By itself on delete: QA visit schedules about them end, open QA visits about them are cancelled,
// their availability goes, families' open requests for them are closed, their public profile is off.
// Kept under their name: claims, QA reports, parent reviews, sessions held, attendance taken, work
// marked, reports, their TOT learner record — so the record stays as a tombstone (status
// "removed", email cleared) when there's any of that, and their login is retired, not deleted.

const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const lower = (s) => String(s || "").trim().toLowerCase();
const nameOf = (t) => [t?.firstName, t?.lastName].filter(Boolean).join(" ").trim() || "Educator";
const classLabel = (c) => (c ? [c.gradeName, c.streamName].filter(Boolean).join(" ").trim() || "A class" : "A class");
const byId = async (table, ids, columns) => {
  const unique = [...new Set(ids.filter(Boolean))];
  return new Map((unique.length ? await db(table).whereIn("id", unique).select(columns) : []).map((r) => [r.id, r]));
};
const jsonHas = (column, id) => [`CAST(?? AS CHAR) LIKE ?`, [column, `%${id}%`]];

async function workspaceHubIds(ownerAdminId) {
  return (await LearningHubModel.findAll({ ownerAdminId, includeDrafts: true })).map((h) => h.id);
}

async function loginOf(teacher) {
  if (!teacher?.email) return null;
  return db("users").whereRaw("LOWER(email) = ?", [lower(teacher.email)]).first();
}

async function load(req, id) {
  const person = await TeacherModel.findById(id);
  if (!person) fail("Educator not found", 404);
  const ownerAdminId = req.ownerAdminId;
  // This workspace's: made by it, or linked to one of its hubs (teacher.controller.js's isLinkedToOwnHub).
  let mine = Boolean(ownerAdminId) && person.createdByAdminId === ownerAdminId;
  if (!mine) {
    const own = new Set(await workspaceHubIds(ownerAdminId));
    mine = (await TeacherHubLinkModel.findByTeacherId(id)).some((l) => own.has(l.hubId));
  }
  if (!mine) fail("Educator not found", 404);
  return { req, id, person, ownerAdminId, login: await loginOf(person) };
}

function describe({ person }) {
  return {
    id: person.id,
    name: nameOf(person),
    detail: person.email || person.removedEmail || null,
    status: person.status,
    deactivated: ["inactive", "removed"].includes(person.status),
    removed: person.status === "removed",
    removedAt: person.removedAt || null,
  };
}

// ---- What they hold ----------------------------------------------------------------------------

async function holdings(ctx) {
  const { id, login } = ctx;
  const userId = login?.id || null;
  const today = todayInKenya();
  const items = [];

  // Classes and courses they teach.
  const links = await ClassCourseTeacherLinkModel.findByTeacherId(id);
  const classes = await byId("classes", links.map((l) => l.classId), ["id", "gradeName", "streamName", "schoolId"]);
  const courses = await byId("courses", links.map((l) => l.courseId), ["id", "name"]);
  for (const l of links) {
    items.push({
      key: R.itemKey("classCourse", l.id), type: "classCourse", group: "Classes they teach", id: l.id,
      label: `${classLabel(classes.get(l.classId))} — ${courses.get(l.courseId)?.name || "a course"}`,
      detail: l.isPrimary ? "Main educator" : "Co-educator",
    });
  }

  // Timetable slots naming them, and moved sessions still to come.
  const slots = await db("timetable_slots").where({ teacherId: id }).select("id", "classId", "dayOfWeek", "startTime", "endTime");
  const slotClasses = await byId("classes", slots.map((s) => s.classId), ["id", "gradeName", "streamName"]);
  for (const s of slots) {
    items.push({
      key: R.itemKey("slot", s.id), type: "slot", group: "Timetable", id: s.id,
      label: `${s.dayOfWeek} ${s.startTime}–${s.endTime}`, detail: classLabel(slotClasses.get(s.classId)),
    });
  }
  const skips = await db("timetable_session_skips").where({ teacherId: id }).where("newDate", ">=", today).select("id", "classId", "newDate", "startTime");
  const skipClasses = await byId("classes", skips.map((s) => s.classId), ["id", "gradeName", "streamName"]);
  for (const s of skips) {
    items.push({
      key: R.itemKey("skip", s.id), type: "skip", group: "Timetable", id: s.id,
      label: `Moved session on ${String(s.newDate).slice(0, 10)}${s.startTime ? ` at ${s.startTime}` : ""}`, detail: classLabel(skipClasses.get(s.classId)),
    });
  }
  for (const c of await db("classes").where({ classTeacherId: id }).select("id", "gradeName", "streamName")) {
    items.push({ key: R.itemKey("classTeacher", c.id), type: "classTeacher", group: "Classes they teach", id: c.id, label: `Class teacher of ${classLabel(c)}` });
  }

  // Home Learning children.
  const hl = await db("home_learning_enrollments").where({ educatorId: id }).whereIn("status", ["active", "paused"]).select("id", "learnerId", "status");
  const hlLearners = await byId("learners", hl.map((e) => e.learnerId), ["id", "firstName", "lastName"]);
  for (const e of hl) {
    items.push({
      key: R.itemKey("homeLearning", e.id), type: "homeLearning", group: "Home Learning children", id: e.id,
      label: nameOf(hlLearners.get(e.learnerId)) || "A child", detail: e.status === "paused" ? "Paused" : null,
    });
  }

  if (userId) {
    // Hubs they lead check-ins for.
    const hubs = await db("learning_hubs").whereNot({ status: "removed" })
      .where((w) => w.where({ accountManagerId: userId }).orWhere({ trainingLeadId: userId })).select("id", "name", "accountManagerId", "trainingLeadId");
    for (const h of hubs) {
      for (const field of ["accountManagerId", "trainingLeadId"]) {
        if (h[field] !== userId) continue;
        items.push({
          key: R.itemKey("hubLead", `${h.id}~${field}`), type: "hubLead", group: "Hub check-ins", id: `${h.id}~${field}`,
          label: `${field === "accountManagerId" ? "Account Manager" : "Training Lead"} of ${h.name}`, detail: "Needs someone with a login",
        });
      }
    }
    // Hub check-ins they take part in.
    const schedules = await db("checkin_schedules").where({ status: "active" }).whereRaw(...jsonHas("participants", userId)).select("id", "hubId");
    const scheduleHubs = await byId("learning_hubs", schedules.map((s) => s.hubId), ["id", "name"]);
    for (const s of schedules) {
      items.push({
        key: R.itemKey("checkinParticipant", s.id), type: "checkinParticipant", group: "Hub check-ins", id: s.id,
        label: `Takes part in ${scheduleHubs.get(s.hubId)?.name || "a hub"}'s check-ins`, detail: "Needs someone with a login",
      });
    }
    // Open check-in tasks.
    const tasks = await db("checkin_tasks").where({ assigneeId: userId, status: "open" }).select("id", "title", "dueDate", "hubId");
    for (const t of tasks) {
      items.push({
        key: R.itemKey("checkinTask", t.id), type: "checkinTask", group: "Hub check-ins", id: t.id,
        label: String(t.title || "A task").replace(/<[^>]*>/g, "").slice(0, 120), detail: t.dueDate ? `Due ${String(t.dueDate).slice(0, 10)}` : null,
      });
    }
  }

  // Parent–mentor check-in rounds with meetings still to come.
  const rounds = await db("mentor_checkin_rounds").where({ status: "published" }).whereRaw(...jsonHas("educatorIds", id)).select("id", "classId", "windowStart", "windowEnd");
  const roundClasses = await byId("classes", rounds.map((r) => r.classId), ["id", "gradeName", "streamName"]);
  for (const r of rounds) {
    const ahead = await db("mentor_checkin_meetings").where({ roundId: r.id }).where("date", ">=", today).whereNot({ status: "cancelled" }).first("id");
    if (!ahead) continue;
    items.push({
      key: R.itemKey("mentorRound", r.id), type: "mentorRound", group: "Parent check-ins", id: r.id,
      label: `Parent check-ins for ${classLabel(roundClasses.get(r.classId))}`, detail: `${String(r.windowStart).slice(0, 10)} – ${String(r.windowEnd).slice(0, 10)}`,
    });
  }

  // Mentor sessions still to come.
  const bookings = await db("mentor_bookings").where({ teacherId: id }).whereIn("status", ["held", "confirmed"]).where("date", ">=", today)
    .select("id", "learnerId", "date", "startTime", "status");
  const bookingLearners = await byId("learners", bookings.map((b) => b.learnerId), ["id", "firstName", "lastName"]);
  for (const b of bookings) {
    items.push({
      key: R.itemKey("booking", b.id), type: "booking", group: "Mentor sessions to come", id: b.id, canCancel: true,
      label: `${nameOf(bookingLearners.get(b.learnerId))} — ${String(b.date).slice(0, 10)} at ${b.startTime}`,
      detail: b.status === "held" ? "Waiting for payment" : "Paid",
    });
  }
  return items;
}

// Educators of this workspace who can take work: not this one, able to teach (cantTeachReason).
async function candidates(ctx) {
  const ownHubIds = await workspaceHubIds(ctx.ownerAdminId);
  const linked = ownHubIds.length ? await db("teacher_hub_links").whereIn("hubId", ownHubIds).distinct("teacherId").pluck("teacherId") : [];
  const created = await TeacherModel.findIdsCreatedByAdmin(ctx.ownerAdminId);
  const ids = [...new Set([...linked, ...created])].filter((tid) => tid !== ctx.id);
  if (!ids.length) return [];
  const teachers = (await TeacherModel.findAll({ ids })).filter((t) => !cantTeachReason(t));
  const emails = teachers.map((t) => lower(t.email)).filter(Boolean);
  const withLogin = new Set(emails.length ? (await db("users").whereRaw(`LOWER(email) IN (${emails.map(() => "?").join(",")})`, emails).pluck("email")).map(lower) : []);
  return teachers
    .map((t) => ({ id: t.id, name: nameOf(t), detail: withLogin.has(lower(t.email)) ? t.email : `${t.email || "No email"} · no login yet`, hasLogin: withLogin.has(lower(t.email)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Handing one item over ---------------------------------------------------------------------

async function receiver(toId, { needsLogin = false } = {}) {
  const to = await TeacherModel.findById(toId);
  if (!to) fail("Educator not found", 404);
  const cant = cantTeachReason(to);
  if (cant) fail(`${nameOf(to)}: ${cant}`, 409);
  const login = needsLogin ? await loginOf(to) : null;
  if (needsLogin && !login) fail(`${nameOf(to)} has no login yet — give them one on their page first, or choose someone else`, 409);
  return { to, login };
}

const HANDLERS = {
  async classCourse(ctx, item, toId) {
    const link = await db("class_course_teacher_links").where({ id: item.id }).first();
    if (!link) return;
    const { to } = await receiver(toId);
    if (to.qualifiedCourseIds?.length && !to.qualifiedCourseIds.includes(link.courseId)) fail(`${nameOf(to)} isn't qualified to teach this course`, 409);
    await ClassCourseTeacherLinkModel.link(link.classId, link.courseId, toId);
    if (link.isPrimary) await ClassCourseTeacherLinkModel.setPrimary(link.classId, link.courseId, toId);
    await ClassCourseTeacherLinkModel.unlink(link.classId, link.courseId, ctx.id);
    const cls = await db("classes").where({ id: link.classId }).first("schoolId");
    if (cls?.schoolId) await TeacherHubLinkModel.link(toId, cls.schoolId);
  },

  async slot(ctx, item, toId) {
    const slot = await db("timetable_slots").where({ id: item.id }).first();
    if (!slot) return;
    const { to } = await receiver(toId);
    const { hasConflict } = require("../timetable/timetable.service");
    if (await hasConflict({ ...slot, teacherId: toId, excludeId: slot.id })) fail(`${nameOf(to)} is teaching somewhere else then (${slot.dayOfWeek} ${slot.startTime})`, 409);
    await db("timetable_slots").where({ id: item.id }).update({ teacherId: toId, updatedAt: new Date() });
  },

  async skip(ctx, item, toId) {
    await receiver(toId);
    await db("timetable_session_skips").where({ id: item.id }).update({ teacherId: toId });
  },

  async classTeacher(ctx, item, toId) {
    await receiver(toId);
    await db("classes").where({ id: item.id }).update({ classTeacherId: toId, updatedAt: new Date() });
  },

  async homeLearning(ctx, item, toId) {
    const e = await db("home_learning_enrollments").where({ id: item.id }).first();
    if (!e) return;
    await receiver(toId);
    // Through Home Learning's own path, so the child's class links follow (syncEducatorLinks).
    await require("../home-learning/home-learning.service").setEnrollment(e.ownerAdminId, e.householdId, {
      learnerId: e.learnerId, curriculumId: e.curriculumId, gradeId: e.gradeId, educatorId: toId, status: e.status,
    });
  },

  async hubLead(ctx, item, toId) {
    const [hubId, field] = item.id.split("~");
    const hub = await db("learning_hubs").where({ id: hubId }).first();
    const fromUserId = ctx.login?.id;
    if (!hub || !fromUserId || hub[field] !== fromUserId) return;
    const { to, login } = await receiver(toId, { needsLogin: true });
    const other = field === "accountManagerId" ? "trainingLeadId" : "accountManagerId";
    if (hub[other] === login.id) fail(`${nameOf(to)} is already ${other === "accountManagerId" ? "the Account Manager" : "the Training Lead"} of ${hub.name} — choose someone else`, 409);
    await db("learning_hubs").where({ id: hubId }).update({ [field]: login.id, updatedAt: new Date() });
    const CheckinService = require("../checkins/checkin.service");
    await CheckinService.applyHubPeople(ctx.req, hubId);
    // Check-ins already due and not reported yet go to the new person too (applyHubPeople moves
    // only those still ahead).
    await db("checkin_sessions").where({ hubId, status: "open", [field]: fromUserId }).update({ [field]: login.id, updatedAt: new Date() });
    await CheckinService.syncHubLeadRole([fromUserId, login.id]);
  },

  async checkinParticipant(ctx, item, toId) {
    const schedule = await db("checkin_schedules").where({ id: item.id }).first();
    const fromUserId = ctx.login?.id;
    if (!schedule || !fromUserId) return;
    const { login } = await receiver(toId, { needsLogin: true });
    const { syncParticipants, participantsOfSchedule } = require("../checkins/checkin.service")._internal;
    const list = participantsOfSchedule(schedule);
    const leads = [schedule.accountManagerId, schedule.trainingLeadId];
    const next = list.filter((p) => p.userId !== fromUserId && p.userId !== login.id);
    if (!leads.includes(login.id)) next.push({ userId: login.id, kind: list.find((p) => p.userId === fromUserId)?.kind || "mentor" });
    await db("checkin_schedules").where({ id: schedule.id }).update({ participants: JSON.stringify(next), updatedAt: new Date() });
    await syncParticipants({ ...schedule, participants: next }, { replace: true });
  },

  async checkinTask(ctx, item, toId) {
    const task = await db("checkin_tasks").where({ id: item.id }).first();
    if (!task || task.status !== "open") return;
    const { login } = await receiver(toId, { needsLogin: true });
    await db("checkin_tasks").where({ id: task.id }).update({ assigneeId: login.id, updatedBy: ctx.req.user.id, updatedAt: new Date() });
    const hub = await db("learning_hubs").where({ id: task.hubId }).first("name");
    await require("../checkins/checkin.notifications").taskAssigned({ ...task, assigneeId: login.id }, hub?.name || "a hub", ctx.req.user.name || "Our team");
  },

  async mentorRound(ctx, item, toId) {
    const round = await db("mentor_checkin_rounds").where({ id: item.id }).first();
    if (!round) return;
    await receiver(toId);
    let ids = round.educatorIds;
    if (typeof ids === "string") { try { ids = JSON.parse(ids); } catch { ids = []; } }
    const next = [...new Set((Array.isArray(ids) ? ids : []).map((x) => (x === ctx.id ? toId : x)))];
    await db("mentor_checkin_rounds").where({ id: round.id }).update({ educatorIds: JSON.stringify(next), updatedAt: new Date() });
  },

  async booking(ctx, item, target) {
    const MentorBookingService = require("../mentor-bookings/mentor-booking.service");
    if (target === R.CANCEL) {
      await MentorBookingService.cancel(ctx.req, item.id, { reason: "The mentor is no longer with us — we're sorry. Anything paid will be refunded." });
      return;
    }
    await MentorBookingService.reassignMentor(ctx.req, item.id, target);
  },
};

async function transferItem(ctx, item, target) {
  const handler = HANDLERS[item.type];
  if (!handler) fail("This can't be handed over here", 400);
  await handler(ctx, item, target);
}

// ---- Settle, automatic, history ------------------------------------------------------------------

// Nothing must be sorted out elsewhere for an educator: open claims stay theirs and are still paid.
async function toSettle() {
  return [];
}

async function automaticCounts(ctx) {
  const [qaSchedules, qaVisits, availability, requests] = await Promise.all([
    db("qa_schedules").where({ teacherId: ctx.id, status: "active" }).count({ n: "*" }).first(),
    db("qa_visits").where({ teacherId: ctx.id, status: "open" }).count({ n: "*" }).first(),
    db("teacher_availability_slots").where({ teacherId: ctx.id }).count({ n: "*" }).first(),
    db("mentor_requests").where({ teacherId: ctx.id, status: "open" }).count({ n: "*" }).first(),
  ]);
  return { qaSchedules: Number(qaSchedules?.n || 0), qaVisits: Number(qaVisits?.n || 0), availability: Number(availability?.n || 0), requests: Number(requests?.n || 0) };
}

async function automatic(ctx) {
  const n = await automaticCounts(ctx);
  return [
    n.qaSchedules && `${R.counted(n.qaSchedules, "QA visit schedule", "QA visit schedules")} about them will end`,
    n.qaVisits && `${R.counted(n.qaVisits, "planned QA visit", "planned QA visits")} about them will be cancelled`,
    n.availability && `Their availability (${R.counted(n.availability, "time", "times")}) will be cleared`,
    n.requests && `${R.counted(n.requests, "family's request", "families' requests")} for them will be closed`,
    ctx.person.profilePublic && "Their public profile will come down",
    ctx.login && "Their Educator sign-in will stop (any other role on the same login stays)",
  ].filter(Boolean);
}

async function runAutomatic(ctx) {
  const now = new Date();
  const today = todayInKenya();
  const by = ctx.req.user.id;
  const schedules = await db("qa_schedules").where({ teacherId: ctx.id, status: "active" }).select("id", "startDate");
  for (const s of schedules) {
    await db("qa_schedules").where({ id: s.id }).update({ status: "ended", endDate: String(s.startDate).slice(0, 10) > today ? s.startDate : today, updatedBy: by, updatedAt: now });
  }
  await db("qa_visits").where({ teacherId: ctx.id, status: "open" }).update({ status: "cancelled", updatedBy: by, updatedAt: now });
  await db("teacher_availability_slots").where({ teacherId: ctx.id }).del();
  await db("mentor_requests").where({ teacherId: ctx.id, status: "open" }).update({ status: "handled", handledBy: by, handledAt: now });
}

const count = async (q) => Number((await q.count({ n: "*" }).first())?.n || 0);

async function history(ctx) {
  const { id } = ctx;
  const userId = ctx.login?.id || null;
  const [claims, qa, reviews, sessions, attendance, marked, reports, trainee, taught, checkinReports] = await Promise.all([
    count(db("teacher_claims").where({ teacherId: id })),
    count(db("qa_visits").where({ teacherId: id, status: "submitted" })),
    count(db("mentor_reviews").where({ teacherId: id })),
    count(db("mentor_bookings").where({ teacherId: id }).whereIn("status", ["completed", "no_show"])),
    count(db("attendance").where({ markedBy: id })),
    count(db("assessment_submissions").where({ gradedBy: id })),
    count(db("reports").where((w) => w.where({ publishedBy: id }).orWhere({ generatedBy: id }))),
    count(db("learners").where({ teacherId: id })),
    count(db("session_occurrences").where({ taughtBy: id })),
    userId ? count(db("checkin_sessions").where({ reportSubmittedBy: userId })) : 0,
  ]);
  return [
    claims && R.counted(claims, "claim", "claims"),
    qa && R.counted(qa, "QA report", "QA reports"),
    reviews && R.counted(reviews, "parent review", "parent reviews"),
    sessions && R.counted(sessions, "mentor session held", "mentor sessions held"),
    taught && R.counted(taught, "session taught", "sessions taught"),
    attendance && R.counted(attendance, "attendance mark", "attendance marks"),
    marked && R.counted(marked, "piece of work marked", "pieces of work marked"),
    reports && R.counted(reports, "report", "reports"),
    checkinReports && R.counted(checkinReports, "hub check-in report", "hub check-in reports"),
    trainee && "Their own training record (TOT)",
  ].filter(Boolean);
}

// ---- Deactivate and delete -----------------------------------------------------------------------

async function deactivate(ctx) {
  await TeacherModel.update(ctx.id, { status: "inactive" });
}

// The Educator role comes off their login only when no other educator record still uses the email.
async function loginToRelease(ctx) {
  if (!ctx.login) return null;
  const others = await db("teachers").whereRaw("LOWER(email) = ?", [lower(ctx.person.email)]).whereNot({ id: ctx.id }).whereNot({ status: "removed" }).first("id");
  return others ? null : ctx.login;
}

async function remove(ctx, { history: kept = [] } = {}) {
  const AuthService = require("../auth/auth.service");
  const login = await loginToRelease(ctx);
  if (!kept.length) {
    await require("../teachers/teacher.service").deleteTeacher(ctx.id);
    if (login) await AuthService.dropRole(login, "teacher");
    return "deleted";
  }
  await TeacherHubLinkModel.deleteByTeacherId(ctx.id);
  await ClassCourseTeacherLinkModel.deleteByTeacherId(ctx.id);
  await db("teachers").where({ id: ctx.id }).update({
    status: "removed", removedAt: new Date(), removedBy: ctx.req.user.id, removedEmail: ctx.person.email || null, email: null,
    profilePublic: false, createdByAdminId: ctx.person.createdByAdminId || ctx.ownerAdminId, updatedAt: new Date(),
  });
  if (login) await AuthService.retireRole(login, "teacher");
  return "tombstone";
}

module.exports = { load, describe, holdings, candidates, transferItem, toSettle, automatic, runAutomatic, history, deactivate, remove };

const db = require("../../config/db");
const { generateId } = require("../../shared/utils/model.utils");
const { todayInKenya, addDays } = require("../checkins/checkin.dates");
const { rolesOf } = require("../auth/account-roles");
const Notify = require("./session-cover.notifications");

/*
 * Session covers (19 Nov 2026) — one educator teaches one session of another's class.
 *
 *   ask       the class's educator (or the hub / admin) picks any educator in the workspace for one
 *             session on its calendar date — same-hub educators listed first, each with whether
 *             they're free then (their timetable, other covers, mentor bookings);
 *   answer    the cover educator accepts or declines (accepting is enough — no approval step);
 *   teach     an accepted cover puts the session on the cover educator's calendar ("Covering for
 *             …") and opens a cover page for it: the plan, the class list for attendance, Mark as
 *             taught. Their access is that class on that date only — marking stays with the class's
 *             educator;
 *   records   whoever taught it gets it: the session comes off the class educator's claim and
 *             teaching hours and onto the cover educator's (claims/ "covers", educator stats);
 *   families  hear the day before ("Tomorrow's Python session will be taught by …");
 *   changes   the class's side cancels, the cover educator withdraws; a session that moves off its
 *             date (rescheduled, new start date, slot changed) cancels the cover and tells both.
 *
 * Who may do what is checked in the controller (class access) and here (the cover's own people).
 */

const TABLE = "session_covers";
const ACTIVE = ["pending", "accepted"];
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const personName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
const classLabel = (cls) => [cls?.gradeName, cls?.streamName].filter(Boolean).join(" — ").trim() || "Class";
const toMinutes = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
const overlaps = (aStart, aEnd, bStart, bEnd) => toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const weekdayOf = (date) => { const [y, m, d] = date.split("-").map(Number); return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]; };

// Required lazily — the timetable reaches back here for its calendar labels.
const Timetable = () => require("../timetable/timetable.service");

async function teacherLoginIds(teacherIds) {
  const teachers = teacherIds.length ? await db("teachers").whereIn("id", [...new Set(teacherIds)]).select("id", "email") : [];
  const emails = teachers.map((t) => (t.email || "").toLowerCase()).filter(Boolean);
  if (!emails.length) return new Map();
  const users = await db("users").whereIn(db.raw("LOWER(email)"), emails).whereNull("deactivatedAt").select("id", "email", "role", "extraRoles");
  const byEmail = new Map(users.filter((u) => rolesOf(u).includes("teacher")).map((u) => [u.email.toLowerCase(), u.id]));
  return new Map(teachers.map((t) => [t.id, byEmail.get((t.email || "").toLowerCase()) || null]));
}

// The session as the calendar places it on that date, or null when it isn't there.
async function sessionOn(classId, courseId, sessionId, date) {
  const { events } = await Timetable().resolveCalendar({ classId, from: date, to: date });
  return events.find((e) => e.sessionId === sessionId && e.courseId === courseId && e.date === date) || null;
}

async function loadContext(cover) {
  const [cls, course, session, coverTeacher, original] = await Promise.all([
    db("classes").where({ id: cover.classId }).first("id", "gradeName", "streamName", "schoolId", "curriculumId"),
    db("courses").where({ id: cover.courseId }).first("id", "name"),
    db("course_sessions").where({ id: cover.sessionId }).first("id", "title", "order"),
    db("teachers").where({ id: cover.coverTeacherId }).first("id", "firstName", "lastName", "email", "phone"),
    cover.originalTeacherId ? db("teachers").where({ id: cover.originalTeacherId }).first("id", "firstName", "lastName", "email") : null,
  ]);
  const hub = cls?.schoolId ? await db("learning_hubs").where({ id: cls.schoolId }).first("id", "name") : null;
  return { cls, course, session, coverTeacher, original, hub };
}

// What a list or page shows about one cover.
function shape(cover, ctx) {
  return {
    id: cover.id,
    status: cover.status,
    date: cover.date,
    startTime: cover.startTime,
    endTime: cover.endTime,
    note: cover.note,
    declineReason: cover.declineReason,
    cancelReason: cover.cancelReason,
    requestedByKind: cover.requestedByKind,
    classId: cover.classId,
    courseId: cover.courseId,
    sessionId: cover.sessionId,
    className: classLabel(ctx.cls),
    hubName: ctx.hub?.name || null,
    courseName: ctx.course?.name || "Course",
    sessionTitle: ctx.session?.title || null,
    sessionOrder: ctx.session?.order ?? null,
    coverTeacherId: cover.coverTeacherId,
    coverTeacherName: personName(ctx.coverTeacher) || "Educator",
    originalTeacherId: cover.originalTeacherId,
    originalTeacherName: personName(ctx.original) || null,
    claimed: Boolean(cover.claimId),
    createdAt: cover.createdAt,
  };
}

async function shapeAll(rows) {
  const out = [];
  for (const row of rows) out.push(shape(row, await loadContext(row)));
  return out;
}

// Every educator of this workspace: linked to one of its hubs, or created by it. Active only.
async function workspaceEducators(ownerAdminId) {
  const hubIds = await db("learning_hubs").where({ ownerAdminId }).pluck("id");
  const linked = hubIds.length ? await db("teacher_hub_links").whereIn("hubId", hubIds).distinct("teacherId").pluck("teacherId") : [];
  const created = await db("teachers").where({ createdByAdminId: ownerAdminId }).pluck("id");
  const ids = [...new Set([...linked, ...created])];
  if (!ids.length) return [];
  const rows = await db("teachers").whereIn("id", ids).select("id", "firstName", "lastName", "email", "status");
  return rows.filter((t) => (t.status || "active") === "active");
}

// Whether a teacher is busy at [start, end) on `date`: their weekly timetable (their own slots, or
// open slots of a course they teach), their other covers that day, and mentor sessions booked then.
async function busyReason(teacherId, date, startTime, endTime, { excludeCoverId = null } = {}) {
  if (!startTime || !endTime) return null;
  const weekday = weekdayOf(date);
  const own = await db("timetable_slots").where({ teacherId, dayOfWeek: weekday }).select("startTime", "endTime");
  const links = await db("class_course_teacher_links").where({ teacherId }).select("classId", "courseId");
  const linkKeys = new Set(links.map((l) => `${l.classId}|${l.courseId}`));
  const open = links.length
    ? (await db("timetable_slots").whereIn("classId", [...new Set(links.map((l) => l.classId))]).whereNull("teacherId").where({ dayOfWeek: weekday }).select("classId", "courseId", "startTime", "endTime"))
      .filter((s) => linkKeys.has(`${s.classId}|${s.courseId}`))
    : [];
  if ([...own, ...open].some((s) => overlaps(startTime, endTime, s.startTime, s.endTime))) return "Teaching their own class then";
  const covers = await db(TABLE).where({ coverTeacherId: teacherId, date }).whereIn("status", ACTIVE).modify((q) => { if (excludeCoverId) q.whereNot({ id: excludeCoverId }); }).select("startTime", "endTime");
  if (covers.some((c) => overlaps(startTime, endTime, c.startTime, c.endTime))) return "Already covering another session then";
  if (await db.schema.hasTable("mentor_bookings")) {
    const bookings = await db("mentor_bookings").where({ teacherId, date }).whereNotIn("status", ["cancelled", "declined"]).select("startTime", "minutes");
    if (bookings.some((b) => { const end = toMinutes(b.startTime) + Number(b.minutes || 0); return toMinutes(startTime) < end && toMinutes(b.startTime) < toMinutes(endTime); })) return "Has a mentor session then";
  }
  return null;
}

async function getCover(id) {
  const cover = await db(TABLE).where({ id }).first();
  if (!cover) fail("Cover not found", 404);
  return cover;
}

const lastRun = { at: 0 };

const SessionCoverService = {
  // Who could cover this session: every educator in the workspace except those already teaching
  // this course in the class — same-hub educators first, then the rest, each with whether they're
  // free then and whether they can sign in (only someone with a login can accept).
  async candidates({ cls, courseId, sessionId, date, ownerAdminId }) {
    const event = await sessionOn(cls.id, courseId, sessionId, date);
    if (!event) fail("That session isn't on the class's calendar on that date", 404);
    const teaching = new Set(await db("class_course_teacher_links").where({ classId: cls.id, courseId }).pluck("teacherId"));
    const educators = (await workspaceEducators(ownerAdminId)).filter((t) => !teaching.has(t.id));
    const sameHub = new Set(cls.schoolId ? await db("teacher_hub_links").where({ hubId: cls.schoolId }).pluck("teacherId") : []);
    const logins = await teacherLoginIds(educators.map((t) => t.id));
    const out = [];
    for (const t of educators) {
      out.push({
        id: t.id,
        name: personName(t) || t.email || "Educator",
        sameHub: sameHub.has(t.id),
        hasLogin: Boolean(logins.get(t.id)),
        busy: await busyReason(t.id, date, event.startTime, event.endTime),
      });
    }
    out.sort((a, b) => (b.sameHub - a.sameHub) || (Boolean(a.busy) - Boolean(b.busy)) || a.name.localeCompare(b.name));
    return { session: { date, startTime: event.startTime, endTime: event.endTime, sessionTitle: event.sessionTitle || null }, educators: out };
  },

  // Ask an educator to cover one session. `actor`: { kind: educator|hub|admin, userId, teacherId }.
  async request({ cls, courseId, sessionId, date, coverTeacherId, note, actor, ownerAdminId }) {
    if (date < todayInKenya()) fail("That session has already happened — covers are for sessions still to come");
    const event = await sessionOn(cls.id, courseId, sessionId, date);
    if (!event) fail("That session isn't on the class's calendar on that date", 404);
    const existing = await db(TABLE).where({ classId: cls.id, sessionId, date }).whereIn("status", ACTIVE).first("id", "status");
    if (existing) fail(existing.status === "pending" ? "Someone has already been asked to cover this session — cancel that first" : "This session already has a cover", 409);
    const educator = (await workspaceEducators(ownerAdminId)).find((t) => t.id === coverTeacherId);
    if (!educator) fail("Choose an active educator from this workspace", 400);
    const teaching = await db("class_course_teacher_links").where({ classId: cls.id, courseId }).select("teacherId", "isPrimary");
    if (teaching.some((l) => l.teacherId === coverTeacherId)) fail("They already teach this course in this class");
    if (!(await teacherLoginIds([coverTeacherId])).get(coverTeacherId)) fail("They don't have a login yet, so they can't accept — give them one first, or choose someone else");
    const primary = teaching.find((l) => Number(l.isPrimary)) || teaching[0] || null;
    const originalTeacherId = actor.kind === "educator" ? actor.teacherId : primary?.teacherId || null;
    const now = new Date();
    const row = {
      id: generateId(), ownerAdminId, hubId: cls.schoolId || null, classId: cls.id, courseId, sessionId, date,
      startTime: event.startTime || null, endTime: event.endTime || null, originalTeacherId, coverTeacherId,
      requestedByKind: actor.kind, requestedByUserId: actor.userId || null, note: note?.trim() || null,
      status: "pending", createdAt: now, updatedAt: now,
    };
    await db(TABLE).insert(row);
    const ctx = await loadContext(row);
    const login = (await teacherLoginIds([coverTeacherId])).get(coverTeacherId);
    await Notify.requested(row, ctx, login);
    return shape(row, ctx);
  },

  // The cover educator says yes or no.
  async respond({ id, teacherId, decision, reason }) {
    const cover = await getCover(id);
    if (cover.coverTeacherId !== teacherId) fail("This cover wasn't asked of you", 403);
    if (cover.status !== "pending") fail(cover.status === "accepted" ? "You've already accepted this cover" : "This cover is no longer open", 409);
    if (decision === "accept") {
      if (cover.date < todayInKenya()) fail("That session has already happened", 409);
      if (!(await sessionOn(cover.classId, cover.courseId, cover.sessionId, cover.date))) {
        await SessionCoverService._cancel(cover, { reason: "The session moved to another date", byUserId: null, notifyCover: false });
        fail("That session has moved to another date — the cover was cancelled", 409);
      }
      const busy = await busyReason(teacherId, cover.date, cover.startTime, cover.endTime, { excludeCoverId: cover.id });
      if (busy) fail(`You can't accept: ${busy.toLowerCase()}`, 409);
    }
    const status = decision === "accept" ? "accepted" : "declined";
    await db(TABLE).where({ id }).update({ status, respondedAt: new Date(), declineReason: decision === "accept" ? null : reason?.trim() || null, updatedAt: new Date() });
    const updated = await getCover(id);
    const ctx = await loadContext(updated);
    await Notify.answered(updated, ctx, await SessionCoverService._classSideUserIds(updated));
    // Families hear the day before — straight away when that's already today or tomorrow.
    if (status === "accepted" && updated.date <= addDays(todayInKenya(), 1)) await SessionCoverService._notifyFamilies(updated, ctx);
    return shape(updated, ctx);
  },

  // The class's side cancels (`byCoverEducator` false), or the cover educator pulls out (true).
  async cancel({ id, byUserId, byCoverEducator, reason }) {
    const cover = await getCover(id);
    if (!ACTIVE.includes(cover.status)) fail("This cover is no longer open", 409);
    const occurrence = await db("session_occurrences").where({ classId: cover.classId, sessionId: cover.sessionId, date: cover.date }).first("status", "taughtAt");
    if (occurrence?.taughtAt) fail("This session has already been taught", 409);
    return SessionCoverService._cancel(cover, { reason, byUserId, withdrawn: byCoverEducator, notifyCover: !byCoverEducator });
  },

  async _cancel(cover, { reason, byUserId, withdrawn = false, notifyCover = true }) {
    await db(TABLE).where({ id: cover.id }).update({ status: withdrawn ? "withdrawn" : "cancelled", cancelledAt: new Date(), cancelledByUserId: byUserId || null, cancelReason: reason?.trim() || null, updatedAt: new Date() });
    const updated = await getCover(cover.id);
    const ctx = await loadContext(updated);
    if (withdrawn) await Notify.withdrawn(updated, ctx, await SessionCoverService._classSideUserIds(updated));
    else {
      const coverLogin = notifyCover && cover.status !== "declined" ? (await teacherLoginIds([cover.coverTeacherId])).get(cover.coverTeacherId) : null;
      const classSide = byUserId ? [] : await SessionCoverService._classSideUserIds(updated);
      await Notify.cancelled(updated, ctx, [coverLogin, ...classSide].filter(Boolean));
    }
    return shape(updated, ctx);
  },

  // Who asked, and the class's educator being covered — told when the cover educator answers.
  async _classSideUserIds(cover) {
    const ids = [];
    if (cover.requestedByUserId) ids.push(cover.requestedByUserId);
    if (cover.originalTeacherId) ids.push((await teacherLoginIds([cover.originalTeacherId])).get(cover.originalTeacherId));
    return [...new Set(ids.filter(Boolean))];
  },

  async _notifyFamilies(cover, ctx) {
    if (cover.familiesNotifiedAt) return 0;
    const learnerIds = await db("learner_hub_links").where({ classId: cover.classId, status: "active" }).distinct("learnerId").pluck("learnerId");
    for (const learnerId of learnerIds) await Notify.familyNotice(cover, ctx, learnerId);
    await db(TABLE).where({ id: cover.id }).update({ familiesNotifiedAt: new Date(), updatedAt: new Date() });
    return learnerIds.length;
  },

  // A session that no longer sits on its cover's date cancels the cover (both told); accepted covers
  // whose session is tomorrow tell the families. Run by `npm run checkins:process` and, at most every
  // few minutes, when cover lists are opened. `classId` narrows it to one class (after its timetable
  // changes).
  async keepCurrent({ classId = null, force = false } = {}) {
    if (!classId && !force && Date.now() - lastRun.at < 5 * 60 * 1000) return { cancelled: 0, familiesTold: 0 };
    if (!classId) lastRun.at = Date.now();
    const today = todayInKenya();
    const open = await db(TABLE).whereIn("status", ACTIVE).where("date", ">=", today).modify((q) => { if (classId) q.where({ classId }); });
    let cancelled = 0;
    let familiesTold = 0;
    for (const cover of open) {
      try {
        if (!(await sessionOn(cover.classId, cover.courseId, cover.sessionId, cover.date))) {
          await SessionCoverService._cancel(cover, { reason: "The session moved to another date", byUserId: null });
          cancelled += 1;
          continue;
        }
        if (cover.status === "accepted" && !cover.familiesNotifiedAt && cover.date <= addDays(today, 1)) {
          await SessionCoverService._notifyFamilies(cover, await loadContext(cover));
          familiesTold += 1;
        }
      } catch (err) {
        console.error("[session-covers] keeping a cover current failed:", err.message);
      }
    }
    return { cancelled, familiesTold };
  },

  // A teacher's covers: asked of them, and asked by them (or for a class of theirs).
  async listForTeacher(teacherId) {
    await SessionCoverService.keepCurrent();
    const mine = await db(TABLE).where({ coverTeacherId: teacherId }).orderBy("date", "desc").limit(200);
    const theirs = await db(TABLE).where({ originalTeacherId: teacherId }).orderBy("date", "desc").limit(200);
    return { forMe: await shapeAll(mine), forMyClasses: await shapeAll(theirs) };
  },

  // Hub / admin overview: every cover at these hubs.
  async listForHubs(hubIds) {
    await SessionCoverService.keepCurrent();
    if (!hubIds.length) return [];
    return shapeAll(await db(TABLE).whereIn("hubId", hubIds).orderBy("date", "desc").limit(500));
  },

  async getForClassSide(id) {
    const cover = await getCover(id);
    return { cover, ctx: await loadContext(cover) };
  },

  // The cover page: the session, the plan's link, the class list with that day's attendance, and
  // whether it's been marked taught. Only the cover educator, and only once accepted.
  async coverPage({ id, teacherId }) {
    const cover = await getCover(id);
    if (cover.coverTeacherId !== teacherId) fail("This cover isn't yours", 403);
    const ctx = await loadContext(cover);
    const learnerIds = await db("learner_hub_links").where({ classId: cover.classId, status: "active" }).distinct("learnerId").pluck("learnerId");
    const learners = learnerIds.length ? await db("learners").whereIn("id", learnerIds).select("id", "firstName", "lastName", "photo") : [];
    const attendance = await db("attendance").where({ classId: cover.classId }).whereRaw("DATE(date) = ?", [cover.date]).select("learnerId", "status");
    const statusOf = new Map(attendance.map((a) => [a.learnerId, a.status]));
    const occurrence = await db("session_occurrences").where({ classId: cover.classId, sessionId: cover.sessionId, date: cover.date }).first("id", "status", "taughtAt", "taughtBy");
    const event = cover.status === "accepted" && cover.date >= todayInKenya() ? await sessionOn(cover.classId, cover.courseId, cover.sessionId, cover.date) : null;
    return {
      ...shape(cover, ctx),
      meetingLink: event?.meetingLink || null,
      learners: learners
        .map((l) => ({ id: l.id, name: personName(l) || "Learner", photo: l.photo || null, status: statusOf.get(l.id) || null }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      taught: Boolean(occurrence?.taughtAt),
      canTeach: cover.status === "accepted" && cover.date <= todayInKenya(),
    };
  },

  async _ownAccepted(id, teacherId) {
    const cover = await getCover(id);
    if (cover.coverTeacherId !== teacherId) fail("This cover isn't yours", 403);
    if (cover.status !== "accepted") fail("This cover isn't accepted", 409);
    if (cover.date > todayInKenya()) fail("This session hasn't happened yet — come back on the day", 409);
    return cover;
  },

  async markAttendance({ id, teacherId, records }) {
    const cover = await SessionCoverService._ownAccepted(id, teacherId);
    const inClass = new Set(await db("learner_hub_links").where({ classId: cover.classId, status: "active" }).pluck("learnerId"));
    if (records.some((r) => !inClass.has(r.learnerId))) fail("Some of those learners aren't in this class");
    await require("../attendance/attendance.service").markAttendance(cover.classId, cover.date, records, teacherId);
    return SessionCoverService.coverPage({ id, teacherId });
  },

  async markTaught({ id, teacherId, note }) {
    const cover = await SessionCoverService._ownAccepted(id, teacherId);
    const SessionOccurrenceService = require("../timetable/session-occurrence.service");
    await SessionOccurrenceService.syncClassOccurrences(cover.classId, (args) => Timetable().resolveCalendar(args));
    const occurrence = await db("session_occurrences").where({ classId: cover.classId, sessionId: cover.sessionId, date: cover.date }).first("id");
    if (!occurrence) fail("This session isn't on the class's records for that date", 409);
    await SessionOccurrenceService.markTaught(occurrence.id, { actorId: teacherId, note: note || `Covered for ${personName((await loadContext(cover)).original) || "the class's educator"}` });
    return SessionCoverService.coverPage({ id, teacherId });
  },

  // Calendar labels: open covers of one class in [from, to], keyed "sessionId|date".
  async labelsForClass(classId, from, to) {
    const rows = await db(TABLE).where({ classId }).whereIn("status", ACTIVE).whereBetween("date", [from, to]).select("id", "sessionId", "date", "status", "coverTeacherId", "originalTeacherId");
    if (!rows.length) return new Map();
    const names = new Map((await db("teachers").whereIn("id", [...new Set(rows.flatMap((r) => [r.coverTeacherId, r.originalTeacherId]).filter(Boolean))]).select("id", "firstName", "lastName")).map((t) => [t.id, personName(t)]));
    return new Map(rows.map((r) => [`${r.sessionId}|${r.date}`, { id: r.id, status: r.status, coverTeacherId: r.coverTeacherId, coverTeacherName: names.get(r.coverTeacherId) || "Educator", originalTeacherName: names.get(r.originalTeacherId) || null }]));
  },

  // The sessions a teacher is covering in [from, to] — added to their own calendar.
  async coveringEvents(teacherId, from, to) {
    const rows = await db(TABLE).where({ coverTeacherId: teacherId, status: "accepted" }).whereBetween("date", [from, to]);
    const out = [];
    for (const cover of rows) {
      const event = await sessionOn(cover.classId, cover.courseId, cover.sessionId, cover.date);
      if (!event) continue;
      const ctx = await loadContext(cover);
      out.push({ ...event, coveringFor: { coverId: cover.id, originalTeacherName: personName(ctx.original) || null, className: classLabel(ctx.cls) } });
    }
    return out;
  },

  // Sessions of these classes taught by someone else as cover — kept off this teacher's claim.
  async coveredByOthers(teacherId, classIds) {
    if (!classIds.length) return new Set();
    const rows = await db(TABLE).whereIn("classId", classIds).where({ status: "accepted" }).whereNot({ coverTeacherId: teacherId }).select("classId", "sessionId");
    return new Set(rows.map((r) => `${r.classId}|${r.sessionId}`));
  },

  // Curricula of the classes a teacher is covering (recently or soon) — so they can open the
  // session's course content.
  async coverCurriculumIds(teacherId) {
    const classIds = await db(TABLE).where({ coverTeacherId: teacherId, status: "accepted" }).where("date", ">=", addDays(todayInKenya(), -14)).distinct("classId").pluck("classId");
    return classIds.length ? (await db("classes").whereIn("id", classIds).pluck("curriculumId")).filter(Boolean) : [];
  },
};

module.exports = SessionCoverService;
module.exports._internal = { busyReason, workspaceEducators, sessionOn };

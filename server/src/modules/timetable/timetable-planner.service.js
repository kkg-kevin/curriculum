const db = require("../../config/db");
const { todayInKenya, addDays } = require("../checkins/checkin.dates");
const { whereInChunks } = require("../../shared/utils/model.utils");
const { collectCourseIds } = require("../curriculum/versions/content.utils");
const ClassCourseTeacherLinkModel = require("../classes/class-course-teacher-link.model");
const { cantTeachReason } = require("../teachers/teacher.validation");
const { insideStatedHours } = require("../mentor-bookings/availability.rules");
const R = require("./timetable.rules");

// The Timetable Planner (23 Nov 2026): one page for admins (every hub of the workspace) and hubs
// (their own). It reads the whole picture in one request, checks a lesson before it's saved (who is
// busy, who is affected, where its sessions land), sets a lesson up in one step, and copies a
// class's timetable to other classes, at any hub.

const Timetable = () => require("./timetable.service");
const Clashes = () => require("../mentor-bookings/mentor-booking.clashes");
const fail = (message, statusCode = 400, extra = {}) => { throw Object.assign(new Error(message), { statusCode, ...extra }); };
const fullName = (p) => [p?.firstName, p?.lastName].filter(Boolean).join(" ").trim();
const classLabel = (c) => `${c.gradeName}${c.streamName ? ` — ${c.streamName}` : ""}`;
const hhmm = (t) => String(t || "").slice(0, 5);
const parseJson = (v) => { if (typeof v !== "string") return v; try { return JSON.parse(v); } catch { return null; } };
const dayName = (d) => d.charAt(0).toUpperCase() + d.slice(1);
const pair = (a, b) => `${a}|${b}`;

// The hubs this person plans: an admin's whole workspace, a hub login the hub it's working in.
async function hubsFor(req) {
  if (req.user.role === "school") return req.ownSchool ? [req.ownSchool] : [];
  const rows = await db("learning_hubs").where({ ownerAdminId: req.ownerAdminId }).select("id", "name", "status", "deliveryMode", "isHomeLearning");
  return rows.filter((h) => h.status !== "removed").sort((a, b) => a.name.localeCompare(b.name));
}

async function loadClass(req, classId) {
  const cls = await db("classes").where({ id: classId }).first();
  const hubs = await hubsFor(req);
  const hub = cls && hubs.find((h) => h.id === cls.schoolId);
  if (!cls || !hub) fail("Class not found", 404);
  return { cls, hub, hubs };
}

// Each class's courses: its curriculum's published version for its grade, in one read per curriculum.
async function courseIdsByClass(classes) {
  const curriculumIds = [...new Set(classes.map((c) => c.curriculumId).filter(Boolean))];
  const versions = curriculumIds.length ? await db("curriculum_versions").whereIn("curriculumId", curriculumIds).where({ isCurrent: true }).select("curriculumId", "content") : [];
  const contentOf = new Map(versions.map((v) => [v.curriculumId, parseJson(v.content) || []]));
  const byPair = new Map();
  const out = new Map();
  for (const c of classes) {
    const key = pair(c.curriculumId, c.gradeId);
    if (!byPair.has(key)) {
      const content = (contentOf.get(c.curriculumId) || []).map((p) => ({ ...p, classes: (p.classes || []).filter((x) => x.classId === c.gradeId) }));
      byPair.set(key, [...collectCourseIds(content)].filter(Boolean));
    }
    out.set(c.id, byPair.get(key));
  }
  return out;
}

const teachersOfLesson = (lesson, links) => (lesson.teacherId ? [lesson.teacherId] : links.filter((l) => l.classId === lesson.classId && l.courseId === lesson.courseId).map((l) => l.teacherId));

const TimetablePlanner = {
  async overview(req, { hubId = null } = {}) {
    const all = await hubsFor(req);
    const hubs = hubId ? all.filter((h) => h.id === hubId) : all.filter((h) => !h.isHomeLearning);
    if (hubId && !hubs.length) fail("Hub not found", 404);
    const hubIds = hubs.map((h) => h.id);
    const classes = hubIds.length ? await db("classes").whereIn("schoolId", hubIds).where({ status: "active" }).select("id", "schoolId", "curriculumId", "gradeId", "gradeName", "streamName", "academicYear") : [];
    const classIds = classes.map((c) => c.id);
    const [slots, anchors, links, enrolled, rooms, hubLinks, courseIdLists] = await Promise.all([
      whereInChunks(db, "timetable_slots", "classId", classIds),
      whereInChunks(db, "timetable_course_schedules", "classId", classIds),
      whereInChunks(db, "class_course_teacher_links", "classId", classIds),
      classIds.length ? db("learner_hub_links").whereIn("classId", classIds).where({ status: "active" }).groupBy("classId").select("classId").count({ n: "*" }) : [],
      hubIds.length ? db("rooms").whereIn("hubId", hubIds).where({ status: "active" }).select("id", "hubId", "name", "capacity") : [],
      hubIds.length ? db("teacher_hub_links").whereIn("hubId", hubIds).select("teacherId", "hubId") : [],
      courseIdsByClass(classes),
    ]);

    const courseIds = [...new Set([...[...courseIdLists.values()].flat(), ...slots.map((s) => s.courseId), ...links.map((l) => l.courseId)])].filter(Boolean);
    const courses = await whereInChunks(db, "courses", "id", courseIds);
    const courseName = new Map(courses.map((c) => [c.id, c.name]));
    const sessionCounts = courseIds.length ? await db("course_sessions").whereIn("courseId", courseIds).groupBy("courseId").select("courseId").count({ n: "*" }) : [];
    const sessionsOf = new Map(sessionCounts.map((s) => [s.courseId, Number(s.n)]));
    const teacherIds = [...new Set([...hubLinks.map((l) => l.teacherId), ...links.map((l) => l.teacherId), ...slots.map((s) => s.teacherId).filter(Boolean)])];
    const teachers = await whereInChunks(db, "teachers", "id", teacherIds);
    const teacherById = new Map(teachers.map((t) => [t.id, t]));
    const roomName = new Map(rooms.map((r) => [r.id, r.name]));
    const learners = new Map(enrolled.map((e) => [e.classId, Number(e.n)]));
    const hubById = new Map(hubs.map((h) => [h.id, h]));
    const today = todayInKenya();

    const shaped = classes.map((c) => {
      const classLinks = links.filter((l) => l.classId === c.id);
      const classAnchors = new Map(anchors.filter((a) => a.classId === c.id).map((a) => [a.courseId, R.dayKey(a.startDate)]));
      const educatorsByCourse = new Map();
      for (const l of classLinks) educatorsByCourse.set(l.courseId, [...(educatorsByCourse.get(l.courseId) || []), { id: l.teacherId, name: fullName(teacherById.get(l.teacherId)) || "Educator", isPrimary: !!l.isPrimary }]);
      const classSlots = slots.filter((s) => s.classId === c.id);
      const lessonCourseIds = [...new Set([...(courseIdLists.get(c.id) || []), ...classSlots.map((s) => s.courseId), ...classLinks.map((l) => l.courseId)])];
      const lessons = classSlots.map((s) => {
        const educators = s.teacherId ? [{ id: s.teacherId, name: fullName(teacherById.get(s.teacherId)) || "Educator" }] : educatorsByCourse.get(s.courseId) || [];
        const startDate = classAnchors.get(s.courseId) || null;
        return {
          id: s.id, classId: c.id, courseId: s.courseId, courseName: courseName.get(s.courseId) || "Course", teacherId: s.teacherId || null,
          educatorIds: educators.map((e) => e.id), educatorName: educators.map((e) => e.name).join(", "),
          dayOfWeek: s.dayOfWeek, startTime: hhmm(s.startTime), endTime: hhmm(s.endTime), roomId: s.roomId || null, roomName: roomName.get(s.roomId) || null,
          startDate, started: !!startDate && startDate <= today,
        };
      }).sort((a, b) => R.DAYS.indexOf(a.dayOfWeek) - R.DAYS.indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime));
      return {
        id: c.id, hubId: c.schoolId, hubName: hubById.get(c.schoolId)?.name || "", label: classLabel(c), gradeId: c.gradeId, gradeName: c.gradeName, streamName: c.streamName || "",
        curriculumId: c.curriculumId, learners: learners.get(c.id) || 0,
        status: R.classStatus({ lessons: classSlots, educatorsByCourse, datedCourseIds: new Set(classAnchors.keys()) }),
        courses: lessonCourseIds.map((id) => ({ id, name: courseName.get(id) || "Course", sessions: sessionsOf.get(id) || 0, startDate: classAnchors.get(id) || null, educators: educatorsByCourse.get(id) || [] })).sort((a, b) => a.name.localeCompare(b.name)),
        lessons,
      };
    }).sort((a, b) => a.hubName.localeCompare(b.hubName) || a.label.localeCompare(b.label));

    const hubsOfTeacher = new Map();
    for (const l of hubLinks) hubsOfTeacher.set(l.teacherId, [...(hubsOfTeacher.get(l.teacherId) || []), l.hubId]);
    const educators = teachers
      .filter((t) => t.status !== "removed")
      .map((t) => ({ id: t.id, name: fullName(t) || "Educator", status: t.status || "active", canTeach: !cantTeachReason(t), hubIds: hubsOfTeacher.get(t.id) || [], qualifiedCourseIds: parseJson(t.qualifiedCourseIds) || [] }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      today,
      hubOptions: all.filter((h) => !h.isHomeLearning).map((h) => ({ id: h.id, name: h.name })),
      hubs: hubs.map((h) => ({ id: h.id, name: h.name, deliveryMode: h.deliveryMode || null, online: h.deliveryMode === "virtual" })),
      classes: shaped,
      rooms: rooms.map((r) => ({ id: r.id, hubId: r.hubId, name: r.name, capacity: r.capacity ?? null })).sort((a, b) => a.name.localeCompare(b.name)),
      educators,
    };
  },

  // Real dated sessions across the hubs in view (the Today board and the calendar tab).
  async calendar(req, { hubId = null, from, to }) {
    const all = await hubsFor(req);
    const hubs = hubId ? all.filter((h) => h.id === hubId) : all.filter((h) => !h.isHomeLearning);
    if (hubId && !hubs.length) fail("Hub not found", 404);
    const hubIds = hubs.map((h) => h.id);
    const classIds = hubIds.length ? await db("classes").whereIn("schoolId", hubIds).where({ status: "active" }).pluck("id") : [];
    const withLessons = classIds.length ? await db("timetable_slots").whereIn("classId", classIds).distinct("classId").pluck("classId") : [];
    const events = [];
    const breaks = [];
    const skippedSessions = [];
    // A few classes at a time: each one is several queries, and the pool is small on shared hosting.
    for (let i = 0; i < withLessons.length; i += 4) {
      const batch = await Promise.all(withLessons.slice(i, i + 4).map((classId) => Timetable().resolveCalendar({ classId, from, to })));
      for (const r of batch) { events.push(...r.events); breaks.push(...r.breaks); skippedSessions.push(...r.skippedSessions); }
    }
    const seen = new Map();
    for (const b of breaks) {
      const key = `${b.start}:${b.end}:${b.label}`;
      if (seen.has(key)) seen.get(key).classIds.push(...b.classIds);
      else seen.set(key, { ...b, classIds: [...b.classIds] });
    }
    return { data: events, breaks: [...seen.values()], skippedSessions };
  },

  // Before saving: what stops this lesson, what to know about it, who it affects, where it lands.
  async check(req, body) {
    const { cls, hub, hubs } = await loadClass(req, body.classId);
    const { courseId, days, startTime, endTime, roomId = null, teacherId = null, slotId = null } = body;
    const blocks = [];
    const warnings = [];
    if (startTime >= endTime) blocks.push({ type: "times", message: "The end time must be after the start time." });

    const existing = slotId ? await db("timetable_slots").where({ id: slotId, classId: cls.id }).first() : null;
    if (slotId && !existing) fail("Lesson not found", 404);
    const anchor = await db("timetable_course_schedules").where({ classId: cls.id, courseId }).first("startDate");
    const anchorDate = R.dayKey(anchor?.startDate);
    const today = todayInKenya();
    const started = !!anchorDate && anchorDate <= today;
    // A course already running changes from a date, whether a lesson is added or edited.
    const applyFrom = body.correctPast || !started ? null : body.applyFrom || addDays(today, 1);
    if (applyFrom && applyFrom < today) blocks.push({ type: "apply", message: "A change can't start in the past." });

    const links = await db("class_course_teacher_links").where({ classId: cls.id, courseId }).pluck("teacherId");
    const effective = teacherId ? [teacherId] : links;
    const sameCourse = await db("timetable_slots").where({ classId: cls.id, courseId }).select("id", "dayOfWeek");

    const nameCache = new Map();
    const describe = async (slot) => {
      if (!nameCache.has(slot.classId)) {
        const c = await db("classes").where({ id: slot.classId }).first("gradeName", "streamName", "schoolId");
        const h = c ? await db("learning_hubs").where({ id: c.schoolId }).first("name") : null;
        const visible = !!c && hubs.some((x) => x.id === c.schoolId);
        nameCache.set(slot.classId, visible ? `${classLabel(c)}${h?.name && c.schoolId !== hub.id ? ` at ${h.name}` : ""}` : "another class");
      }
      return nameCache.get(slot.classId);
    };
    const teacherRows = effective.length ? await db("teachers").whereIn("id", effective).select("id", "firstName", "lastName", "status", "qualifiedCourseIds") : [];
    const teacherName = (id) => fullName(teacherRows.find((t) => t.id === id)) || "This educator";
    if (teacherId) {
      const t = teacherRows.find((x) => x.id === teacherId);
      const reason = t ? cantTeachReason(t) : "Educator not found";
      if (reason) blocks.push({ type: "educator", message: reason });
      const qualified = parseJson(t?.qualifiedCourseIds) || [];
      if (t && qualified.length && !qualified.includes(courseId)) blocks.push({ type: "educator", message: `${teacherName(teacherId)} isn't qualified to teach this course.` });
    } else if (!links.length) {
      warnings.push({ type: "no_educator", message: "No educator is assigned to this course yet." });
    }

    const windows = effective.length ? await db("teacher_availability_slots").whereIn("teacherId", effective).select("teacherId", "dayOfWeek", "startTime", "endTime") : [];
    let bookingsHit = 0;
    for (const dayOfWeek of days) {
      const label = dayName(dayOfWeek);
      if (sameCourse.some((s) => s.dayOfWeek === dayOfWeek && s.id !== slotId)) blocks.push({ type: "twin", day: dayOfWeek, message: `This course already has a time on ${label} in this class.` });
      if (startTime < endTime) {
        const clash = await Timetable().findClashes({ classId: cls.id, courseId, teacherId, roomId, dayOfWeek, startTime, endTime, excludeId: slotId, validFrom: applyFrom });
        if (clash.classClash) blocks.push({ type: "class", day: dayOfWeek, message: `${classLabel(cls)} already has a lesson on ${label} at that time.` });
        if (clash.roomClash) blocks.push({ type: "room", day: dayOfWeek, message: `That room is taken on ${label} by ${await describe(clash.roomClash)}.` });
        for (const c of clash.teacherClashes) blocks.push({ type: "educator", day: dayOfWeek, message: `${teacherName(c.teacherId)} is teaching ${await describe(c.slot)} on ${label} at that time.` });

        for (const id of effective) {
          const own = windows.filter((w) => w.teacherId === id);
          if (!insideStatedHours(own, { dayOfWeek, startTime, endTime })) warnings.push({ type: "outside_hours", day: dayOfWeek, message: `${label}: outside ${teacherName(id)}'s stated hours. You can still save this.` });
        }
        const travel = await TimetablePlanner._travel(effective, { classId: cls.id, hub, dayOfWeek, startTime, endTime, excludeId: slotId });
        for (const t of travel) warnings.push({ type: "travel", day: dayOfWeek, message: `${label}: ${teacherName(t.teacherId)} has only ${t.gap} minutes to get from ${t.hubName} to ${hub.name}.` });
        const hit = await Clashes().previewForSlot({ classId: cls.id, courseId, teacherIds: effective, dayOfWeek, startTime, endTime });
        bookingsHit += hit.reduce((n, h) => n + h.count, 0);
      }
    }
    if (bookingsHit) warnings.push({ type: "booking", message: `This lands on ${bookingsHit} paid mentor session${bookingsHit === 1 ? "" : "s"}. The ${bookingsHit === 1 ? "family" : "families"} will be asked to pick a new time or take a full refund.` });

    // Where its sessions land.
    const periods = await Timetable().getPeriodsForClass(cls.id);
    const startDate = body.startDate || anchorDate;
    if (startDate && body.startDate && periods.length) {
      const inside = periods.some((p) => p.startDate && p.endDate && startDate >= p.startDate && startDate <= p.endDate);
      if (!inside) blocks.push({ type: "date", message: "That start date is outside this class's run." });
    }
    const sessionCount = Number((await db("course_sessions").where({ courseId }).count({ n: "*" }).first())?.n || 0);
    const otherDays = sameCourse.filter((s) => s.id !== slotId).map((s) => s.dayOfWeek);
    const allDays = [...new Set([...days, ...otherDays])];
    // A course already running carries on from the change with the sessions it has left.
    let remaining = sessionCount;
    if (applyFrom) {
      const { events } = await Timetable().resolveCalendar({ classId: cls.id, from: anchorDate, to: addDays(applyFrom, -1) });
      remaining = Math.max(0, sessionCount - events.filter((e) => e.courseId === courseId).length);
    }
    const placement = R.walkSessions({ startDate: applyFrom || startDate, days: allDays, sessionCount: remaining, isSchedulable: (d) => Timetable().isDateSchedulable(d, periods) });
    if (startDate && remaining && placement.placed < remaining) warnings.push({ type: "run", message: `Only ${placement.placed} of the ${remaining} sessions left fit before this class's run ends.` });

    // Who a change reaches.
    const roster = await db("learner_hub_links").where({ classId: cls.id, status: "active" }).distinct("learnerId").pluck("learnerId");
    const emails = roster.length ? (await db("learners").whereIn("id", roster).pluck("guardianEmail")).filter(Boolean).map((e) => e.toLowerCase()) : [];
    const moved = !existing || existing.dayOfWeek !== days[0] || hhmm(existing.startTime) !== startTime || hhmm(existing.endTime) !== endTime;

    return {
      blocks,
      warnings,
      canSave: blocks.length === 0,
      placement: { startDate: startDate || null, sessions: remaining, continuing: !!applyFrom, ...placement },
      affected: { started, learners: roster.length, families: new Set(emails).size, educators: effective.length, bookings: bookingsHit, willNotify: moved && !!anchorDate },
      applyFrom: applyFrom || null,
      defaultApplyFrom: addDays(today, 1),
      today,
    };
  },

  // This educator's lessons at other physical hubs on that day, too close to get between.
  async _travel(teacherIds, { classId, hub, dayOfWeek, startTime, endTime, excludeId }) {
    if (!teacherIds.length || hub.deliveryMode === "virtual") return [];
    const links = await db("class_course_teacher_links").whereIn("teacherId", teacherIds).select("teacherId", "classId", "courseId");
    const classIds = [...new Set(links.map((l) => l.classId))];
    const named = await db("timetable_slots").whereIn("teacherId", teacherIds).where({ dayOfWeek }).select("id", "classId", "courseId", "teacherId", "startTime", "endTime");
    const open = classIds.length ? await db("timetable_slots").whereIn("classId", classIds).whereNull("teacherId").where({ dayOfWeek }).select("id", "classId", "courseId", "teacherId", "startTime", "endTime") : [];
    const rows = [...named, ...open].filter((s) => s.id !== excludeId && s.classId !== classId);
    if (!rows.length) return [];
    const classes = await db("classes").whereIn("id", [...new Set(rows.map((s) => s.classId))]).select("id", "schoolId");
    const hubOf = new Map(classes.map((c) => [c.id, c.schoolId]));
    const hubRows = await db("learning_hubs").whereIn("id", [...new Set(classes.map((c) => c.schoolId))]).select("id", "name", "deliveryMode");
    const hubById = new Map(hubRows.map((h) => [h.id, h]));
    const lesson = { hubId: hub.id, startTime, endTime, virtual: false };
    const out = [];
    for (const id of teacherIds) {
      const theirs = rows
        .filter((s) => (s.teacherId ? s.teacherId === id : links.some((l) => l.teacherId === id && l.classId === s.classId && l.courseId === s.courseId)))
        .map((s) => { const h = hubById.get(hubOf.get(s.classId)); return { hubId: h?.id, hubName: h?.name || "another hub", virtual: h?.deliveryMode === "virtual", startTime: hhmm(s.startTime), endTime: hhmm(s.endTime) }; });
      for (const problem of R.travelProblems(lesson, theirs)) out.push({ teacherId: id, hubName: problem.hubName, gap: R.gapBetween(lesson, problem) });
    }
    return out;
  },

  // Set a lesson up in one step: its educator, every day chosen and its start date.
  async saveLessons(req, body) {
    const { cls } = await loadClass(req, body.classId);
    if (body.slotId) fail("Use the lesson's own save to change it");
    const check = await TimetablePlanner.check(req, body);
    if (!check.canSave) fail(check.blocks[0].message, 409);
    const { courseId, teacherId = null, roomId = null, days, startTime, endTime, startDate = null, confirmMove = false, applyFrom = null } = body;

    let linked = await db("class_course_teacher_links").where({ classId: cls.id, courseId }).pluck("teacherId");
    if (teacherId && !linked.includes(teacherId)) {
      await ClassCourseTeacherLinkModel.link(cls.id, courseId, teacherId);
      linked = [...linked, teacherId];
    }
    // Named on the lesson only when the course has several educators: otherwise it follows the course.
    const slotTeacher = teacherId && linked.length > 1 ? teacherId : null;
    const created = [];
    try {
      for (const dayOfWeek of days) created.push(await Timetable().createSlot({ classId: cls.id, courseId, teacherId: slotTeacher, roomId, dayOfWeek, startTime, endTime }, { applyFrom }));
      const anchor = await db("timetable_course_schedules").where({ classId: cls.id, courseId }).first("startDate");
      if (startDate && R.dayKey(anchor?.startDate) !== startDate) await Timetable().setCourseSchedule(cls.id, courseId, startDate, { confirmMove });
    } catch (err) {
      // All or nothing: a family never sees half a lesson pattern.
      if (created.length) await db("timetable_slots").whereIn("id", created.map((s) => s.id)).del();
      throw err;
    }
    Clashes().afterClassChangeLater(cls.id);
    return { created: created.length, slots: created };
  },

  // For each chosen class, what copying this class's lessons would do.
  async _planCopy(req, { fromClassId, toClassIds }) {
    const { cls: source, hubs } = await loadClass(req, fromClassId);
    const lessons = await db("timetable_slots").where({ classId: source.id });
    if (!lessons.length) fail("This class has no lessons to copy yet", 409);
    const hubIds = hubs.map((h) => h.id);
    const targets = (await db("classes").whereIn("id", toClassIds).whereIn("schoolId", hubIds).where({ status: "active" }))
      .filter((c) => c.id !== source.id);
    const targetIds = targets.map((c) => c.id);
    const [courseIds, links, slots] = await Promise.all([
      courseIdsByClass(targets),
      whereInChunks(db, "class_course_teacher_links", "classId", targetIds),
      whereInChunks(db, "timetable_slots", "classId", targetIds),
    ]);
    const courseRows = await db("courses").whereIn("id", [...new Set(lessons.map((l) => l.courseId))]).select("id", "name");
    const courseName = new Map(courseRows.map((c) => [c.id, c.name]));
    const hubName = new Map(hubs.map((h) => [h.id, h.name]));
    const reserved = [];
    const rows = [];
    for (const target of targets) {
      const planned = [];
      for (const lesson of lessons) {
        const base = { courseId: lesson.courseId, courseName: courseName.get(lesson.courseId) || "Course", dayOfWeek: lesson.dayOfWeek, startTime: hhmm(lesson.startTime), endTime: hhmm(lesson.endTime) };
        const teachers = links.filter((l) => l.classId === target.id && l.courseId === lesson.courseId).map((l) => l.teacherId);
        if (slots.some((s) => s.classId === target.id && s.courseId === lesson.courseId && s.dayOfWeek === lesson.dayOfWeek)) { planned.push({ ...base, status: "already" }); continue; }
        if (!(courseIds.get(target.id) || []).includes(lesson.courseId)) { planned.push({ ...base, status: "missing_course", message: `${base.courseName} isn't part of this class's curriculum` }); continue; }
        if (!teachers.length) { planned.push({ ...base, status: "missing_educator", message: `No educator for ${base.courseName}` }); continue; }
        const clash = await Timetable().findClashes({ classId: target.id, courseId: lesson.courseId, teacherId: null, roomId: null, dayOfWeek: lesson.dayOfWeek, startTime: base.startTime, endTime: base.endTime });
        const taken = reserved.some((r) => r.dayOfWeek === lesson.dayOfWeek && r.startTime < base.endTime && base.startTime < r.endTime && (r.classId === target.id || r.teachers.some((t) => teachers.includes(t))));
        if (clash.classClash || clash.teacherClashes.length || taken) {
          planned.push({ ...base, status: "clash", message: clash.classClash ? `The class already has a lesson on ${dayName(lesson.dayOfWeek)} then` : `Its educator is teaching elsewhere on ${dayName(lesson.dayOfWeek)} then` });
          continue;
        }
        planned.push({ ...base, status: "ready", teachers });
      }
      const status = R.copyStatus(planned);
      if (status === "ready") {
        for (const p of planned.filter((x) => x.status === "ready")) reserved.push({ classId: target.id, teachers: p.teachers, dayOfWeek: p.dayOfWeek, startTime: p.startTime, endTime: p.endTime });
      }
      rows.push({
        classId: target.id, label: classLabel(target), hubId: target.schoolId, hubName: hubName.get(target.schoolId) || "", status,
        toAdd: planned.filter((p) => p.status === "ready").length,
        problems: [...new Set(planned.filter((p) => p.message).map((p) => p.message))],
        lessons: planned.map(({ teachers, ...p }) => p),
      });
    }
    return { source, lessons, rows };
  },

  async copyPreview(req, body) {
    const { rows } = await TimetablePlanner._planCopy(req, body);
    return { rows, ready: rows.filter((r) => r.status === "ready").length };
  },

  // Copies to every class that's ready; the others are left alone and reported.
  async copyApply(req, { fromClassId, toClassIds, withDates = true }) {
    const { source, lessons, rows } = await TimetablePlanner._planCopy(req, { fromClassId, toClassIds });
    const sourceAnchors = new Map((await db("timetable_course_schedules").where({ classId: source.id })).map((a) => [a.courseId, R.dayKey(a.startDate)]));
    const results = [];
    for (const row of rows) {
      if (row.status !== "ready") { results.push({ classId: row.classId, label: row.label, hubName: row.hubName, copied: false, status: row.status, problems: row.problems }); continue; }
      const created = [];
      try {
        for (const planned of row.lessons.filter((l) => l.status === "ready")) {
          // Rooms belong to one hub and educators to one class, so neither is copied.
          created.push(await Timetable().createSlot({ classId: row.classId, courseId: planned.courseId, teacherId: null, roomId: null, dayOfWeek: planned.dayOfWeek, startTime: planned.startTime, endTime: planned.endTime }));
        }
      } catch (err) {
        if (created.length) await db("timetable_slots").whereIn("id", created.map((s) => s.id)).del();
        results.push({ classId: row.classId, label: row.label, hubName: row.hubName, copied: false, status: "clash", problems: [err.message] });
        continue;
      }
      let datesSet = 0;
      let datesLeft = 0;
      if (withDates) {
        for (const courseId of new Set(lessons.map((l) => l.courseId))) {
          const startDate = sourceAnchors.get(courseId);
          if (!startDate || await db("timetable_course_schedules").where({ classId: row.classId, courseId }).first("id")) continue;
          // A date already past would put sessions on this class's calendar that never happened.
          if (startDate < todayInKenya()) { datesLeft += 1; continue; }
          // Another class's run can differ: a date outside it is left for this class to set.
          try { await Timetable().setCourseSchedule(row.classId, courseId, startDate); datesSet += 1; } catch { datesLeft += 1; }
        }
      }
      Clashes().afterClassChangeLater(row.classId);
      results.push({ classId: row.classId, label: row.label, hubName: row.hubName, copied: true, status: "ready", lessons: created.length, datesSet, datesLeft, problems: [] });
    }
    return { results, copied: results.filter((r) => r.copied).length };
  },

  // What else fills an educator's day, for their calendar.
  async teacherExtras(teacherId, from, to) {
    const out = [];
    const bookings = await db("mentor_bookings").where({ teacherId }).whereIn("status", ["held", "confirmed", "completed"]).whereBetween("date", [from, to])
      .select("id", "learnerId", "date", "startTime", "endTime", "status", "mode", "hubName", "courseName", "clashAt");
    const names = new Map(bookings.length ? (await db("learners").whereIn("id", [...new Set(bookings.map((b) => b.learnerId))]).select("id", "firstName")).map((l) => [l.id, l.firstName]) : []);
    for (const b of bookings) {
      out.push({
        kind: "mentor", id: b.id, date: R.dayKey(b.date), startTime: hhmm(b.startTime), endTime: hhmm(b.endTime), title: "Mentor session",
        subtitle: [names.get(b.learnerId), b.courseName].filter(Boolean).join(" · "), where: b.mode === "online" ? "Online" : b.hubName || "",
        route: `/teacher-portal/bookings/${b.id}`, needsNewTime: !!b.clashAt,
      });
    }
    const roundIds = (await db("mentor_checkin_rounds").where({ status: "published" }).where("windowEnd", ">=", from).where("windowStart", "<=", to).select("id", "educatorIds"))
      .filter((r) => (parseJson(r.educatorIds) || []).includes(teacherId)).map((r) => r.id);
    if (roundIds.length) {
      const meetings = await db("mentor_checkin_meetings").whereIn("roundId", roundIds).whereIn("status", ["scheduled", "held"]).whereBetween("date", [from, to]).select("id", "date", "startTime", "endTime");
      for (const m of meetings) out.push({ kind: "checkin", id: m.id, date: R.dayKey(m.date), startTime: hhmm(m.startTime), endTime: hhmm(m.endTime), title: "Parent check-in", subtitle: "", where: "", route: `/teacher-portal/mentor-checkins/meetings/${m.id}` });
    }
    return out;
  },
};

module.exports = TimetablePlanner;
module.exports._internal = { hubsFor, courseIdsByClass, teachersOfLesson };

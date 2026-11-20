// Curriculum coverage (17 Nov 2026) — how far each class has got through its courses, as of today.
//
// Planned:   every session of each course the class's curriculum + grade currently has.
// Due:       sessions the timetable has already placed on a date up to today (session_occurrences —
//            synced here first, since those rows are otherwise only written on calendar reads).
// Covered:   a due session that was marked taught OR had its attendance taken. Educators often take
//            the register without pressing "taught", so either counts.
// Cancelled: due, but every date it had was cancelled — not covered, shown separately.
// A course with no weekly slot or no start date can't be placed on any date, so it is listed as
// "not scheduled" rather than counted as 0%.
//
// Cumulative, not per period: the period only drives "covered in this period". Learner filters
// (stage, pathway, gender) don't apply — coverage belongs to the class, not to a learner.

const db = require("../../config/db");
const { sessionNumbering, placeFields } = require("../courses/session-numbering");
const CurriculumVersionService = require("../curriculum/versions/curriculum-versions.service");
const TimetableService = require("../timetable/timetable.service");
const SessionOccurrenceService = require("../timetable/session-occurrence.service");
const { pct, inChunks, fullName } = require("./analytics.utils");
const { className, forbidden } = require("./analytics.scope");
const { loadEvidence } = require("./analytics.coverage-evidence");

// session_occurrences use the UTC calendar day (session-occurrence.service.js todayStr) — match it.
const todayUtc = () => new Date().toISOString().slice(0, 10);
const addDaysUtc = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || "").slice(0, 10));

// Behind by this many due sessions or more → "behind"; fewer (but some) → "slightly behind".
const BEHIND = 3;
const STATUS_ORDER = ["behind", "slightly_behind", "not_scheduled", "not_started", "on_pace", "complete"];

const resolveCalendar = (args) => TimetableService.resolveCalendar(args);

// A few classes at a time — each sync walks that class's calendar.
async function eachLimited(items, limit, fn) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await fn(item);
    }
  });
  await Promise.all(workers);
}

function cellStatus({ scheduled, total, covered, due }) {
  if (!scheduled) return "not_scheduled";
  if (total > 0 && covered >= total) return "complete";
  if (due === 0) return "not_started";
  const behind = due - covered;
  if (behind <= 0) return "on_pace";
  return behind < BEHIND ? "slightly_behind" : "behind";
}

// Per session of one (class, course): covered / cancelled / open, from its occurrence rows.
function sessionStates(rows, today) {
  const bySession = new Map();
  for (const o of rows) {
    if (day(o.date) > today) continue;
    const s = bySession.get(o.sessionId) || { covered: false, coveredOn: null, via: null, allCancelled: true, lastDate: null };
    const d = day(o.date);
    const taught = o.status === "taught";
    const attended = o.attendanceState === "taken";
    if (taught || attended) {
      if (!s.coveredOn || d > s.coveredOn) s.coveredOn = d;
      s.covered = true;
      s.via = taught ? "marked" : s.via || "attendance";
    }
    if (o.status !== "cancelled") s.allCancelled = false;
    if (!s.lastDate || d > s.lastDate) s.lastDate = d;
    bySession.set(o.sessionId, s);
  }
  return bySession;
}

// Everything a class needs, loaded in bulk for every class in view.
async function loadClassData(classes) {
  const classIds = classes.map((c) => c.id);
  const [slots, anchors] = await Promise.all([
    inChunks(classIds, (ids) => db("timetable_slots").whereIn("classId", ids).select("classId", "courseId")),
    inChunks(classIds, (ids) => db("timetable_course_schedules").whereIn("classId", ids).select("classId", "courseId", "startDate")),
  ]);
  // Bring each class's occurrence rows up to today before reading them.
  const anchored = [...new Set(anchors.map((a) => a.classId))];
  await eachLimited(anchored, 4, (id) => SessionOccurrenceService.syncClassOccurrences(id, resolveCalendar).catch(() => null));
  const [occurrences, teacherLinks] = await Promise.all([
    inChunks(anchored, (ids) => db("session_occurrences").whereIn("classId", ids).select("classId", "courseId", "sessionId", "date", "status", "attendanceState")),
    inChunks(classIds, (ids) => db("class_course_teacher_links").whereIn("classId", ids).select("classId", "courseId", "teacherId", "isPrimary")),
  ]);
  const teachers = await inChunks(teacherLinks.map((l) => l.teacherId), (ids) => db("teachers").whereIn("id", ids).select("id", "firstName", "lastName"));
  const teacherById = new Map(teachers.map((t) => [t.id, t]));

  const key = (a, b) => `${a}:${b}`;
  const slotKeys = new Set(slots.map((s) => key(s.classId, s.courseId)));
  const anchorByKey = new Map(anchors.map((a) => [key(a.classId, a.courseId), day(a.startDate)]));
  const occByKey = new Map();
  for (const o of occurrences) {
    const k = key(o.classId, o.courseId);
    if (!occByKey.has(k)) occByKey.set(k, []);
    occByKey.get(k).push(o);
  }
  const educatorByKey = new Map();
  for (const l of teacherLinks) {
    const k = key(l.classId, l.courseId);
    if (!educatorByKey.has(k) || l.isPrimary) educatorByKey.set(k, l.teacherId);
  }
  return {
    hasSlot: (c, k) => slotKeys.has(key(c, k)),
    startDate: (c, k) => anchorByKey.get(key(c, k)) || null,
    occurrences: (c, k) => occByKey.get(key(c, k)) || [],
    educator: (c, k) => {
      const t = teacherById.get(educatorByKey.get(key(c, k)));
      return t ? { id: t.id, name: fullName(t) } : null;
    },
  };
}

// The class's courses (its curriculum + grade's current version), one lookup per pair.
function courseLookup() {
  const cache = new Map();
  return (cls) => {
    const k = `${cls.curriculumId}:${cls.gradeId}`;
    if (!cache.has(k)) cache.set(k, CurriculumVersionService.getCurrentCourses(cls.curriculumId, cls.gradeId).catch(() => []));
    return cache.get(k);
  };
}

async function getCoverage(scope) {
  const today = todayUtc();
  const { period } = scope;
  const classes = scope.classes.filter((c) => c.status === "active" && c.curriculumId && c.gradeId);
  const data = await loadClassData(classes);
  const coursesOf = courseLookup();
  const curricula = await inChunks(classes.map((c) => c.curriculumId), (ids) => db("curricula").whereIn("id", ids).select("id", "name"));
  const curriculumName = new Map(curricula.map((c) => [c.id, c.name]));
  const learnersByClass = new Map();
  for (const l of scope.links) if (l.classId) learnersByClass.set(l.classId, (learnersByClass.get(l.classId) || 0) + 1);

  const rows = [];
  const notScheduled = [];
  for (const cls of classes) {
    let courses = await coursesOf(cls);
    if (scope.filters.courseId) courses = courses.filter((c) => c.id === scope.filters.courseId);
    courses = courses.filter((c) => c.sessionCount > 0);
    if (!courses.length) continue;
    const hubName = scope.hubById.get(cls.schoolId)?.name || "";
    const label = className(cls);

    const cells = courses.map((course) => {
      const hasSlot = data.hasSlot(cls.id, course.id);
      const startDate = data.startDate(cls.id, course.id);
      const scheduled = hasSlot && Boolean(startDate);
      const states = sessionStates(data.occurrences(cls.id, course.id), today);
      let covered = 0; let cancelled = 0; let coveredInPeriod = 0; let lastCovered = null;
      for (const s of states.values()) {
        if (s.covered) {
          covered += 1;
          if (s.coveredOn >= period.from && s.coveredOn <= period.to) coveredInPeriod += 1;
          if (!lastCovered || s.coveredOn > lastCovered) lastCovered = s.coveredOn;
        } else if (s.allCancelled) cancelled += 1;
      }
      const total = course.sessionCount;
      const due = Math.min(states.size, total);
      covered = Math.min(covered, total);
      const status = cellStatus({ scheduled, total, covered, due });
      if (!scheduled) {
        notScheduled.push({
          key: `${cls.id}:${course.id}`, classId: cls.id, label, hubName, courseId: course.id, courseName: course.name,
          reason: !hasSlot && !startDate ? "No weekly lessons or start date" : !hasSlot ? "No weekly lessons" : "No start date",
          educator: data.educator(cls.id, course.id)?.name || null,
        });
      }
      return {
        courseId: course.id, courseName: course.name, total, due, covered, cancelled,
        open: Math.max(0, due - covered - cancelled), behind: Math.max(0, due - covered),
        coveredInPeriod, lastCovered, startDate, scheduled, status,
        coverage: pct(covered, total), pace: pct(covered, due),
        educator: data.educator(cls.id, course.id),
      };
    });

    const measured = cells.filter((c) => c.scheduled);
    const sum = (k) => measured.reduce((s, c) => s + c[k], 0);
    const worst = STATUS_ORDER.find((s) => cells.some((c) => c.status === s)) || "not_scheduled";
    rows.push({
      classId: cls.id, label, hubName, curriculumName: curriculumName.get(cls.curriculumId) || "",
      learners: learnersByClass.get(cls.id) || 0,
      total: sum("total"), due: sum("due"), covered: sum("covered"), cancelled: sum("cancelled"), open: sum("open"), behind: sum("behind"),
      coveredInPeriod: sum("coveredInPeriod"),
      coverage: pct(sum("covered"), sum("total")), pace: pct(sum("covered"), sum("due")),
      coursesScheduled: measured.length, courses: cells.length,
      status: measured.length ? worst : "not_scheduled",
      cells,
    });
  }

  // Minimum evidence per class + course (analytics.coverage-evidence.js).
  const cellsByClass = new Map(rows.map((r) => [r.classId, r.cells.map((c) => ({ courseId: c.courseId, courseName: c.courseName }))]));
  const evidence = await loadEvidence(classes.filter((c) => cellsByClass.has(c.id)), cellsByClass);
  for (const r of rows) {
    for (const c of r.cells) c.evidence = evidence.forCell(r.classId, c.courseId);
    r.evidenceShort = r.cells.reduce((n, c) => n + c.evidence.filter((e) => !e.met).length, 0);
  }

  const measuredRows = rows.filter((r) => r.coursesScheduled > 0);
  const total = (k) => measuredRows.reduce((s, r) => s + r[k], 0);
  const statusCounts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
  for (const r of rows) for (const c of r.cells) statusCounts[c.status] += 1;

  return {
    period, asOf: today, behindThreshold: BEHIND,
    classes: rows.length, classesMeasured: measuredRows.length,
    classesNotScheduled: rows.filter((r) => r.coursesScheduled === 0).length,
    planned: total("total"), due: total("due"), covered: total("covered"), cancelled: total("cancelled"),
    open: total("open"), behind: total("behind"), coveredInPeriod: total("coveredInPeriod"),
    coverage: pct(total("covered"), total("total")), pace: pct(total("covered"), total("due")),
    classesBehind: measuredRows.filter((r) => r.status === "behind").length,
    statusCounts,
    rows: rows.sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.behind - a.behind || a.label.localeCompare(b.label)),
    notScheduled,
    evidence: { summary: evidence.summary, needsChoice: evidence.needsChoice },
  };
}

// One class + course, session by session: covered (when, how), cancelled, overdue, or upcoming
// with the date the timetable currently gives it.
async function getCoverageDetail(scope, classId, courseId) {
  const cls = scope.classById.get(classId);
  if (!cls || !cls.curriculumId) throw forbidden("That class isn't in your hubs");
  const course = (await CurriculumVersionService.getCurrentCourses(cls.curriculumId, cls.gradeId)).find((c) => c.id === courseId);
  if (!course) throw Object.assign(new Error("That course isn't part of this class's curriculum"), { statusCode: 404 });
  const today = todayUtc();
  await SessionOccurrenceService.syncClassOccurrences(classId, resolveCalendar).catch(() => null);
  const [sessions, occurrences] = await Promise.all([
    db("course_sessions").where({ courseId }).orderBy("order", "asc").select("id", "title", "order"),
    db("session_occurrences").where({ classId, courseId }).select("sessionId", "date", "status", "attendanceState"),
  ]);
  const states = sessionStates(occurrences, today);
  const numbering = await sessionNumbering(courseId);
  // Upcoming dates: the timetable walked forward a year from tomorrow.
  const upcoming = new Map();
  try {
    const { events } = await resolveCalendar({ classId, from: addDaysUtc(today, 1), to: addDaysUtc(today, 365) });
    for (const e of events) if (e.courseId === courseId && !upcoming.has(e.sessionId)) upcoming.set(e.sessionId, e.date);
  } catch { /* no timetable — every session is simply "not yet reached" */ }

  return {
    classId, label: className(cls), hubName: scope.hubById.get(cls.schoolId)?.name || "", courseId, courseName: course.name, asOf: today,
    sessions: sessions.map((s, i) => {
      const st = states.get(s.id);
      const state = !st ? (upcoming.has(s.id) ? "upcoming" : "unscheduled") : st.covered ? "covered" : st.allCancelled ? "cancelled" : "open";
      return {
        // Numbered within its module (19 Nov 2026).
        ...(() => { const n = numbering.get(s.id)?.number ?? i + 1; return { sessionId: s.id, number: n, moduleName: numbering.get(s.id)?.moduleName ?? null, title: s.title || `Session ${n}` }; })(), state,
        date: st ? (st.covered ? st.coveredOn : st.lastDate) : upcoming.get(s.id) || null,
        via: st?.via || null,
      };
    }),
  };
}

module.exports = { getCoverage, getCoverageDetail };

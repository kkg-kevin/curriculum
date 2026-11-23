const db = require("../../config/db");
const { addDays } = require("../checkins/checkin.dates");
const { weekdayOf } = require("../mentor-checkins/mentor-checkin.rules");
const { hhmm } = require("./availability.rules");

// When an educator is really teaching, date by date — the one answer bookings, parent check-ins and
// the availability planner all use (23 Nov 2026). It comes from the calendar engine
// (TimetableService.resolveCalendar), so term breaks, courses that have finished, and shifted,
// merged or moved sessions are right. A slot counts for an educator when it names them, or names
// nobody on a course they teach.
//
//   - a session someone else has agreed to cover leaves their time free;
//   - a session they've agreed to cover counts;
//   - a weekly slot whose course has no start date yet counts every week (`undated`): the class is
//     on the timetable, so a family shouldn't book over it the week before it starts.

// Required lazily — the timetable reaches back to bookings when it changes.
const Timetable = () => require("../timetable/timetable.service");
const Covers = () => require("../session-covers/session-cover.service");

const pairKey = (classId, courseId) => `${classId}|${courseId}`;
const classLabel = (c) => [c?.gradeName, c?.streamName].filter(Boolean).join(" — ").trim() || "Class";

async function classTimes(teacherId, from, to) {
  const links = await db("class_course_teacher_links").where({ teacherId }).select("classId", "courseId");
  const named = await db("timetable_slots").where({ teacherId }).distinct("classId").pluck("classId");
  const linked = new Set(links.map((l) => pairKey(l.classId, l.courseId)));
  const classIds = [...new Set([...links.map((l) => l.classId), ...named])];
  const theirs = (e) => (e.teacherId ? e.teacherId === teacherId : linked.has(pairKey(e.classId, e.courseId)));

  const out = [];
  if (classIds.length) {
    const results = await Promise.all(classIds.map((classId) => Timetable().resolveCalendar({ classId, from, to })));
    for (const e of results.flatMap((r) => r.events)) {
      if (!theirs(e) || !e.startTime || !e.endTime) continue;
      if (e.cover?.status === "accepted" && e.cover.coverTeacherId !== teacherId) continue;
      out.push({ date: e.date, startTime: hhmm(e.startTime), endTime: hhmm(e.endTime), classId: e.classId, courseId: e.courseId });
    }

    const anchors = await db("timetable_course_schedules").whereIn("classId", classIds).select("classId", "courseId");
    const dated = new Set(anchors.map((a) => pairKey(a.classId, a.courseId)));
    const waiting = (await db("timetable_slots").whereIn("classId", classIds).select("classId", "courseId", "teacherId", "dayOfWeek", "startTime", "endTime"))
      .filter((s) => theirs(s) && !dated.has(pairKey(s.classId, s.courseId)));
    if (waiting.length) {
      for (let date = from, guard = 0; date <= to && guard < 400; date = addDays(date, 1), guard += 1) {
        const day = weekdayOf(date);
        for (const s of waiting.filter((x) => x.dayOfWeek === day)) {
          out.push({ date, startTime: hhmm(s.startTime), endTime: hhmm(s.endTime), classId: s.classId, courseId: s.courseId, undated: true });
        }
      }
    }
  }

  const covering = await Covers().coveringEvents(teacherId, from, to).catch(() => []);
  for (const e of covering) {
    if (e.startTime && e.endTime) out.push({ date: e.date, startTime: hhmm(e.startTime), endTime: hhmm(e.endTime), classId: e.classId, courseId: e.courseId, covering: true });
  }

  // A merged day carries two sessions at one time: it's one class to the educator.
  const seen = new Set();
  const unique = out.filter((c) => {
    const key = `${c.date}|${c.classId}|${c.courseId}|${c.startTime}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!unique.length) return [];

  const classRows = await db("classes").whereIn("id", [...new Set(unique.map((c) => c.classId))]).select("id", "gradeName", "streamName");
  const courseRows = await db("courses").whereIn("id", [...new Set(unique.map((c) => c.courseId))]).select("id", "name");
  const classById = new Map(classRows.map((c) => [c.id, c]));
  const courseById = new Map(courseRows.map((c) => [c.id, c.name]));
  return unique
    .map((c) => ({ ...c, kind: "class", className: classLabel(classById.get(c.classId)), courseName: courseById.get(c.courseId) || "Course" }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

// The same for several educators at once (a parent check-in round has all the class's educators).
async function classTimesFor(teacherIds, from, to) {
  const out = [];
  for (const id of [...new Set(teacherIds)]) out.push(...(await classTimes(id, from, to)));
  return out;
}

module.exports = { classTimes, classTimesFor };

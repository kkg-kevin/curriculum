const db = require("../../config/db");
const R = require("./mentor-booking.rules");
const A = require("./availability.rules");
const EducatorBusy = require("./educator-busy");
const Notify = require("./mentor-booking.notifications");

// When the timetable moves onto a mentor session (23 Nov 2026). The class always wins:
//
//   waiting for payment   the hold is released and the family is told (nothing was paid)
//   paid                  flagged "needs a new time": the family picks another time, or cancels for
//                         a full refund even inside the normal cut-off. The mentor and admins are told
//   class moves away      the flag comes off and the session stands
//   start time passes     still flagged, it's cancelled and everything paid becomes a refund due
//
// Run in the background after any timetable change (`afterClassChange`) and hourly by
// `npm run checkins:process`, which catches changes made elsewhere (term dates, bootcamp dates).
// Every step is guarded on the row's state, so running it twice does nothing twice.

const B = "mentor_bookings";
const CLASH_REASON = "The mentor now has a class at this time";
const Service = () => require("./mentor-booking.service");

async function teachersOfClass(classId) {
  const linked = await db("class_course_teacher_links").where({ classId }).distinct("teacherId").pluck("teacherId");
  const named = await db("timetable_slots").where({ classId }).whereNotNull("teacherId").distinct("teacherId").pluck("teacherId");
  return [...new Set([...linked, ...named])];
}

async function settleBooking(raw, classes, now) {
  const b = { ...raw, date: String(raw.date).slice(0, 10) };
  const started = R.hoursUntil(b, now) <= 0;

  if (b.clashAt && started) {
    await Service().cancelForClash(b);
    return "cancelled";
  }
  if (started) return null;

  const clash = A.clashingClass(b, classes);
  if (b.status === "held") {
    if (!clash || !R.holdsTime(b, now)) return null;
    await Service().releaseHold(b, CLASH_REASON);
    const fresh = await db(B).where({ id: b.id }).first();
    await Notify.cancelled({ ...fresh, date: b.date }, { ...(await Service().peopleOf(b)), by: "system", refund: Number(fresh?.refundAmount) || 0 });
    return "released";
  }
  if (clash && !b.clashAt) {
    const clashAt = new Date();
    const changed = await db(B).where({ id: b.id, status: "confirmed" }).whereNull("clashAt").update({ clashAt, clashReason: CLASH_REASON, updatedAt: clashAt });
    if (changed) await Notify.needsNewTime({ ...b, clashAt }, await Service().peopleOf(b));
    return changed ? "flagged" : null;
  }
  if (!clash && b.clashAt) {
    const changed = await db(B).where({ id: b.id, status: "confirmed" }).whereNotNull("clashAt").update({ clashAt: null, clashReason: null, updatedAt: new Date() });
    if (changed) await Notify.clashCleared(b, await Service().peopleOf(b));
    return changed ? "cleared" : null;
  }
  return null;
}

// Every live booking of these educators (all of them when none are named) against their classes.
async function sweep({ teacherIds = null, now = new Date() } = {}) {
  const counts = { flagged: 0, cleared: 0, released: 0, cancelled: 0 };
  if (teacherIds && !teacherIds.length) return counts;
  const today = R.kenyaNow(now).date;
  let q = db(B).whereIn("status", R.ACTIVE).where((w) => w.where("date", ">=", today).orWhereNotNull("clashAt"));
  if (teacherIds) q = q.whereIn("teacherId", teacherIds);
  const rows = await q;
  const byTeacher = new Map();
  for (const r of rows) byTeacher.set(r.teacherId, [...(byTeacher.get(r.teacherId) || []), r]);

  for (const [teacherId, list] of byTeacher) {
    try {
      const dates = list.map((r) => String(r.date).slice(0, 10)).sort();
      const classes = await EducatorBusy.classTimes(teacherId, dates[0], dates[dates.length - 1]);
      for (const row of list) {
        const outcome = await settleBooking(row, classes, now);
        if (outcome) counts[outcome] += 1;
      }
    } catch (err) {
      console.error(`[mentor-bookings] could not check ${teacherId}'s sessions against their classes:`, err.message);
    }
  }
  return counts;
}

// A class landed on hours this mentor offers: they hear once per class, day and time.
async function noticeHoursTaken(teacherId, classId) {
  const windows = await db("teacher_availability_slots").where({ teacherId }).select("dayOfWeek", "startTime", "endTime");
  if (!windows.length) return 0;
  const cls = await db("classes").where({ id: classId }).first("id", "gradeName", "streamName", "schoolId");
  if (!cls) return 0;
  const links = await db("class_course_teacher_links").where({ classId, teacherId }).pluck("courseId");
  const slots = (await db("timetable_slots").where({ classId }).select("courseId", "teacherId", "dayOfWeek", "startTime", "endTime"))
    .filter((s) => (s.teacherId ? s.teacherId === teacherId : links.includes(s.courseId)));
  const hit = slots.filter((s) => A.intersect(s, windows.filter((w) => w.dayOfWeek === s.dayOfWeek)).length > 0);
  if (!hit.length) return 0;
  const teacher = await db("teachers").where({ id: teacherId }).first("email");
  const userId = teacher?.email ? (await db("users").whereRaw("LOWER(email) = ?", [String(teacher.email).toLowerCase()]).first("id"))?.id : null;
  if (!userId) return 0;
  const hub = cls.schoolId ? await db("learning_hubs").where({ id: cls.schoolId }).first("ownerAdminId") : null;
  const className = [cls.gradeName, cls.streamName].filter(Boolean).join(" — ") || "A class";
  for (const s of hit) await Notify.hoursTaken({ teacherId, userId, classId, className, slot: s, ownerAdminId: hub?.ownerAdminId || null });
  return hit.length;
}

// After a change to a class's timetable or educators. `alsoTeacherIds`: anyone it just took off the
// class, whose sessions may have been freed.
async function afterClassChange(classId, { alsoTeacherIds = [], teacherIds = null } = {}) {
  const current = teacherIds || (await teachersOfClass(classId));
  await sweep({ teacherIds: [...new Set([...current, ...alsoTeacherIds.filter(Boolean)])] });
  for (const id of current) await noticeHoursTaken(id, classId);
}

// The same in the background — a timetable save never waits for it or fails because of it.
function afterClassChangeLater(classId, options = {}) {
  if (!classId) return;
  setImmediate(() => afterClassChange(classId, options).catch((err) => {
    console.error("[mentor-bookings] re-check after a timetable change failed:", err.message);
  }));
}

// Before saving a weekly class time: the paid sessions of these educators it would land on.
async function previewForSlot({ classId, courseId, teacherIds, dayOfWeek, startTime, endTime, now = new Date() }) {
  if (!teacherIds?.length || !dayOfWeek || !startTime || !endTime) return [];
  const today = R.kenyaNow(now).date;
  const rows = await db(B).whereIn("teacherId", teacherIds).where({ status: "confirmed" }).whereNull("clashAt").where("date", ">=", today)
    .where("startTime", "<", endTime).where("endTime", ">", startTime)
    .select("teacherId", "date", "startTime", "endTime");
  if (!rows.length) return [];
  const { weekdayOf } = require("../mentor-checkins/mentor-checkin.rules");
  const Timetable = require("../timetable/timetable.service");
  const periods = await Timetable.getPeriodsForClass(classId);
  const anchor = courseId ? await db("timetable_course_schedules").where({ classId, courseId }).first("startDate") : null;
  const anchorDate = anchor?.startDate ? String(anchor.startDate).slice(0, 10) : null;
  const byTeacher = new Map();
  for (const r of rows) {
    const date = String(r.date).slice(0, 10);
    if (weekdayOf(date) !== dayOfWeek || R.hoursUntil({ ...r, date }, now) <= 0) continue;
    if (!Timetable.isDateSchedulable(date, periods) || (anchorDate && date < anchorDate)) continue;
    const entry = byTeacher.get(r.teacherId) || { teacherId: r.teacherId, count: 0, firstDate: date };
    entry.count += 1;
    if (date < entry.firstDate) entry.firstDate = date;
    byTeacher.set(r.teacherId, entry);
  }
  return [...byTeacher.values()];
}

module.exports = { CLASH_REASON, sweep, afterClassChange, afterClassChangeLater, noticeHoursTaken, previewForSlot, teachersOfClass };

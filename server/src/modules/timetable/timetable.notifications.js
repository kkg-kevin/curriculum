const db = require("../../config/db");
const NotificationService = require("../notifications/notification.service");

// A live class gains a lesson, changes day or time, or a lesson stops: its families and educators
// are told once. Nothing here may fail the change that triggered it.

const DAY = (d) => d.charAt(0).toUpperCase() + d.slice(1);
const time = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const when = (s) => `${DAY(s.dayOfWeek)} ${time(s.startTime)}`;
const dateLabel = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

async function educatorLogins(classId, courseId, extra = []) {
  const linked = await db("class_course_teacher_links").where({ classId, courseId }).pluck("teacherId");
  const ids = [...new Set([...linked, ...extra.filter(Boolean)])];
  if (!ids.length) return [];
  const emails = (await db("teachers").whereIn("id", ids).pluck("email")).filter(Boolean).map((e) => e.toLowerCase());
  return emails.length ? db("users").whereIn(db.raw("LOWER(email)"), emails).pluck("id") : [];
}

const TimetableNotifications = {
  // `before` is null for a new lesson, `after` is null when one stopped. `from` is the first date it
  // applies (null = straight away).
  async lessonChanged({ before = null, after = null, from = null }) {
    const lesson = before || after;
    const running = await db("timetable_course_schedules").where({ classId: lesson.classId, courseId: lesson.courseId }).first("id");
    if (!running) return 0; // Not on anyone's calendar yet: nobody has been told a time.
    const cls = await db("classes").where({ id: lesson.classId }).first("gradeName", "streamName", "schoolId");
    const course = await db("courses").where({ id: lesson.courseId }).first("name");
    const hub = cls?.schoolId ? await db("learning_hubs").where({ id: cls.schoolId }).first("ownerAdminId") : null;
    const courseName = course?.name || "A class";
    const fromText = from ? `From ${dateLabel(from)}, ` : "";
    const message = !before
      ? `${fromText}${courseName} also runs on ${when(after)}.`
      : after
        ? `${fromText}${courseName} moves from ${when(before)} to ${when(after)}.`
        : `${fromText}${courseName} no longer runs on ${when(before)}.`;
    const was = before ? `${before.dayOfWeek}:${before.startTime}` : "new";
    const now = after ? `${after.dayOfWeek}:${after.startTime}:${after.endTime}` : "removed";
    const dedupeKey = `timetable_changed:${lesson.id}:${was}:${now}:${from || "now"}`;
    const event = { type: "timetable_changed", title: `Timetable change: ${courseName}`, message, ownerAdminId: hub?.ownerAdminId || null };

    const learnerIds = await db("learner_hub_links").where({ classId: lesson.classId, status: "active" }).distinct("learnerId").pluck("learnerId");
    for (const learnerId of learnerIds) {
      // One key per class change: a parent with two children in the class hears once.
      await NotificationService.notifyLearner(learnerId, { ...event, payload: { route: "/learner-portal/timetable", classId: lesson.classId }, dedupeKey });
    }
    const logins = await educatorLogins(lesson.classId, lesson.courseId, [before?.teacherId, after?.teacherId]);
    for (const userId of logins) {
      await NotificationService.notifyPerson(userId, { ...event, payload: { route: "/teacher-portal/timetable", classId: lesson.classId }, dedupeKey });
    }
    return learnerIds.length + logins.length;
  },
};

module.exports = TimetableNotifications;
